import express from 'express';
import { ScrapeRunTracker, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats } from './queue/detailQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8110', 10);
const PORTAL = 'idealista.it';

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const worker = createDetailWorker(WORKER_CONCURRENCY);
console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Detail worker started', concurrency: WORKER_CONCURRENCY }));

app.get('/health', async (req, res) => {
  const queue = await getQueueStats();
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      streaming: true,
      checksum_based: true,
      html_scraping: true,
      bullmq_worker: true,
    },
    queue,
  });
});

app.post('/scrape', async (req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });
  runScraper().catch(err => console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Scraping failed', err: err.message })));
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Starting streaming scrape', timestamp: new Date().toISOString() }));

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
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, stats.phase3.queued);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    console.log(JSON.stringify({
      level: 'info', service: 'idealista-scraper', portal: PORTAL,
      durationSec: durationSec.toFixed(2),
      total: stats.phase1.totalListings,
      new: stats.phase2.new, changed: stats.phase2.changed,
      unchanged: stats.phase2.unchanged, savingsPercent: stats.phase2.savingsPercent,
      queued: stats.phase3.queued,
      msg: 'Scrape phase complete',
    }));

  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Scrape failed', err: error.message }));
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', port: PORT, msg: 'Scraper started' }));
  console.log(`Idealista.it scraper running\n  Port: ${PORT}\n  Mode: Streaming (BullMQ worker)\n  Health: http://localhost:${PORT}/health\n  Trigger: POST http://localhost:${PORT}/scrape`);
});

process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'SIGTERM received, closing worker' }));
  await worker.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'SIGINT received, closing worker' }));
  await worker.close();
  process.exit(0);
});
