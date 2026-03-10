import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { scrapeAll, RawListing } from './scrapers/listingsScraper';
import { IngestAdapter, PropertyPayload } from './adapters/ingestAdapter';
import { transformListing } from './transformers';

const app = express();
const PORT = parseInt(process.env.PORT || '8302', 10);
const PORTAL = 'fasteignaleitin-is';
const BATCH_SIZE = 100;
const SERVICE = 'fasteignaleitin-scraper';

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.post('/scrape', (_req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });

  runScraper().catch(err => {
    console.error(JSON.stringify({
      level: 'error',
      service: SERVICE,
      msg: 'Scraping failed',
      err: err.message,
    }));
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  console.log(JSON.stringify({ level: 'info', service: SERVICE, msg: 'Starting fasteignaleitin.is scrape' }));

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
      console.log(JSON.stringify({
        level: 'info',
        service: SERVICE,
        msg: 'Sending batch to ingest',
        count: toSend.length,
        totalSent,
      }));

      await adapter.sendProperties(toSend, runId ?? undefined);
      totalSent += toSend.length;
    };

    const streamBatch = async (listings: RawListing[]): Promise<void> => {
      totalFound += listings.length;

      for (const listing of listings) {
        try {
          const transformed = transformListing(listing);
          pendingBatch.push({
            portalId: `fasteignaleitin-${listing.slug}`,
            data: transformed,
            rawData: listing,
          });
          totalTransformed++;
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error',
            service: SERVICE,
            msg: 'Transform failed',
            slug: listing.slug,
            err: err.message,
          }));
        }
      }

      while (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    };

    await scrapeAll(streamBatch);

    // Flush remaining
    if (pendingBatch.length > 0) {
      console.log(JSON.stringify({
        level: 'info',
        service: SERVICE,
        msg: 'Flushing remaining batch',
        count: pendingBatch.length,
      }));
      const remaining = [...pendingBatch];
      pendingBatch = [];

      const CHUNK_SIZE = 100;
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
    console.log(JSON.stringify({
      level: 'info',
      service: SERVICE,
      msg: 'Scrape completed successfully',
      durationSec: durationSec.toFixed(2),
      totalFound,
      totalTransformed,
      totalSent,
    }));
  } catch (err: any) {
    await tracker.fail();
    console.error(JSON.stringify({
      level: 'error',
      service: SERVICE,
      msg: 'Scrape failed',
      err: err.message,
    }));
    throw err;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    level: 'info',
    service: SERVICE,
    msg: 'fasteignaleitin-is scraper running',
    port: PORT,
  }));
});

process.on('SIGTERM', () => {
  console.log(JSON.stringify({ level: 'info', service: SERVICE, msg: 'SIGTERM received, shutting down gracefully' }));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(JSON.stringify({ level: 'info', service: SERVICE, msg: 'SIGINT received, shutting down gracefully' }));
  process.exit(0);
});
