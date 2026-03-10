import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { fetchAllListingSummaries, fetchListingDetails } from './scrapers/listingsScraper';
import { transformListing } from './transformers';
import { sendToIngest, PropertyBatch } from './adapters/ingestAdapter';

const app = express();
const PORT = parseInt(process.env.PORT || '8211', 10);
const PORTAL = 'hybel-no';

const log = createLogger({ service: 'hybel-scraper', portal: PORTAL, country: 'norway' });

app.use(express.json());

setupScraperMetrics(app, PORTAL);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', (_req, res) => {
  res.status(202).json({
    status: 'scraping started',
    portal: PORTAL,
    timestamp: new Date().toISOString(),
  });

  runScraper().catch(err => {
    log.error({ err }, 'Scraping failed');
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ runId }, 'Starting hybel.no scrape');

  try {
    // Phase 1: Collect all listing summaries via paginated listing pages
    log.info('Phase 1: Collecting listing summaries');
    const { summaries, totalListings } = await fetchAllListingSummaries();
    log.info({ summariesCollected: summaries.length, totalListings }, 'Phase 1 complete');

    scraperMetrics.propertiesScraped.inc(
      { portal: PORTAL, category: 'all', result: 'found' },
      summaries.length
    );

    // Phase 2: Fetch detail pages for all listings
    log.info({ count: summaries.length }, 'Phase 2: Fetching detail pages');
    const details = await fetchListingDetails(summaries);
    log.info({ detailsFetched: details.length }, 'Phase 2 complete');

    // Phase 3: Transform and send to ingest API
    log.info('Phase 3: Transforming and ingesting');
    const batches: PropertyBatch[] = [];
    let transformErrors = 0;

    for (const detail of details) {
      try {
        const property = transformListing(detail);
        batches.push({ property, detail });
      } catch (err: any) {
        transformErrors++;
        log.warn({ id: detail.id, err: err.message }, 'Transform failed, skipping listing');
      }
    }

    log.info(
      { transformed: batches.length, transformErrors },
      'Transformation complete, sending to ingest'
    );

    const { sent, failed } = await sendToIngest(batches);

    // Metrics
    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, sent);
    if (failed > 0) {
      scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'error' }, failed);
    }
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    await tracker.complete({
      listings_found: summaries.length,
      listings_new: sent,
      listings_updated: 0,
    });

    log.info(
      {
        durationMin: (durationSec / 60).toFixed(2),
        summariesCollected: summaries.length,
        detailsFetched: details.length,
        transformed: batches.length,
        sent,
        failed,
        transformErrors,
      },
      'Scrape completed successfully'
    );
  } catch (err: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err }, 'Scrape failed');
    throw err;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT, portal: PORTAL }, 'hybel.no scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
