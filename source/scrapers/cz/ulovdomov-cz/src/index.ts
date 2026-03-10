import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats, detailQueue, getProcessedCount, resetProcessedCount } from './queue/detailQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8102', 10);
const PORTAL = 'ulovdomov';

const log = createLogger({ service: 'ulovdomov-scraper', portal: PORTAL, country: 'czech_republic' });

app.use(express.json());

// @ts-ignore - Express type version mismatch between local and shared-components node_modules
setupScraperMetrics(app, PORTAL);

// Start detail worker on boot
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '10');
const detailWorker = createDetailWorker(WORKER_CONCURRENCY);

// Drain stale jobs from previous incomplete runs
(async () => {
  const stats = await getQueueStats();
  if (stats.waiting > 0) {
    log.warn({ staleJobs: stats.waiting }, 'Draining stale jobs from previous run');
    await detailQueue.drain();
  }
})();

const VALID_CATEGORIES = ['apartment', 'house', 'land', 'commercial'];

function parseCategoryFilter(input: any): string[] | undefined {
  if (!input || !Array.isArray(input) || input.length === 0) return undefined;
  const valid = input.filter((c: any) => typeof c === 'string' && VALID_CATEGORIES.includes(c));
  return valid.length > 0 ? valid : undefined;
}

app.get('/health', async (req, res) => {
  const queueStats = await Promise.race([
    getQueueStats(),
    new Promise<null>(r => setTimeout(() => r(null), 1000)),
  ]);
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '3.0.0-detail-fetch',
    timestamp: new Date().toISOString(),
    features: { three_phase: true, checksum_based: true, detail_queue: true },
    queue: queueStats ?? 'unavailable',
    scrapeRunning,
  });
});

// Scrape lock — prevent concurrent runs
let scrapeRunning = false;

app.post('/scrape', async (req, res) => {
  if (scrapeRunning) {
    res.status(409).json({ status: 'scrape already running', timestamp: new Date().toISOString() });
    return;
  }
  const categories = parseCategoryFilter(req.body?.categories);
  res.status(202).json({ status: 'scraping started', categories: categories || 'all', timestamp: new Date().toISOString() });
  runScraper(categories).catch(error => log.error({ err: error }, 'Scraping failed'));
});

async function runScraper(categories?: string[]) {
  scrapeRunning = true;
  resetProcessedCount();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  log.info({ categories: categories || 'all' }, 'Starting UlovDomov three-phase scrape with detail fetch');

  try {
    const stats = await runThreePhaseScrape(runId ?? undefined, categories);
    printThreePhaseSummary(stats);

    // Wait for detail queue to drain (workers process detail pages)
    if (stats.phase3.queued > 0) {
      log.info({ queued: stats.phase3.queued }, 'Waiting for detail queue to drain...');
      await waitForQueueDrain();
      log.info({ processed: getProcessedCount() }, 'Detail queue drained');
    }

    await tracker.complete({
      listings_found: stats.phase1.totalListings,
      listings_new: stats.phase2.new,
      listings_updated: stats.phase2.changed,
    });

    const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, totalMs / 1000);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, getProcessedCount());
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error }, 'Scrape failed');
    throw error;
  } finally {
    scrapeRunning = false;
  }
}

/** Poll queue stats until all jobs are processed */
async function waitForQueueDrain(): Promise<void> {
  const MAX_WAIT_MS = 30 * 60 * 1000; // 30 minutes max
  const POLL_INTERVAL_MS = 2000;
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    const stats = await getQueueStats();
    if (stats.waiting === 0 && stats.active === 0) {
      return;
    }
    log.info({ waiting: stats.waiting, active: stats.active, processed: getProcessedCount() }, 'Queue draining...');
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  log.warn('Queue drain timed out after 30 minutes');
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT, workerConcurrency: WORKER_CONCURRENCY }, 'UlovDomov scraper running (detail-fetch mode)');
});

process.on('SIGTERM', async () => {
  log.info('SIGTERM received, gracefully shutting down...');
  await detailWorker.close();
  await detailQueue.close();
  log.info('Shutdown complete');
  process.exit(0);
});
process.on('SIGINT', async () => {
  log.info('SIGINT received, gracefully shutting down...');
  await detailWorker.close();
  await detailQueue.close();
  log.info('Shutdown complete');
  process.exit(0);
});
