import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';
import { runTwoPhaseScrape, printPhaseSummary } from './scraper/orchestrator';

const app = express();
const PORT = parseInt(process.env.PORT || '8090', 10);
const PORTAL = 'zenga-hu';

const log = (level: string, msg: string, extra: Record<string, any> = {}) =>
  console.log(JSON.stringify({ level, service: 'zenga-hu', msg, ...extra }));

// Start workers
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '30');
const workers = createDetailWorker(WORKER_CONCURRENCY);
log('info', 'Started workers', { concurrency: WORKER_CONCURRENCY });

app.use(express.json());

app.get('/health', async (req, res) => {
  const queueStats = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.0.0-queue',
    workers: WORKER_CONCURRENCY,
    queue: queueStats,
    timestamp: new Date().toISOString()
  });
});

app.post('/scrape', async (req, res) => {
  res.status(202).json({
    status: 'scraping started',
    timestamp: new Date().toISOString()
  });

  runScraper().catch(error => {
    log('error', 'Scraping failed', { err: error.message });
  });
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  log('info', 'Starting two-phase checksum scrape', { workers: WORKER_CONCURRENCY });

  try {
    // Clear stale jobs
    await detailQueue.drain();
    log('info', 'Queue cleared');

    // Run two-phase scrape
    const phaseStats = await runTwoPhaseScrape(runId ?? undefined);
    printPhaseSummary(phaseStats);

    // Wait for workers to finish
    log('info', 'Waiting for workers to finish');
    let lastCount = -1;
    while (true) {
      const stats = await getQueueStats();
      const remaining = stats.waiting + stats.active;

      if (remaining !== lastCount) {
        log('info', 'Queue progress', { waiting: stats.waiting, active: stats.active, completed: stats.completed });
        lastCount = remaining;
      }

      if (remaining === 0 && stats.active === 0) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const finalStats = await getQueueStats();

    await tracker.complete({
      listings_found: phaseStats.phase1.totalListings,
      listings_new: phaseStats.phase2.new,
      listings_updated: phaseStats.phase2.changed
    });

    const durationSec = (Date.now() - startTime) / 1000;
    log('info', 'Scrape completed', {
      durationMin: (durationSec / 60).toFixed(2),
      totalFound: phaseStats.phase1.totalListings,
      processed: finalStats.completed,
      failed: finalStats.failed,
      savingsPercent: phaseStats.phase2.savingsPercent,
      skipped: phaseStats.phase2.unchanged,
    });

  } catch (error: any) {
    await tracker.fail();
    log('error', 'Scrape failed', { err: error.message });
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log('info', 'Zenga-hu scraper running (Queue-based)', { port: PORT, workers: WORKER_CONCURRENCY });
});

process.on('SIGTERM', async () => {
  log('info', 'SIGTERM received, shutting down');
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log('info', 'SIGINT received, shutting down');
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});
