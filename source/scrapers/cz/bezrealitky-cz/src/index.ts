import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { ListingsScraper, scrapeWithChecksums } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformBezRealitkyToStandard } from './transformers';

const app = express();
const PORT = parseInt(process.env.PORT || '8102', 10);
const PORTAL = 'bezrealitky';
const ENABLE_CHECKSUM_MODE = process.env.ENABLE_CHECKSUM_MODE === 'true';

const log = createLogger({ service: 'bezrealitky-scraper', portal: PORTAL, country: 'czech_republic' });

// JSON body parser
app.use(express.json());

// Prometheus metrics endpoint + request tracking
setupScraperMetrics(app as any, PORTAL);

let scrapeRunning = false;

const VALID_CATEGORIES = ['apartment', 'house', 'land', 'commercial'];

function parseCategoryFilter(input: any): string[] | undefined {
  if (!input || !Array.isArray(input) || input.length === 0) return undefined;
  const valid = input.filter((c: any) => typeof c === 'string' && VALID_CATEGORIES.includes(c));
  return valid.length > 0 ? valid : undefined;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '2.0.0-checksum',
    checksumMode: ENABLE_CHECKSUM_MODE,
    timestamp: new Date().toISOString()
  });
});

// Scrape trigger endpoint
app.post('/scrape', async (req, res) => {
  if (scrapeRunning) {
    res.status(409).json({ status: 'scrape already running', timestamp: new Date().toISOString() });
    return;
  }

  const categories = parseCategoryFilter(req.body?.categories);
  scrapeRunning = true;
  res.status(202).json({ status: 'scraping started', categories: categories || 'all', timestamp: new Date().toISOString() });

  runScraper(categories).catch(error => {
    log.error({ err: error }, 'Scraping failed');
  }).finally(() => {
    scrapeRunning = false;
  });
});

/**
 * Main scraper logic
 */
