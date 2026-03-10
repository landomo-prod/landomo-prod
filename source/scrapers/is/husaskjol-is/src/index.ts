import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { scrapeAll } from './scrapers/listingsScraper';
import { IngestAdapter, PropertyPayload } from './adapters/ingestAdapter';
import { transformListing, HusaskjolListing } from './transformers';

const app = express();
const PORT = parseInt(process.env.PORT || '8303', 10);
const PORTAL = 'husaskjol-is';
const BATCH_SIZE = 500;

const log = createLogger({ service: 'husaskjol-scraper', portal: PORTAL, country: 'iceland' });

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

  runScraper().catch(err => {
    log.error({ err }, 'Scraping failed');
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ mode: 'streaming' }, 'Starting Husaskjol scrape');

  const adapter = new IngestAdapter(PORTAL);
  let totalFound = 0;
  let totalTransformed = 0;
  let totalSent = 0;
  let pendingBatch: PropertyPayload[] = [];

  try {
    const flushBatch = async (): Promise<void> => {
      if (pendingBatch.length === 0) return;

      const toSend = pendingBatch.splice(0, BATCH_SIZE);
      log.info({ count: toSend.length, totalSent }, 'Sending batch to ingest');

      await adapter.sendProperties(toSend, runId ?? undefined);
      totalSent += toSend.length;
    };

    const flushAll = async (): Promise<void> => {
      while (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    };

    const onBatch = async (listings: HusaskjolListing[]): Promise<void> => {
      totalFound += listings.length;

      for (const listing of listings) {
        try {
          const transformed = transformListing(listing);
          const id = listing.id ?? listing.slug ?? `unknown-${totalTransformed}`;
          pendingBatch.push({
            portalId: `husaskjol-${id}`,
            data: transformed,
            rawData: listing,
          });
          totalTransformed++;
        } catch (err: any) {
          log.error(
            { id: listing.id, slug: listing.slug, err: err.message },
            'Transform failed'
          );
        }
      }

      await flushAll();
    };

    await scrapeAll(onBatch);

    // Flush remaining
    if (pendingBatch.length > 0) {
      log.info({ count: pendingBatch.length }, 'Flushing remaining batch');
      const remaining = [...pendingBatch];
      pendingBatch = [];

      const CHUNK_SIZE = 500;
      for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
        await adapter.sendProperties(remaining.slice(i, i + CHUNK_SIZE), runId ?? undefined);
        totalSent += Math.min(CHUNK_SIZE, remaining.length - i);
      }
    }

    await tracker.complete({
      listings_found: totalFound,
      listings_new: totalTransformed,
      listings_updated: 0,
    });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, totalSent);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });

    log.info(
      {
        durationSec: durationSec.toFixed(2),
        totalFound,
        totalTransformed,
        totalSent,
      },
      'Scrape completed successfully'
    );
  } catch (err: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    log.error({ err }, 'Scrape failed');
    throw err;
  } finally {
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'Husaskjol scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
