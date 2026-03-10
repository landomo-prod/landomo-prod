import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { runThreePhaseScrape, printThreePhaseSummary } from './scraper/threePhaseOrchestrator';
import { closeBrowser } from './scrapers/listingsScraper';

const app = express();
const PORT = parseInt(process.env.PORT || '8111', 10);
const PORTAL = 'immobiliare.it';

app.use(express.json());

// ---- State tracking ----
let scrapeRunning = false;
let lastRunAt: string | null = null;
let lastRunStats: any = null;
let lastRunError: string | null = null;

// ---- Routes ----

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.0.0-playwright',
    timestamp: new Date().toISOString(),
    features: {
      playwright: true,
      persistent_profile: true,
      checksum_based: true,
      no_bullmq: true,
    },
    ingestApiUrl: process.env.INGEST_API_URL || 'http://46.225.167.44:3007',
    scrapeRunning,
    lastRunAt,
    lastRunStats,
    lastRunError,
  });
});

app.post('/scrape', (req, res) => {
  if (scrapeRunning) {
    res.status(409).json({ status: 'already_running', message: 'A scrape is already in progress' });
    return;
  }

  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });

  runScraper().catch(err => {
    console.error(JSON.stringify({
      level: 'error',
      service: 'immobiliare-scraper',
      msg: 'Unhandled scraper error',
      err: err.message,
    }));
  });
});

// ---- Main scrape runner ----

async function runScraper(): Promise<void> {
  scrapeRunning = true;
  lastRunError = null;
  const startTime = Date.now();

  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  console.log(JSON.stringify({
    level: 'info',
    service: 'immobiliare-scraper',
    msg: 'Scrape started',
    runId,
    timestamp: new Date().toISOString(),
    note: 'Browser will open for first run – solve CAPTCHA if prompted',
  }));

  try {
    const stats = await runThreePhaseScrape(runId ?? undefined);
    printThreePhaseSummary(stats);

    lastRunStats = stats;
    lastRunAt = new Date().toISOString();

    await tracker.complete({
      listings_found: stats.phase1.totalListings,
      listings_new: stats.phase2.new,
      listings_updated: stats.phase2.changed,
    });

    console.log(JSON.stringify({
      level: 'info',
      service: 'immobiliare-scraper',
      portal: PORTAL,
      durationSec: ((Date.now() - startTime) / 1000).toFixed(2),
      total: stats.phase1.totalListings,
      new: stats.phase2.new,
      changed: stats.phase2.changed,
      unchanged: stats.phase2.unchanged,
      savingsPercent: stats.phase2.savingsPercent,
      ingested: stats.phase3.ingested,
      msg: 'Scrape complete',
    }));
  } catch (error: any) {
    lastRunError = error.message;
    lastRunAt = new Date().toISOString();

    await tracker.fail();

    console.error(JSON.stringify({
      level: 'error',
      service: 'immobiliare-scraper',
      msg: 'Scrape failed',
      err: error.message,
    }));
  } finally {
    scrapeRunning = false;
  }
}

// ---- Server ----

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    level: 'info',
    service: 'immobiliare-scraper',
    port: PORT,
    msg: 'Immobiliare.it Playwright scraper started',
  }));
  console.log(
    `\nImmobiliare.it scraper (Playwright)\n` +
    `  Port:    ${PORT}\n` +
    `  Health:  http://localhost:${PORT}/health\n` +
    `  Trigger: POST http://localhost:${PORT}/scrape\n` +
    `  Ingest:  ${process.env.INGEST_API_URL || 'http://46.225.167.44:3007'}\n` +
    `\n  NOTE: First run opens a visible browser window.\n` +
    `        Solve the CAPTCHA if prompted. Cookies are saved for future runs.\n`,
  );
});

process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'immobiliare-scraper', msg: 'SIGTERM – closing browser' }));
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'immobiliare-scraper', msg: 'SIGINT – closing browser' }));
  await closeBrowser();
  process.exit(0);
});
