import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { scrapeAllListings } from './scrapers/listingsScraper';
import { transformListing } from './transformers';
import { ingestProperties } from './adapters/ingestAdapter';

const app = express();
const PORT = parseInt(process.env.PORT || '8203', 10);
const PORTAL = 'home-dk';
const COUNTRY = 'denmark';

const log = createLogger({ service: 'home-dk-scraper', portal: PORTAL, country: COUNTRY });

app.use(express.json());
setupScraperMetrics(app, PORTAL);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    country: COUNTRY,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', async (_req, res) => {
  res.status(202).json({
    status: 'scraping started',
    portal: PORTAL,
    timestamp: new Date().toISOString(),
  });

  runScraper().catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info('Starting home.dk scrape');

  try {
    const result = await scrapeAllListings(runId ?? undefined);

    log.info(
      {
        totalSale: result.totalSale,
        totalRent: result.totalRent,
        fetchedSale: result.saleListings.length,
        fetchedRent: result.rentListings.length,
        errors: result.errors,
      },
      'Scrape phase complete, transforming and ingesting',
    );

    const allDetails = [...result.saleListings, ...result.rentListings];

    // Transform all listings
    const transformed = allDetails
      .map(listing => {
        try {
          return transformListing(listing);
        } catch (err: any) {
          log.warn({ err: err.message, id: listing.id }, 'Transform failed');
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    log.info(
      { total: allDetails.length, transformed: transformed.length },
      'Transformation complete',
    );

    scraperMetrics.propertiesScraped.inc(
      { portal: PORTAL, category: 'all', result: 'success' },
      transformed.length,
    );

    // Ingest in batches of 500
    await ingestProperties(transformed);

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    await tracker.complete({
      listings_found: allDetails.length,
      listings_new: transformed.length,
      listings_updated: 0,
    });

    log.info(
      {
        durationMin: (durationSec / 60).toFixed(2),
        found: allDetails.length,
        ingested: transformed.length,
        errors: result.errors,
      },
      'Scrape completed',
    );
  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error.message }, 'Scrape failed');
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'home-dk scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down');
  process.exit(0);
});
