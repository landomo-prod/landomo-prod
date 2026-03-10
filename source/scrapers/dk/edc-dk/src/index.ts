import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { EdcListingsScraper } from './scrapers/listingsScraper';
import { transformListing } from './transformers';
import { IngestAdapter } from './adapters/ingestAdapter';
import { EdcListingRaw } from './types/edcTypes';

const app = express();
const PORT = parseInt(process.env.PORT || '8202', 10);
const PORTAL = 'edc-dk';
const COUNTRY = 'denmark';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500');

const log = createLogger({ service: 'edc-dk-scraper', portal: PORTAL, country: COUNTRY });

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

app.post('/scrape', async (_req, res) => {
  res.status(202).json({
    status: 'scraping started',
    portal: PORTAL,
    timestamp: new Date().toISOString(),
  });

  runScraper().catch(err => {
    log.error({ err }, 'Scrape run failed');
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  const scraper = new EdcListingsScraper();
  const ingest = new IngestAdapter();

  let totalFound = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Accumulate listings into batches before sending to ingest
  let pendingBatch: ReturnType<typeof transformListing>[] = [];

  const flushBatch = async (): Promise<void> => {
    const valid = pendingBatch.filter((p): p is NonNullable<typeof p> => p !== null);
    pendingBatch = [];

    if (valid.length === 0) return;

    try {
      const result = await ingest.sendBatch(valid);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalErrors += result.errors;

      log.info({
        batchSize: valid.length,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors,
      }, 'Batch ingested');
    } catch (err: any) {
      totalErrors += valid.length;
      log.error({ err, batchSize: valid.length }, 'Batch ingest failed');
    }
  };

  const onBatch = async (rawBatch: EdcListingRaw[]): Promise<void> => {
    for (const raw of rawBatch) {
      totalFound++;
      const transformed = transformListing(raw);
      if (transformed) {
        pendingBatch.push(transformed);
      }

      if (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  };

  try {
    log.info({ batchSize: BATCH_SIZE }, 'Starting EDC.dk scrape');

    const divisionStats = await scraper.scrapeAll(onBatch);

    // Flush remaining items
    if (pendingBatch.length > 0) {
      await flushBatch();
    }

    const durationSec = (Date.now() - startTime) / 1000;

    await tracker.complete({
      listings_found: totalFound,
      listings_new: totalInserted,
      listings_updated: totalUpdated,
    });

    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, totalInserted + totalUpdated);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info({
      durationMin: (durationSec / 60).toFixed(2),
      totalFound,
      totalInserted,
      totalUpdated,
      totalErrors,
      divisionStats,
    }, 'EDC.dk scrape completed');
  } catch (err: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err }, 'EDC.dk scrape failed');
    throw err;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'EDC.dk scraper started');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down');
  process.exit(0);
});
