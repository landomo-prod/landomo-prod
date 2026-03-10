import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { scrapeAllListings, ScrapePage } from './scrapers/listingsScraper';
import { transformProperty } from './transformers';
import { sendBatch, IngestPayload } from './adapters/ingestAdapter';

const app = express();
const PORT = parseInt(process.env.PORT || '8204', 10);
const PORTAL = 'danbolig-dk';
const COUNTRY = 'denmark';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);

const log = createLogger({ service: 'danbolig-dk-scraper', portal: PORTAL, country: COUNTRY });

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

  runScraper().catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info('Starting danbolig.dk scrape');

  let totalFound = 0;
  let totalIngested = 0;
  let totalErrors = 0;

  // Accumulate a rolling batch across pages
  let pendingBatch: IngestPayload[] = [];

  async function flushBatch(force = false): Promise<void> {
    if (pendingBatch.length === 0) return;
    if (!force && pendingBatch.length < BATCH_SIZE) return;

    const batch = pendingBatch.splice(0, BATCH_SIZE);
    try {
      await sendBatch(batch);
      totalIngested += batch.length;
    } catch (err: any) {
      totalErrors += batch.length;
      log.error({ err: err.message, batchSize: batch.length }, 'Batch ingest failed');
    }
  }

  try {
    const stats = await scrapeAllListings(async (page: ScrapePage) => {
      totalFound += page.properties.length;

      for (const raw of page.properties) {
        try {
          const { property } = transformProperty(raw);

          pendingBatch.push({
            portalId: `danbolig-${raw.propertyId}-${raw.brokerId}`,
            data: property,
            rawData: raw as unknown as Record<string, unknown>,
          });

          await flushBatch();
        } catch (err: any) {
          totalErrors++;
          log.warn({ err: err.message, propertyId: raw.propertyId }, 'Transform failed');
        }
      }
    });

    // Flush remaining items
    while (pendingBatch.length > 0) {
      await flushBatch(true);
    }

    const durationSec = (Date.now() - startTime) / 1000;

    await tracker.complete({
      listings_found: stats.totalListings,
      listings_new: totalIngested,
      listings_updated: 0,
    });

    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, totalIngested);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info({
      durationMin: (durationSec / 60).toFixed(2),
      totalListings: stats.totalListings,
      totalPages: stats.totalPages,
      totalFound,
      totalIngested,
      totalErrors,
    }, 'Scrape completed');
  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error.message }, 'Scrape failed');
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'danbolig-dk scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down');
  process.exit(0);
});
