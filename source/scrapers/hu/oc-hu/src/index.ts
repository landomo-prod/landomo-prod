import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';
import { runTwoPhaseScrape, printPhaseSummary } from './scraper/orchestrator';

const app = express();
const PORT = parseInt(process.env.PORT || '8088', 10);
const PORTAL = 'oc-hu';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '30');
const workers = createDetailWorker(WORKER_CONCURRENCY);
console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Started workers', concurrency: WORKER_CONCURRENCY }));

app.use(express.json());

app.get('/health', async (req, res) => {
  const queueStats = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.0.0-queue',
    country: 'Hungary',
    portal_name: 'Otthon Centrum',
    workers: WORKER_CONCURRENCY,
    queue: queueStats,
    timestamp: new Date().toISOString()
  });
});

app.post('/scrape', async (req, res) => {
  const { maxRegions, maxPages } = req.body || {};

  res.status(202).json({
    status: 'scraping started',
    config: {
      maxRegions: maxRegions || 'all',
      maxPages: maxPages || 'unlimited'
    },
    timestamp: new Date().toISOString()
  });

  runScraper(maxRegions, maxPages).catch(error => {
    console.error(JSON.stringify({ level: 'error', service: 'oc-hu', msg: 'Scraping failed', err: error.message }));
  });
});

async function runScraper(maxRegions?: number, maxPages?: number) {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Starting two-phase checksum scrape', maxRegions, maxPages }));

  try {
    await detailQueue.drain();
    console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Queue cleared, starting fresh' }));

    const phaseStats = await runTwoPhaseScrape(runId ?? undefined, maxRegions, maxPages);
    printPhaseSummary(phaseStats);

    // Wait for workers to finish processing queue
    console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Waiting for workers to finish' }));

    let lastCount = -1;
    while (true) {
      const stats = await getQueueStats();
      const remaining = stats.waiting + stats.active;

      if (remaining !== lastCount) {
        console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'Queue progress', waiting: stats.waiting, active: stats.active, completed: stats.completed }));
        lastCount = remaining;
      }

      if (remaining === 0 && stats.active === 0) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const finalStats = await getQueueStats();

    await tracker.complete({
      listings_found: phaseStats.phase1.totalListings,
      listings_new: phaseStats.phase2.new,
      listings_updated: phaseStats.phase2.changed
    });

    const durationMin = ((Date.now() - startTime) / 60000).toFixed(2);
    console.log(JSON.stringify({
      level: 'info',
      service: 'oc-hu',
      msg: 'Scrape completed',
      durationMin,
      totalFound: phaseStats.phase1.totalListings,
      processed: finalStats.completed,
      failed: finalStats.failed,
      savingsPercent: phaseStats.phase2.savingsPercent,
      skipped: phaseStats.phase2.unchanged,
    }));

  } catch (error: any) {
    await tracker.fail();
    console.error(JSON.stringify({ level: 'error', service: 'oc-hu', msg: 'Scrape failed', err: error.message }));
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'OC.hu scraper running (Queue-based)', port: PORT, workers: WORKER_CONCURRENCY }));
});

process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'SIGTERM received, shutting down' }));
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'oc-hu', msg: 'SIGINT received, shutting down' }));
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});
