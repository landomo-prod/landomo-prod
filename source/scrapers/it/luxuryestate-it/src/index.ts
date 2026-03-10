/**
 * LuxuryEstate.com Italy Scraper - Entry Point
 *
 * Express server exposing:
 *   GET  /health  - Health check with queue stats
 *   POST /scrape  - Trigger three-phase scrape (non-blocking, returns 202)
 *
 * Also starts a BullMQ worker to process detail page fetch jobs.
 */

import express from 'express';
import { ScrapeRunTracker, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats } from './queue/detailQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8123', 10);
const PORTAL = 'luxuryestate.com';

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

// Start BullMQ worker for processing detail page jobs
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);
const worker = createDetailWorker(WORKER_CONCURRENCY);

console.log(
  JSON.stringify({
    level: 'info',
    service: 'luxuryestate-scraper',
    msg: 'Detail worker started',
    concurrency: WORKER_CONCURRENCY,
  })
);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    const queue = await getQueueStats();
    res.json({
      status: 'healthy',
      scraper: PORTAL,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      features: {
        three_phase: true,
        checksum_based: true,
        schema_org_jsonld: true,
        bullmq_worker: true,
      },
      queue,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

app.post('/scrape', (_req, res) => {
  res.status(202).json({
    status: 'scraping started',
    portal: PORTAL,
    timestamp: new Date().toISOString(),
  });

  runScraper().catch(err =>
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'luxuryestate-scraper',
        msg: 'Scrape failed',
        err: err.message,
      })
    )
  );
});

// ─── Scraper runner ──────────────────────────────────────────────────────────

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'Scrape started',
      runId,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const stats = await runThreePhaseScrape(runId ?? undefined);
    printThreePhaseSummary(stats);

    await tracker.complete({
      listings_found: stats.phase1.totalListings,
      listings_new: stats.phase2.new,
      listings_updated: stats.phase2.changed,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc(
      { portal: PORTAL, category: 'all', result: 'success' },
      stats.phase3.queued
    );
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'luxuryestate-scraper',
        portal: PORTAL,
        durationSec: durationSec.toFixed(2),
        total: stats.phase1.totalListings,
        new: stats.phase2.new,
        changed: stats.phase2.changed,
        unchanged: stats.phase2.unchanged,
        savingsPercent: stats.phase2.savingsPercent,
        queued: stats.phase3.queued,
        msg: 'Scrape phase complete - detail worker processing queue',
      })
    );
  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    console.error(
      JSON.stringify({
        level: 'error',
        service: 'luxuryestate-scraper',
        msg: 'Scrape failed',
        err: error.message,
      })
    );
    throw error;
  }
}

// ─── Start server ────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      port: PORT,
      msg: 'Scraper server started',
    })
  );
  console.log(
    `LuxuryEstate.com Italy scraper running\n` +
    `  Port:    ${PORT}\n` +
    `  Mode:    Three-phase (BullMQ worker)\n` +
    `  Health:  http://localhost:${PORT}/health\n` +
    `  Trigger: POST http://localhost:${PORT}/scrape`
  );
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'SIGTERM received - shutting down worker',
    })
  );
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'SIGINT received - shutting down worker',
    })
  );
  await worker.close();
  process.exit(0);
});
