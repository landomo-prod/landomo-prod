import express from 'express';
import { ScrapeRunTracker, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8106', 10);
const PORTAL = 'realingo';

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

const VALID_CATEGORIES = ['apartment', 'house', 'land', 'commercial'];

function parseCategoryFilter(input: any): string[] | undefined {
  if (!input || !Array.isArray(input) || input.length === 0) return undefined;
  const valid = input.filter((c: any) => typeof c === 'string' && VALID_CATEGORIES.includes(c));
  return valid.length > 0 ? valid : undefined;
}

// Start the detail worker (always running, picks up jobs from Redis)
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '10');
const worker = createDetailWorker(WORKER_CONCURRENCY);
console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'Detail worker started', concurrency: WORKER_CONCURRENCY }));

// Drain stale jobs from previous incomplete runs
(async () => {
  const stats = await getQueueStats();
  if (stats.waiting > 0) {
    console.log(JSON.stringify({ level: 'warn', service: 'realingo-scraper', msg: 'Draining stale jobs from previous run', staleJobs: stats.waiting }));
    await detailQueue.drain();
  }
})();

// Scrape lock — prevent concurrent runs from draining each other's queues
let scrapeRunning = false;

app.get('/health', async (req, res) => {
  const queue = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '4.1.0-streaming',
    timestamp: new Date().toISOString(),
    features: {
      streaming: true,
      checksum_based: true,
      graphql_api: true,
      bullmq_worker: true,
    },
    queue,
    scrapeRunning,
  });
});

app.post('/scrape', async (req, res) => {
  if (scrapeRunning) {
    res.status(409).json({ status: 'scrape already running', timestamp: new Date().toISOString() });
    return;
  }
  const categories = parseCategoryFilter(req.body?.categories);
  res.status(202).json({ status: 'scraping started', categories: categories || 'all', timestamp: new Date().toISOString() });
  runScraper(categories).catch(err => console.error(JSON.stringify({ level: 'error', service: 'realingo-scraper', msg: 'Scraping failed', err: err.message })));
});

async function runScraper(categories?: string[]) {
  scrapeRunning = true;
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'Starting streaming scrape', categories: categories || 'all', timestamp: new Date().toISOString() }));

  try {
    const stats = await runThreePhaseScrape(runId ?? undefined, categories);
    printThreePhaseSummary(stats);

    await tracker.complete({
      listings_found: stats.phase1.totalListings,
      listings_new: stats.phase2.new,
      listings_updated: stats.phase2.changed,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, stats.phase3.queued);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    console.log(JSON.stringify({
      level: 'info', service: 'realingo-scraper', portal: PORTAL,
      durationSec: durationSec.toFixed(2),
      total: stats.phase1.totalListings,
      new: stats.phase2.new, changed: stats.phase2.changed,
      unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent,
      queued: stats.phase3.queued,
      msg: 'Scrape phase complete — detail worker processing queue',
    }));

  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    console.error(JSON.stringify({ level: 'error', service: 'realingo-scraper', msg: 'Scrape failed', err: error.message }));
    throw error;
  } finally {
    scrapeRunning = false;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', port: PORT, msg: 'Scraper started' }));
  console.log(`Realingo scraper running\n  Port: ${PORT}\n  Mode: Streaming (BullMQ worker)\n  Health: http://localhost:${PORT}/health\n  Trigger: POST http://localhost:${PORT}/scrape`);
});

process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'SIGTERM received, closing worker' }));
  await worker.close();
  await detailQueue.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'SIGINT received, closing worker' }));
  await worker.close();
  await detailQueue.close();
  process.exit(0);
});
