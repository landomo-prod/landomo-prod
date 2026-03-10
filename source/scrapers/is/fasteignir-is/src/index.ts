import express from 'express';
import { ScrapeRunTracker } from '@landomo/core';
import { scrapeAll, RawProperty } from './scrapers/listingsScraper';
import { IngestAdapter, PropertyPayload } from './adapters/ingestAdapter';
import { transformToTierI } from './transformers';

const app = express();
const PORT = parseInt(process.env.PORT || '8300', 10);
const PORTAL = 'fasteignir-is';
const BATCH_SIZE = 100;

function log(level: string, msg: string, extra?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, service: 'fasteignir-scraper', portal: PORTAL, msg, ...extra }));
}

app.use(express.json());

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
    log('error', 'Scraping failed', { err: err.message });
  });
});

async function runScraper(): Promise<void> {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  log('info', 'Starting fasteignir.visir.is scrape');

  const adapter = new IngestAdapter(PORTAL);
  let totalFound = 0;
  let totalTransformed = 0;
  let totalSent = 0;
  let pendingBatch: PropertyPayload[] = [];

  const flushBatch = async (force = false): Promise<void> => {
    if (pendingBatch.length === 0) return;
    if (!force && pendingBatch.length < BATCH_SIZE) return;

    const toSend = pendingBatch.splice(0, BATCH_SIZE);
    log('info', 'Sending batch to ingest', { count: toSend.length, totalSent });
    await adapter.sendProperties(toSend, runId ?? undefined);
    totalSent += toSend.length;
  };

  try {
    const onBatch = async (properties: RawProperty[]): Promise<void> => {
      totalFound += properties.length;

      for (const raw of properties) {
        try {
          const transformed = transformToTierI(raw, raw.category);
          pendingBatch.push({
            portalId: `fasteignir-${raw.id}`,
            data: transformed,
            rawData: raw,
          });
          totalTransformed++;
        } catch (err: any) {
          log('error', 'Transform failed', { id: raw.id, err: err.message });
        }
      }

      while (pendingBatch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    };

    await scrapeAll(onBatch);

    // Flush remaining
    if (pendingBatch.length > 0) {
      log('info', 'Flushing remaining batch', { count: pendingBatch.length });
      const remaining = [...pendingBatch];
      pendingBatch = [];

      for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        await adapter.sendProperties(remaining.slice(i, i + BATCH_SIZE), runId ?? undefined);
        totalSent += Math.min(BATCH_SIZE, remaining.length - i);
      }
    }

    await tracker.complete({
      listings_found: totalFound,
      listings_new: totalTransformed,
      listings_updated: 0,
    });

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    log('info', 'Scrape completed successfully', {
      durationSec,
      totalFound,
      totalTransformed,
      totalSent,
    });
  } catch (err: any) {
    await tracker.fail();
    log('error', 'Scrape failed', { err: err.message });
    throw err;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  log('info', `Fasteignir scraper running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  process.exit(0);
});
