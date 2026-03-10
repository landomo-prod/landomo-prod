import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { ListingsScraper } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformVuokrauviListing } from './transformers';
import { VuokrauviAnnouncement } from './types/vuokrauviTypes';

const app = express();
const PORT = parseInt(process.env.PORT || '8232', 10);
const PORTAL = 'vuokraovi-fi';

const log = createLogger({ service: 'vuokraovi-scraper', portal: PORTAL, country: 'finland' });

app.use(express.json());
setupScraperMetrics(app as any, PORTAL);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', async (_req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });

  runScraper().catch(error => {
    log.error({ err: error }, 'Scraping failed');
  });
});

/**
 * Main scraper logic - streams listings to ingest API as they are fetched.
 *
 * Vuokraovi.com is a pure rental portal with ~30,000 RESIDENTIAL listings.
 * API: https://api.vuokraovi.com/distant/swordsman/v3
 * Auth: No auth required, only X-PORTAL-IDENTIFIER: VUOKRAOVI header.
 *
 * All listings are listing_type: 'rent'.
 * Property categories: apartment (APARTMENT_HOUSE, LOFT_HOUSE, WOODEN_HOUSE, OTHER)
 *                      house (ROW_HOUSE, SEMI_DETACHED, DETACHED_HOUSE)
 */
async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  log.info('Starting Vuokraovi scrape');

  try {
    const adapter = new IngestAdapter(PORTAL);
    const scraper = new ListingsScraper();

    let totalSent = 0;
    let totalTransformed = 0;
    let totalListings = 0;
    let batchNum = 0;

    const CHUNK_SIZE = 500;

    const streamBatch = async (batch: VuokrauviAnnouncement[]) => {
      batchNum++;
      totalListings += batch.length;

      const properties = batch.map(announcement => {
        try {
          const transformed = transformVuokrauviListing(announcement);
          return {
            portalId: `vuokraovi-${announcement.id}`,
            data: transformed,
            rawData: announcement,
          };
        } catch (error: any) {
          log.error(
            { announcementId: announcement.id, friendlyId: announcement.friendlyId, err: error },
            'Error transforming listing'
          );
          return null;
        }
      }).filter((p): p is NonNullable<typeof p> => p !== null);

      totalTransformed += properties.length;

      if (properties.length === 0) return;

      // Chunk into max CHUNK_SIZE per API call to avoid payload limits
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
      listings_found: totalListings,
      listings_new: totalTransformed,
      listings_updated: 0,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, totalTransformed);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);

    log.info({
      durationSec: durationSec.toFixed(2),
      totalListings,
      totalTransformed,
      totalSent,
    }, 'Scrape completed');

  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error }, 'Scrape failed');
    throw error;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'Vuokraovi scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