async function runScraper(categories?: string[]) {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);
  log.info({ mode: ENABLE_CHECKSUM_MODE ? 'checksum' : 'legacy', categories: categories || 'all' }, 'Starting BezRealitky scrape');

  try {
    const adapter = new IngestAdapter(PORTAL);
    let listings;
    let stats;

    if (ENABLE_CHECKSUM_MODE) {
      log.info('Checksum mode: Fetching and comparing checksums');
      const ingestApiUrl = process.env.INGEST_API_URL || 'http://ingest-czech:3000';
      const ingestApiKey = process.env.INGEST_API_KEY || '';

      const result = await scrapeWithChecksums(ingestApiUrl, ingestApiKey, runId ?? undefined, categories);
      listings = result.listings;
      stats = result.stats;
      const { checksums: allChecksums, checksumClient } = result;

      // Build a map from portalId → checksum for fast lookup during ingest
      const checksumByPortalId = new Map(allChecksums.map(c => [c.portalId, c]));

      log.info({ total: stats.total, new: stats.new, changed: stats.changed, unchanged: stats.unchanged, savingsPercent: stats.savingsPercent }, 'Checksum results');

      // Ingest filtered listings and save checksums only after each successful batch
      if (listings.length > 0) {
        const CHUNK_SIZE = 2000;
        const usableListings = listings.filter(listing => {
          if (!listing.price && !listing.surface && !listing.surfaceLand) {
            return false;
          }
          return true;
        });

        const properties = usableListings.map(listing => {
          try {
            const transformedData = transformBezRealitkyToStandard(listing);
            return { portalId: listing.id, data: transformedData, rawData: listing };
          } catch (error: any) {
            log.error({ listingId: listing.id, err: error }, 'Error transforming listing in checksum mode');
            return null;
          }
        }).filter(p => p !== null) as any[];

        let totalSent = 0;
        for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
          const chunk = properties.slice(i, i + CHUNK_SIZE);
          log.info({ chunk: Math.floor(i / CHUNK_SIZE) + 1, size: chunk.length, totalSent }, 'Sending checksum-filtered batch to ingest');

          // Send to ingest — throws on failure, so checksums are only saved on success
          await adapter.sendProperties(chunk, runId ?? undefined);
          totalSent += chunk.length;

          // Save checksums only for this successfully ingested batch
          const batchChecksums = chunk
            .map(p => checksumByPortalId.get(p.portalId))
            .filter((c): c is NonNullable<typeof c> => c !== undefined);

          if (batchChecksums.length > 0) {
            try {
              await checksumClient.updateChecksums(batchChecksums, runId ?? undefined);
              log.info({ count: batchChecksums.length }, 'Checksums saved for ingested batch');
            } catch (checksumErr: any) {
              // Log but don't fail the scrape — next run will re-detect these as changed
              log.error({ err: checksumErr }, 'Failed to save checksums for batch (non-fatal)');
            }
          }
        }

        log.info({ total: properties.length, sent: totalSent }, 'Checksum-mode ingest complete');
      }
    } else {
      log.info('Streaming mode: scraping and sending as we go');
      const scraper = new ListingsScraper();
      let totalSent = 0;
      let totalTransformed = 0;
      let batchNum = 0;

      const streamBatch = async (batch: any[]) => {
        batchNum++;
        // Filter out listings with no useful data (price=0 AND surface=0)
        // These are typically REKREACNI_OBJEKT rentals with "Cena k jednání" (price negotiable)
        const usableBatch = batch.filter(listing => {
          if (!listing.price && !listing.surface && !listing.surfaceLand) {
            return false;
          }
          return true;
        });
        const properties = usableBatch.map(listing => {
          try {
            const transformedData = transformBezRealitkyToStandard(listing);
            return { portalId: listing.id, data: transformedData, rawData: listing };
          } catch (error: any) {
            log.error({ listingId: listing.id, err: error }, 'Error transforming listing');
            return null;
          }
        }).filter(p => p !== null) as any[];

        totalTransformed += properties.length;

        if (properties.length > 0) {
          // Chunk into max 2000 per API call to stay under 5000 limit
          const CHUNK_SIZE = 2000;
          for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
            const chunk = properties.slice(i, i + CHUNK_SIZE);
            log.info({ batch: batchNum, chunk: Math.floor(i / CHUNK_SIZE) + 1, size: chunk.length, totalSent }, 'Streaming batch to ingest');
            await adapter.sendProperties(chunk);
            totalSent += chunk.length;
          }
        }
      };

      listings = await scraper.scrapeAll(streamBatch, categories);
      stats = { total: listings.length, new: listings.length, changed: 0, unchanged: 0, savingsPercent: 0 };

      log.info({ total: listings.length, transformed: totalTransformed, sent: totalSent }, 'Streaming scrape complete');
    }

    if (listings.length === 0) {
      log.info('No listings to process');
      await tracker.complete({ listings_found: stats.total, listings_new: stats.new, listings_updated: stats.changed });
      return;
    }

    await tracker.complete({ listings_found: stats.total, listings_new: stats.new, listings_updated: stats.changed });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, listings.length);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.info({
      durationSec: durationSec.toFixed(2),
      total: stats.total,
      new: stats.new,
      changed: stats.changed,
      unchanged: stats.unchanged,
      ...(ENABLE_CHECKSUM_MODE ? { savingsPercent: stats.savingsPercent } : {}),
    }, 'Scrape completed');

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
  log.info({ port: PORT, mode: ENABLE_CHECKSUM_MODE ? 'checksum' : 'legacy' }, 'BezRealitky scraper running');
});

let shuttingDown = false;

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  shuttingDown = true;
  // Allow current batch to finish, then exit
  setTimeout(() => {
    log.info('Shutdown timeout reached, forcing exit');
    process.exit(0);
  }, 30000);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  shuttingDown = true;
  setTimeout(() => {
    process.exit(0);
  }, 30000);
});
