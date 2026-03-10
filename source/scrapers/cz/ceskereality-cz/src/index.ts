import express from 'express';
import dotenv from 'dotenv';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8109', 10);
const PORTAL = 'ceskereality';

const log = createLogger({ service: 'ceskereality-scraper', portal: PORTAL, country: 'czech_republic' });

app.use(express.json());

// @ts-ignore - Express type version mismatch between local and shared-components node_modules
setupScraperMetrics(app, PORTAL);

// Start detail worker on boot
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const detailWorker = createDetailWorker(WORKER_CONCURRENCY);

// Drain stale jobs from previous incomplete runs
(async () => {
  const stats = await getQueueStats();
  if (stats.waiting > 0) {
    log.warn({ staleJobs: stats.waiting }, 'Draining stale jobs from previous run');
    await detailQueue.drain();
  }
})();

// Scrape lock — prevent concurrent runs from draining each other's queues
let scrapeRunning = false;
let quickScanRunning = false;

const QUICK_SCAN_TIMEOUT_MS = parseInt(process.env.QUICK_SCAN_TIMEOUT_MS || '120000'); // 2 min

const VALID_CATEGORIES = ['apartment', 'house', 'land', 'commercial'];

function parseCategoryFilter(input: any): string[] | undefined {
  if (!input || !Array.isArray(input) || input.length === 0) return undefined;
  const valid = input.filter((c: any) => typeof c === 'string' && VALID_CATEGORIES.includes(c));
  return valid.length > 0 ? valid : undefined;
}

app.get('/health', async (req, res) => {
  // Non-blocking queue stats — timeout after 1s to avoid hanging if Redis is unavailable
  const queueStats = await Promise.race([
    getQueueStats(),
    new Promise<null>(r => setTimeout(() => r(null), 1000)),
  ]);
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.1.0-three-phase',
    features: { three_phase: true, checksum_based: true, detail_queue: true },
    queue: queueStats ?? 'unavailable',
    scrapeRunning,
  });
});

app.post('/scrape', async (req, res) => {
  const categories = parseCategoryFilter(req.body?.categories);
  const maxPages = typeof req.body?.maxPages === 'number' && req.body.maxPages > 0
    ? Math.floor(req.body.maxPages) : undefined;

  // Quick scan — lightweight path with concurrency guard
  if (maxPages) {
    if (quickScanRunning) {
      return res.status(409).json({ status: 'quick_scan_already_running', timestamp: new Date().toISOString() });
    }
    res.status(202).json({ status: 'quick scan started', maxPages, timestamp: new Date().toISOString() });
    runQuickScan(categories, maxPages).catch(err => log.error({ err }, 'Quick scan failed'));
    return;
  }

  // Full crawl — existing path with lock
  if (scrapeRunning) {
    res.status(409).json({ status: 'scrape already running', timestamp: new Date().toISOString() });
    return;
  }
  res.status(202).json({ status: 'scraping started', categories: categories || 'all', timestamp: new Date().toISOString() });
  runScraper(categories).catch(error => log.error({ err: error }, 'Scraping failed'));
});

async function runQuickScan(categories?: string[], maxPages?: number) {
  if (quickScanRunning) {
    log.warn('Quick scan already running, skipping');
    return;
  }
  quickScanRunning = true;
  const start = Date.now();

  try {
    log.info({ maxPages, categories: categories || 'all' }, 'Quick scan starting');

    const result = await Promise.race([
      runThreePhaseScrape(undefined, categories, maxPages),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Quick scan timed out after ${QUICK_SCAN_TIMEOUT_MS}ms`)), QUICK_SCAN_TIMEOUT_MS)
      ),
    ]);

    const durationSec = ((Date.now() - start) / 1000).toFixed(1);
    log.info({
      durationSec,
      totalFound: result.phase1.totalUrls,
      queued: result.phase3.queued,
    }, 'Quick scan complete');
  } catch (err) {
    log.error({ err, durationMs: Date.now() - start }, 'Quick scan failed');
  } finally {
    quickScanRunning = false;
  }
}

async function runScraper(categories?: string[]) {
  scrapeRunning = true;
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  log.info({ categories: categories || 'all' }, 'Starting CeskeReality three-phase scrape');

  try {
    const stats = await runThreePhaseScrape(runId ?? undefined, categories);
    printThreePhaseSummary(stats);

    await tracker.complete({
      listings_found: stats.phase1.totalUrls,
      listings_new: stats.phase2.new,
      listings_updated: 0,
    });

    const totalMs = stats.phase1.durationMs + stats.phase2.durationMs + stats.phase3.durationMs;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, totalMs / 1000);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, stats.phase3.queued);
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

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'CeskeReality scraper listening (three-phase mode)');
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
