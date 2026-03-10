import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { runOrchestrator, printOrchestratorSummary } from './scraper/orchestrator';

const app = express();
const PORT = process.env.PORT || 8086;
const PORTAL = 'ingatlan-com';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.0.0-checksum',
    country: 'Hungary',
    timestamp: new Date().toISOString()
  });
});

app.post('/scrape', async (req, res) => {
  const { maxRegions, maxPages } = req.body || {};

  res.status(202).json({
    status: 'scraping started',
    config: {
      maxRegions: maxRegions || 'all',
      maxPages: maxPages || 'unlimited',
      mode: 'two-phase-checksum'
    },
    timestamp: new Date().toISOString()
  });

  runScraper(maxRegions, maxPages).catch(error => {
    console.log(JSON.stringify({ level: 'error', service: PORTAL, msg: 'Scraping failed', err: error.message }));
  });
});

async function runScraper(maxRegions?: number, maxPages?: number) {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Starting two-phase checksum scrape', maxRegions, maxPages }));

  try {
    const stats = await runOrchestrator(maxRegions, maxPages, runId ?? undefined);
    printOrchestratorSummary(stats);

    await tracker.complete({
      listings_found: stats.phase1.totalListings,
      listings_new: stats.phase2.new,
      listings_updated: stats.phase2.changed
    });

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Scrape completed', durationSec, totalFound: stats.phase1.totalListings, ingested: stats.ingestion.sent, savingsPercent: stats.phase2.savingsPercent }));
  } catch (error: any) {
    await tracker.fail();
    console.log(JSON.stringify({ level: 'error', service: PORTAL, msg: 'Scrape failed', err: error.message }));
    throw error;
  }
}

app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'Scraper running', port: PORT, country: 'Hungary', mode: 'two-phase-checksum' }));
});

process.on('SIGTERM', () => {
  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'SIGTERM received, shutting down' }));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(JSON.stringify({ level: 'info', service: PORTAL, msg: 'SIGINT received, shutting down' }));
  process.exit(0);
});
