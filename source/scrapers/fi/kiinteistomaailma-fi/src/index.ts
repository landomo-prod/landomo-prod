import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { ListingsScraper } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformKMListing } from './transformers';
import { KMListing } from './types/kiinteistomaailmaTypes';

const app = express();
const PORT = parseInt(process.env.PORT || '8234', 10);
const PORTAL = 'kiinteistomaailma-fi';

const log = createLogger({ service: 'kiinteistomaailma-fi-scraper', portal: PORTAL, country: 'finland' });

app.use(express.json());

// Prometheus metrics + request tracking
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
 * Main scraper logic.
 *
 * Flow:
 * 1. Fetch all listings page by page from the public Kiinteistömaailma REST API
 * 2. Stream each batch: transform → send to ingest service
 * 3. Covers both for-sale (~6,278) and rental (~418) listings
 * 4. Track scrape run metrics
 *
 * API endpoint: GET https://www.kiinteistomaailma.fi/api/km/KM/
 * No authentication required.
 *
 * Expected runtime: 2-5 minutes
 */
async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  log.info('Starting Kiinteistömaailma.fi scrape');

  try {
    const adapter = new IngestAdapter(PORTAL);
    const scraper = new ListingsScraper();

    let totalSent = 0;
    let totalTransformed = 0;
    let totalFailed = 0;
    let batchNum = 0;

    const CHUNK_SIZE = 500; // Max properties per ingest API call

    const streamBatch = async (batch: KMListing[]) => {
      batchNum++;

      const properties: Array<{ portalId: string; data: any; rawData: any }> = [];

      for (const listing of batch) {
        try {
          const transformed = transformKMListing(listing);
          properties.push({
            portalId: `kiinteistomaailma-${listing.key}`,
            data: transformed,
            rawData: listing,
          });
        } catch (err: any) {
          totalFailed++;
          log.error({ key: listing.key, type: listing.type, err: err.message }, 'Transform failed');
        }
      }

      totalTransformed += properties.length;

      if (properties.length === 0) return;

      // Chunk into max CHUNK_SIZE per API call
      for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
        const chunk = properties.slice(i, i + CHUNK_SIZE);
        log.info(
          { batch: batchNum, chunk: Math.floor(i / CHUNK_SIZE) + 1, size: chunk.length, totalSent },
          'Streaming batch to ingest'
        );
        await adapter.sendProperties(chunk, runId ?? undefined);
        totalSent += chunk.length;
      }
    };

    await scraper.scrapeAll(streamBatch);

    await tracker.complete({
      listings_found: totalTransformed + totalFailed,
      listings_new: totalSent,
      listings_updated: 0,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc(
      { portal: PORTAL, category: 'all', result: 'success' },
      totalSent
    );
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info(
      {
        durationSec: durationSec.toFixed(2),
        totalTransformed,
        totalSent,
        totalFailed,
      },
      'Scrape completed successfully'
    );
  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error }, 'Scrape failed');
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'Kiinteistömaailma.fi scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
