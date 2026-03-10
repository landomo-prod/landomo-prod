import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';

const app = express();
const PORT = parseInt(process.env.PORT || '8221', 10);
const PORTAL = 'donpiso';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '10');
const workers = createDetailWorker(WORKER_CONCURRENCY);

console.log(JSON.stringify({
  level: 'info', service: 'donpiso-scraper',
  msg: 'Started detail workers', workers: WORKER_CONCURRENCY,
}));

app.use(express.json());

app.get('/health', async (req, res) => {
  const queueStats = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    workers: WORKER_CONCURRENCY,
    queue: queueStats,
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', async (req, res) => {
  res.status(202).json({
    status: 'scraping started',
    timestamp: new Date().toISOString(),
  });

  runScraper().catch(error => {
    console.error(JSON.stringify({
      level: 'error', service: 'donpiso-scraper',
      msg: 'Scraping failed', err: error.message,
    }));
  });
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  console.log(JSON.stringify({
    level: 'info', service: 'donpiso-scraper',
    msg: 'Starting three-phase checksum scrape',
    workers: WORKER_CONCURRENCY,
  }));

  try {
    await detailQueue.drain();
    console.log(JSON.stringify({ level: 'info', service: 'donpiso-scraper', msg: 'Queue cleared, starting fresh' }));

    const phaseStats = await runThreePhaseScrape(runId ?? undefined);
    printThreePhaseSummary(phaseStats);

    // Wait for workers to finish processing the queue
    console.log(JSON.stringify({ level: 'info', service: 'donpiso-scraper', msg: 'Waiting for workers to finish' }));
    let lastCount = -1;
    while (true) {
      const stats = await getQueueStats();
      const remaining = stats.waiting + stats.active;

      if (remaining !== lastCount) {
        console.log(JSON.stringify({
          level: 'info', service: 'donpiso-scraper',
          msg: 'Queue progress',
          waiting: stats.waiting, active: stats.active, completed: stats.completed,
        }));
        lastCount = remaining;
      }

      if (remaining === 0 && stats.active === 0) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const finalStats = await getQueueStats();

    await tracker.complete({
      listings_found: phaseStats.phase1.totalListings,
      listings_new: phaseStats.phase2.new,
      listings_updated: phaseStats.phase2.changed,
    });

    const durationSec = (Date.now() - startTime) / 1000;

    console.log(JSON.stringify({
      level: 'info', service: 'donpiso-scraper',
      msg: 'Scrape completed',
      durationMin: (durationSec / 60).toFixed(2),
      totalFound: phaseStats.phase1.totalListings,
      processed: finalStats.completed,
      failed: finalStats.failed,
      savingsPercent: phaseStats.phase2.savingsPercent,
    }));
  } catch (error: any) {
    await tracker.fail();
    console.error(JSON.stringify({
      level: 'error', service: 'donpiso-scraper',
      msg: 'Scrape failed', err: error.message,
    }));
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    level: 'info', service: 'donpiso-scraper',
    msg: 'Donpiso scraper running', port: PORT, workers: WORKER_CONCURRENCY,
  }));
});

process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'donpiso-scraper', msg: 'SIGTERM received, shutting down' }));
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'donpiso-scraper', msg: 'SIGINT received, shutting down' }));
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});
