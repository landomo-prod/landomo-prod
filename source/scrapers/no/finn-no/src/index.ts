import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { ListingsScraper, ScrapeResult } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformFinnListing } from './transformers';

const app = express();
const PORT = parseInt(process.env.PORT || '8210', 10);
const PORTAL = 'finn-no';

const log = createLogger({ service: 'finn-no-scraper', portal: PORTAL, country: 'norway' });

// JSON body parser
app.use(express.json());

// Prometheus metrics endpoint + request tracking
setupScraperMetrics(app as any, PORTAL);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Scrape trigger endpoint
app.post('/scrape', async (req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });

  runScraper().catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

/**
 * Main scraper logic
 */
async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info('Starting finn.no scrape');

  let totalTransformed = 0;
  let totalSent = 0;
  let batchNum = 0;

  try {
    const adapter = new IngestAdapter(PORTAL);
    const scraper = new ListingsScraper();

    const streamBatch = async (batch: ScrapeResult[]) => {
      batchNum++;

      const properties = batch
        .map(result => {
          try {
            const transformed = transformFinnListing(result.listing, result.offerType);
            return {
              portalId: `finn-no-${result.listing.ad_id}`,
              data: transformed,
              rawData: result.listing,
            };
          } catch (error: any) {
            log.error(
              { listingId: result.listing.ad_id, err: error },
              'Error transforming listing'
            );
            return null;
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      totalTransformed += properties.length;

      if (properties.length > 0) {
        // Chunk into max 2000 per API call
        const CHUNK_SIZE = 2000;
        for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
          const chunk = properties.slice(i, i + CHUNK_SIZE);
          log.info(
            {
              batch: batchNum,
              chunk: Math.floor(i / CHUNK_SIZE) + 1,
              size: chunk.length,
              totalSent,
            },
            'Streaming batch to ingest'
          );
          await adapter.sendProperties(chunk, runId ?? undefined);
          totalSent += chunk.length;
        }
      }
    };

    const allResults = await scraper.scrapeAll(streamBatch);

    if (allResults.length === 0) {
      log.info('No listings found');
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'finn.no scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
