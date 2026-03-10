import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';
import { runThreePhaseScrape } from './scraper/threePhaseOrchestrator';

const app = express();
const PORT = parseInt(process.env.PORT || '8082', 10);
const PORTAL = 'willhaben';

const log = createLogger({ service: 'willhaben-scraper', portal: PORTAL, country: 'at' });

// Start download workers (10 concurrent - REST API can handle parallelism)
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '10');
const workers = createDetailWorker(WORKER_CONCURRENCY);
log.info({ workers: WORKER_CONCURRENCY }, 'Started download workers');

// JSON body parser
app.use(express.json());

// Prometheus metrics endpoint + request tracking
setupScraperMetrics(app as any, PORTAL);

// Health check endpoint
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

// Scrape trigger endpoint (called by centralized scheduler)
app.post('/scrape', async (req, res) => {
  res.status(202).json({
    status: 'scraping started',
    timestamp: new Date().toISOString()
  });

  runScraper().catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ workers: WORKER_CONCURRENCY }, 'Starting three-phase checksum scrape');

  try {
    // Clear stale jobs
    await detailQueue.drain();
    log.info('Queue cleared, starting fresh');

    // Run three-phase scrape
    const phaseStats = await runThreePhaseScrape(runId ?? undefined);

    // Wait for workers to finish
    log.info('Waiting for workers to finish processing queue');
    let lastCount = -1;
    while (true) {
      const stats = await getQueueStats();
      const remaining = stats.waiting + stats.active;

      if (remaining !== lastCount) {
        log.info({ waiting: stats.waiting, active: stats.active, completed: stats.completed }, 'Queue progress');
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

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, finalStats.completed);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info({
      durationMin: (durationSec / 60).toFixed(2),
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT, workers: WORKER_CONCURRENCY }, 'Willhaben scraper running (Queue-based)');
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
