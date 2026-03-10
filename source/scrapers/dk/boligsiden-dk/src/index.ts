import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { scrapeAll } from './scrapers/listingsScraper';
import { IngestAdapter, PropertyPayload } from './adapters/ingestAdapter';
import { transformBoligsidenToStandard } from './transformers';
import { BoligsidenCase } from './types/boligsidenTypes';

const app = express();
const PORT = parseInt(process.env.PORT || '8200', 10);
const PORTAL = 'boligsiden-dk';
const BATCH_SIZE = 500;

const log = createLogger({ service: 'boligsiden-scraper', portal: PORTAL, country: 'denmark' });

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

/**
 * Main scraper function
 *
 * Uses streaming mode: transform and ingest in batches of 500 as pages come in,
 * instead of loading everything into memory first.
 */
async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ mode: 'streaming' }, 'Starting Boligsiden scrape');

  const adapter = new IngestAdapter(PORTAL);
  let totalFound = 0;
  let totalTransformed = 0;
  let totalSent = 0;
  let pendingBatch: PropertyPayload[] = [];

  try {
    const flushBatch = async (force = false): Promise<void> => {
      if (pendingBatch.length === 0) return;
      if (!force && pendingBatch.length < BATCH_SIZE) return;

      const toSend = pendingBatch.splice(0, BATCH_SIZE);
      log.info({ count: toSend.length, totalSent }, 'Sending batch to ingest');

      await adapter.sendProperties(toSend, runId ?? undefined);
      totalSent += toSend.length;
    };

    const streamBatch = async (cases: BoligsidenCase[]): Promise<void> => {
      totalFound += cases.length;

      for (const listing of cases) {
        try {
          const transformed = transformBoligsidenToStandard(listing);
          pendingBatch.push({
            portalId: `boligsiden-${listing.caseID}`,
            data: transformed,
            rawData: listing,
          });
          totalTransformed++;
        } catch (err: any) {
          log.error({ caseID: listing.caseID, addressType: listing.addressType, err: err.message }, 'Transform failed');
        }
      }

      // Flush complete batches
      while (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    };

    await scrapeAll(streamBatch);

    // Flush remaining listings
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
  log.info({ port: PORT }, 'Boligsiden scraper running');
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
