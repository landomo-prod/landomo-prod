import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { createDetailWorker, getQueueStats, detailQueue } from './queue/detailQueue';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';

const app = express();
const PORT = parseInt(process.env.PORT || '8200', 10);
const PORTAL = 'pisos-com';

const log = createLogger({ service: 'pisos-com-scraper', portal: PORTAL, country: 'spain' });

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '40');
const workers = createDetailWorker(WORKER_CONCURRENCY);
log.info({ workers: WORKER_CONCURRENCY }, 'Started download workers');

app.use(express.json());
setupScraperMetrics(app, PORTAL);

app.get('/health', async (req, res) => {
  const queueStats = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    workers: WORKER_CONCURRENCY,
    queue: queueStats,
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', async (req, res) => {
  const provincesParam = req.query.provinces as string;
  let provinces: string[] | undefined;

  if (provincesParam) {
    provinces = provincesParam.split(',');
  }

  res.status(202).json({
    status: 'scraping started',
    provinces: provinces || 'all',
    timestamp: new Date().toISOString(),
  });

  runScraper(provinces).catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

async function runScraper(provinces?: string[]) {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ provinces: provinces || 'all', workers: WORKER_CONCURRENCY }, 'Starting three-phase checksum scrape');

  try {
    await detailQueue.drain();
    log.info('Queue cleared, starting fresh');

    const phaseStats = await runThreePhaseScrape(runId ?? undefined, provinces);
    printThreePhaseSummary(phaseStats);

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

      if (remaining === 0 && stats.active === 0) break;
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
      totalFound: phaseStats.phase1.totalListings,
      processed: finalStats.completed,
      failed: finalStats.failed,
      savingsPercent: phaseStats.phase2.savingsPercent,
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
  log.info({ port: PORT, workers: WORKER_CONCURRENCY }, 'Pisos.com scraper running');
});

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
