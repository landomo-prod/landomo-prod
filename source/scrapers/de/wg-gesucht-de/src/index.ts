import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { authenticate } from './utils/fetchData';

const app = express();
const PORT = parseInt(process.env.PORT || '8082', 10);
const PORTAL = 'wg-gesucht';

const log = createLogger({ service: `${PORTAL}-scraper`, portal: PORTAL, country: 'de' });

const WG_USERNAME = process.env.WG_GESUCHT_USERNAME;
const WG_PASSWORD = process.env.WG_GESUCHT_PASSWORD;
const USE_API = !!(WG_USERNAME && WG_PASSWORD);

// Start workers
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const workers = createDetailWorker(WORKER_CONCURRENCY);

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

app.get('/health', async (req, res) => {
  const queueStats = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    mode: USE_API ? 'api' : 'html',
    queue: queueStats,
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', async (req, res) => {
  res.status(202).json({
    status: 'scraping started',
    mode: USE_API ? 'api' : 'html',
    timestamp: new Date().toISOString(),
  });
  runScraper().catch(error => log.error({ err: error }, 'Scraping failed'));
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  try {
    // Authenticate if credentials are available (optional - HTML mode works without)
    if (USE_API && WG_USERNAME && WG_PASSWORD) {
      log.info('Authenticating with WG-Gesucht API');
      await authenticate(WG_USERNAME, WG_PASSWORD);
    } else {
      log.info('Running in HTML mode (no credentials needed)');
    }

    // Clear stale jobs from previous runs
    await detailQueue.drain();

    // Run three-phase scrape
    const phaseStats = await runThreePhaseScrape(runId ?? undefined);
    printThreePhaseSummary(phaseStats);

    // Poll queue until workers finish
    while (true) {
      const stats = await getQueueStats();
      const remaining = stats.waiting + stats.active;
      if (remaining === 0) break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const finalStats = await getQueueStats();

    await tracker.complete({
      listings_found: phaseStats.phase1.totalListings,
      listings_new: phaseStats.phase2.new,
      listings_updated: phaseStats.phase2.changed,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, finalStats.completed);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info({
      durationMin: (durationSec / 60).toFixed(2),
      mode: USE_API ? 'api' : 'html',
      totalFound: phaseStats.phase1.totalListings,
      processed: finalStats.completed,
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
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT, workers: WORKER_CONCURRENCY, mode: USE_API ? 'api' : 'html' }, `${PORTAL} scraper running`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    log.info(`${signal} received, shutting down`);
    await workers.close();
    await detailQueue.close();
    process.exit(0);
  });
}
