import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue, getProcessedCount, resetProcessedCount } from './queue/detailQueue';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';

const app = express();
const PORT = parseInt(process.env.PORT || '8102', 10);
const PORTAL = 'sreality';

const log = createLogger({ service: 'sreality-scraper', portal: PORTAL, country: 'czech_republic' });

// Start download workers (200 concurrent by default - balanced for speed + memory)
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '200');
const workers = createDetailWorker(WORKER_CONCURRENCY);
log.info({ workers: WORKER_CONCURRENCY }, 'Started download workers');

// Drain stale jobs from previous incomplete runs
(async () => {
  const stats = await getQueueStats();
  if (stats.waiting > 0) {
    log.warn({ staleJobs: stats.waiting }, 'Draining stale jobs from previous run');
    await detailQueue.drain();
  }
})();

// Scrape lock — prevents concurrent runs from draining each other's queues
let scrapeRunning = false;
let quickScanRunning = false;

const QUICK_SCAN_TIMEOUT_MS = parseInt(process.env.QUICK_SCAN_TIMEOUT_MS || '120000'); // 2 min
const FULL_SCAN_TIMEOUT_MS = parseInt(process.env.FULL_SCAN_TIMEOUT_MS || '5400000');  // 90 min

// JSON body parser
app.use(express.json());

// Prometheus metrics endpoint + request tracking
setupScraperMetrics(app, PORTAL);

const VALID_CATEGORIES = ['apartment', 'house', 'land', 'commercial'];

function parseCategoryFilter(input: any): string[] | undefined {
  if (!input || !Array.isArray(input) || input.length === 0) return undefined;
  const valid = input.filter((c: any) => typeof c === 'string' && VALID_CATEGORIES.includes(c));
  return valid.length > 0 ? valid : undefined;
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const queueStats = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.1.0-queue',
    workers: WORKER_CONCURRENCY,
    scrapeRunning,
    queue: queueStats,
    timestamp: new Date().toISOString()
  });
});

// Scrape trigger endpoint (called by centralized scheduler)
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
    log.warn('Scrape already in progress, rejecting');
    return res.status(409).json({
      status: 'already_running',
      message: 'A scrape is already in progress. Wait for it to finish.',
      timestamp: new Date().toISOString()
    });
  }

  res.status(202).json({
    status: 'scraping started',
    categories: categories || 'all',
    timestamp: new Date().toISOString()
  });

  runScraper(categories).catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
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
      totalFound: result.phase1.totalListings,
      queued: result.phase3.queued,
    }, 'Quick scan complete');
  } catch (err) {
    log.error({ err, durationMs: Date.now() - start }, 'Quick scan failed');
  } finally {
    quickScanRunning = false;
  }
}

async function runScraper(categories?: string[]) {
  if (scrapeRunning) {
    log.warn('Scrape already running, aborting');
    return;
  }
  scrapeRunning = true;

  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ categories: categories || 'all', workers: WORKER_CONCURRENCY }, 'Starting three-phase checksum scrape');

  try {
    // Wait for any in-flight jobs to finish before starting a new run
    const preStats = await getQueueStats();
    if (preStats.waiting + preStats.active > 0) {
      log.info({ waiting: preStats.waiting, active: preStats.active }, 'Waiting for previous queue to drain before starting');
      while (true) {
        const s = await getQueueStats();
        if (s.waiting + s.active === 0) break;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      log.info('Previous queue drained');
    }

    // Clean up completed/failed job references (does NOT remove waiting/active jobs)
    await detailQueue.clean(0, 1000, 'completed');
    await detailQueue.clean(0, 1000, 'failed');
    log.info('Completed/failed jobs cleaned, starting fresh');

    // Reset the processed counter for accurate tracking
    resetProcessedCount();

    // Run three-phase scrape with checksum optimization
    const phaseStats = await runThreePhaseScrape(runId ?? undefined, categories);
    printThreePhaseSummary(phaseStats);

    // Wait for workers to finish processing queue
    log.info('Waiting for workers to finish processing queue');

    let lastLog = 0;
    const drainDeadline = Date.now() + FULL_SCAN_TIMEOUT_MS;
    while (true) {
      const stats = await getQueueStats();
      const remaining = stats.waiting + stats.active;
      const processed = getProcessedCount();

      const now = Date.now();
      if (now - lastLog >= 10000) {
        log.info({ waiting: stats.waiting, active: stats.active, processed, failed: stats.failed }, 'Queue progress');
        lastLog = now;
      }

      if (remaining === 0 && stats.active === 0) {
        break;
      }

      if (now >= drainDeadline) {
        log.warn({ waiting: stats.waiting, active: stats.active, processed }, `Full scan drain timed out after ${FULL_SCAN_TIMEOUT_MS}ms`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const finalProcessed = getProcessedCount();
    const finalStats = await getQueueStats();

    await tracker.complete({
      listings_found: phaseStats?.phase1.totalListings ?? finalProcessed,
      listings_new: phaseStats?.phase2.new ?? 0,
      listings_updated: phaseStats?.phase2.changed ?? 0
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, finalProcessed);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    const durationMin = (durationSec / 60).toFixed(2);
    log.info({
      durationMin,
      totalFound: phaseStats.phase1.totalListings,
      queued: phaseStats.phase3.queued,
      processed: finalProcessed,
      failed: finalStats.failed,
      savingsPercent: phaseStats.phase2.savingsPercent,
      skipped: phaseStats.phase2.unchanged,
    }, 'Scrape completed');

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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT, workers: WORKER_CONCURRENCY }, 'SReality scraper running (Queue-based)');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down gracefully');
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down gracefully');
  await workers.close();
  await detailQueue.close();
  process.exit(0);
});
