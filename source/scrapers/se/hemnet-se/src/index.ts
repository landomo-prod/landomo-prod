import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { ListingsScraper } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformHemnetListing } from './transformers';
import { HemnetListing } from './types/hemnetTypes';

const app = express();
const PORT = parseInt(process.env.PORT || '8220', 10);
const PORTAL = 'hemnet';
const COUNTRY = 'sweden';

const log = createLogger({ service: 'hemnet-scraper', portal: PORTAL, country: COUNTRY });

app.use(express.json());

setupScraperMetrics(app as any, PORTAL);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Scrape trigger endpoint - returns immediately, runs async
app.post('/scrape', (_req, res) => {
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

  log.info('Starting Hemnet scrape');

  try {
    const adapter = new IngestAdapter(PORTAL);
    const scraper = new ListingsScraper();

    let totalSent = 0;
    let totalTransformed = 0;
    let batchNum = 0;

    // Chunk size for ingest API calls
    const CHUNK_SIZE = parseInt(process.env.INGEST_CHUNK_SIZE || '500', 10);

    const handleBatch = async (batch: HemnetListing[]): Promise<void> => {
      batchNum++;

      const properties = batch
        .map(listing => {
          try {
            const transformed = transformHemnetListing(listing);
            return { portalId: `hemnet-${listing.id}`, data: transformed, rawData: listing };
          } catch (error: any) {
            log.error({ listingId: listing.id, err: error }, 'Error transforming listing');
            return null;
          }
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      totalTransformed += properties.length;

      // Send in chunks to stay under API limits
      for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
        const chunk = properties.slice(i, i + CHUNK_SIZE);
        log.info(
          { batch: batchNum, chunk: Math.floor(i / CHUNK_SIZE) + 1, size: chunk.length, totalSent },
          'Sending chunk to ingest'
        );
        await adapter.sendProperties(chunk, runId ?? undefined);
        totalSent += chunk.length;
      }
    };

    const stats = await scraper.scrapeAll(handleBatch);

    await tracker.complete({
      listings_found: stats.scraped,
      listings_new: totalSent,
      listings_updated: 0,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc(
      { portal: PORTAL, category: 'all', result: 'success' },
      stats.scraped
    );
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info(
      {
        durationSec: durationSec.toFixed(2),
        scraped: stats.scraped,
        transformed: totalTransformed,
        sent: totalSent,
        byGroup: stats.byGroup,
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
  log.info({ port: PORT }, 'Hemnet scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
