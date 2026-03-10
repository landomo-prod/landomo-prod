import express from 'express';
import { ScrapeRunTracker, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8102', 10);
const PORTAL = 'reality';

app.use(express.json());

// Prometheus metrics endpoint + request tracking
// @ts-ignore - Express type version mismatch between local and shared-components node_modules
setupScraperMetrics(app, PORTAL);

const VALID_CATEGORIES = ['apartment', 'house', 'land', 'commercial'];

function parseCategoryFilter(input: any): string[] | undefined {
  if (!input || !Array.isArray(input) || input.length === 0) return undefined;
  const valid = input.filter((c: any) => typeof c === 'string' && VALID_CATEGORIES.includes(c));
  return valid.length > 0 ? valid : undefined;
}

// Start detail worker on boot
const detailWorker = createDetailWorker();

// Drain stale jobs from previous incomplete runs
(async () => {
  const stats = await getQueueStats();
  if (stats.waiting > 0) {
    console.log(JSON.stringify({ level: 'warn', service: 'reality-scraper', msg: 'Draining stale jobs from previous run', staleJobs: stats.waiting }));
    await detailQueue.drain();
  }
})();

app.get('/health', async (req, res) => {
  const queueStats = await Promise.race([
    getQueueStats(),
    new Promise<null>(r => setTimeout(() => r(null), 1000)),
  ]);
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '4.0.0-three-phase',
    timestamp: new Date().toISOString(),
    features: {
      three_phase: true,
      checksum_based: true,
      detail_queue: true,
      api_scraping: true,
      puppeteer: false,
    },
    queue: queueStats,
  });
});

let scrapeRunning = false;

app.post('/scrape', async (req, res) => {
  if (scrapeRunning) {
    res.status(409).json({ status: 'scrape already running', timestamp: new Date().toISOString() });
    return;
  }

  const categories = parseCategoryFilter(req.body?.categories);
  scrapeRunning = true;
  res.status(202).json({
    status: 'scraping started',
    categories: categories || 'all',
    timestamp: new Date().toISOString()
  });

  runScraper(categories).catch(error => {
    console.error(JSON.stringify({ level: 'error', service: 'reality-scraper', msg: 'Scraping failed', err: error.message }));
  }).finally(() => {
    scrapeRunning = false;
  });
});

async function runScraper(categories?: string[]) {
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  console.log(JSON.stringify({ level: 'info', service: 'reality-scraper', msg: 'Starting three-phase scrape', categories: categories || 'all', timestamp: new Date().toISOString() }));

  try {
    const stats = await runThreePhaseScrape(runId ?? undefined, categories);
    printThreePhaseSummary(stats);

    await tracker.complete({
      listings_found: stats.phase1.totalListings,
      listings_new: stats.phase2.new,
      listings_updated: stats.phase2.changed,
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
    console.error(JSON.stringify({ level: 'error', service: 'reality-scraper', msg: 'Scrape failed', err: error.message }));
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', service: 'reality-scraper', port: PORT, msg: 'Scraper started' }));
});

process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'reality-scraper', msg: 'SIGTERM received, shutting down' }));
  await detailWorker.close();
  await detailQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'reality-scraper', msg: 'SIGINT received, shutting down' }));
  await detailWorker.close();
  await detailQueue.close();
  process.exit(0);
});
