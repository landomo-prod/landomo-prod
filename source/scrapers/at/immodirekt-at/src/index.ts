import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';

const app = express();
const PORT = parseInt(process.env.PORT || '8088', 10);
const PORTAL = 'immodirekt-at';

const log = createLogger({ service: `${PORTAL}-scraper`, portal: PORTAL, country: 'at' });

// Start workers
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const workers = createDetailWorker(WORKER_CONCURRENCY);

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

// Health check
app.get('/health', async (req, res) => {
  const queueStats = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    queue: queueStats,
    timestamp: new Date().toISOString(),
    features: ['playwright', 'cloudflare-bypass', 'three-phase-checksum', 'bullmq-workers']
  });
});

// Scrape trigger (responds 202 immediately, runs async)
app.post('/scrape', async (req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });
  runScraper().catch(error => log.error({ err: error }, 'Scraping failed'));
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  try {
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

    log.info({ durationMin: (durationSec / 60).toFixed(2), processed: finalStats.completed, savingsPercent: phaseStats.phase2.savingsPercent }, 'Scrape completed');

  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error }, 'Scrape failed');
    throw error;
  }
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT, workers: WORKER_CONCURRENCY }, `${PORTAL} scraper running`);
});

// Graceful shutdown
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    log.info(`${signal} received, shutting down`);
    await workers.close();
    await detailQueue.close();
    process.exit(0);
  });
}
