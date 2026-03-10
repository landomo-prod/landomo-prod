import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { runScrape } from './scrapers/listingsScraper';

const app = express();
const PORT = parseInt(process.env.PORT || '8201', 10);
const PORTAL = 'nybolig-dk';
const COUNTRY = 'denmark';

const log = createLogger({ service: 'nybolig-dk-scraper', portal: PORTAL, country: COUNTRY });

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    country: COUNTRY,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', (req, res) => {
  res.status(202).json({
    status: 'scraping started',
    portal: PORTAL,
    timestamp: new Date().toISOString(),
  });

  runScraper().catch(err => {
    log.error({ err }, 'Scraping failed');
  });
});

let scrapeRunning = false;

async function runScraper(): Promise<void> {
  if (scrapeRunning) {
    log.warn('Scrape already running, skipping');
    return;
  }
  scrapeRunning = true;

  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ runId }, 'Starting nybolig.dk scrape');

  try {
    const stats = await runScrape((msg: string) => {
      log.info({ portal: PORTAL }, msg);
    });

    await tracker.complete({
      listings_found: stats.fetched,
      listings_new: stats.ingested,
      listings_updated: 0,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc(
      { portal: PORTAL, category: 'all', result: 'success' },
      stats.ingested
    );
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info(
      {
        durationMin: (durationSec / 60).toFixed(2),
        total: stats.total,
        fetched: stats.fetched,
        transformed: stats.transformed,
        ingested: stats.ingested,
        failed: stats.failed,
        skipped: stats.skipped,
      },
      'Scrape completed'
    );
  } catch (err: unknown) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err }, 'Scrape failed');
    throw err;
  } finally {
    scrapeRunning = false;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, `Nybolig.dk scraper running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
