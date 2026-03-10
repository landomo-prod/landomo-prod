import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { ListingsScraper, ScrapeResult } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformKrogsveenEstate } from './transformers';

const app = express();
const PORT = parseInt(process.env.PORT || '8212', 10);
const PORTAL = 'krogsveen-no';

const log = createLogger({ service: 'krogsveen-no-scraper', portal: PORTAL, country: 'norway' });

app.use(express.json());

// Prometheus metrics endpoint + request tracking middleware
setupScraperMetrics(app as any, PORTAL);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Scrape trigger
app.post('/scrape', async (_req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });

  runScraper().catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

/**
 * Main scraper orchestration.
 *
 * Strategy:
 *   1. Call Krogsveen's GraphQL BFF (POST /bsr-api) once per commission bucket
 *      (residential-for-sale, project-for-sale, commercial-for-sale, upcoming).
 *   2. Each call returns ALL matching estates (no pagination needed).
 *   3. Transform each estate to the appropriate TierI category type.
 *   4. Stream batches of up to 500 to the ingest API.
 */
async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info('Starting krogsveen.no scrape');

  let totalTransformed = 0;
  let totalSent = 0;
  let totalErrors = 0;
  let batchNum = 0;

  // Batch size for streaming to ingest API
  const BATCH_SIZE = 500;

  try {
    const adapter = new IngestAdapter(PORTAL);
    const scraper = new ListingsScraper();

    /**
     * Streaming callback: called after each commission bucket is fetched.
     * Transforms estates and sends them to the ingest API in chunks of BATCH_SIZE.
     */
    const streamBatch = async (batch: ScrapeResult[]) => {
      batchNum++;

      const properties = batch
        .map(result => {
          try {
            const transformed = transformKrogsveenEstate(result.estate);
            return {
              portalId: `krogsveen-no-${result.estate.id}`,
              data: transformed,
              rawData: result.estate,
            };
          } catch (error: any) {
            totalErrors++;
            log.error(
              { estateId: result.estate.id, err: error.message },
              'Error transforming estate'
            );
            return null;
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      totalTransformed += properties.length;

      // Chunk into BATCH_SIZE per API call
      for (let i = 0; i < properties.length; i += BATCH_SIZE) {
        const chunk = properties.slice(i, i + BATCH_SIZE);
        log.info(
          {
            batch: batchNum,
            chunk: Math.floor(i / BATCH_SIZE) + 1,
            size: chunk.length,
            totalSent,
          },
          'Streaming batch to ingest'
        );
        await adapter.sendProperties(chunk, runId ?? undefined);
        totalSent += chunk.length;
      }
    };

    const allResults = await scraper.scrapeAll(streamBatch);

    if (allResults.length === 0) {
      log.warn('No listings found — check Krogsveen GraphQL API');
      await tracker.complete({ listings_found: 0, listings_new: 0, listings_updated: 0 });
      scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
      return;
    }

    await tracker.complete({
      listings_found: allResults.length,
      listings_new: totalSent,
      listings_updated: 0,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc(
      { portal: PORTAL, category: 'all', result: 'success' },
      allResults.length
    );
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info(
      {
        durationSec: durationSec.toFixed(2),
        total: allResults.length,
        transformed: totalTransformed,
        sent: totalSent,
        errors: totalErrors,
      },
      'Scrape completed'
    );
  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error }, 'Scrape failed');
    throw error;
  }
}

// Start HTTP server
app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'krogsveen.no scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
