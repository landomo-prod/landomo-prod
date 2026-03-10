import express from 'express';
import { ScrapeRunTracker, ChecksumClient } from '@landomo/core';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformTopRealityToStandard } from './transformers';
import { TopRealityListing } from './types/toprealityTypes';
import { ListingsScraper } from './scrapers/listingsScraper';
import { createDetailWorker, detailQueue, addDetailJobs, getQueueStats, flushRemainingBatch } from './queue/detailQueue';
import { scrapeAllStreaming } from './scrapers/listingsScraper';
import { batchCreateTopRealityChecksums } from './utils/checksumExtractor';

const app = express();
const PORT = process.env.PORT || 8085;
const PORTAL = 'topreality-sk';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '15');

// Start detail workers immediately
const workers = createDetailWorker(WORKER_CONCURRENCY);

app.use(express.json());

app.get('/health', async (req, res) => {
  let queueStats = {};
  try {
    queueStats = await getQueueStats();
  } catch { /* non-fatal */ }

  res.json({
    status: 'healthy',
    scraper: PORTAL,
    version: '3.0.0',
    features: {
      bullmq_queue: true,
      streaming_scrape: true,
      checksum_mode: true,
      category_routing: true,
      partitions: ['apartment', 'house', 'land']
    },
    queue: queueStats,
    timestamp: new Date().toISOString()
  });
});

app.post('/scrape', async (req, res) => {
  res.status(202).json({
    status: 'scraping started',
    timestamp: new Date().toISOString()
  });

  runScraper().catch(error => {
    console.error('Scraping failed:', error);
  });
});

async function runScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();

  const ingestApiUrl = process.env.INGEST_API_URL || 'http://ingest-slovakia:3000';
  const ingestApiKey = (process.env.INGEST_API_KEY || '').split(',')[0].trim();
  const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);

  console.log(`\n[${new Date().toISOString()}] Starting TopReality.sk scrape (streaming + BullMQ)...`);

  try {
    // Clear stale jobs from previous runs
    await detailQueue.drain();

    let totalSeen = 0, totalNew = 0, totalChanged = 0, totalUnchanged = 0;

    // Phase 1+2 streaming: scrape pages → immediately checksum compare → queue detail jobs
    await scrapeAllStreaming(async (pageListings) => {
      if (pageListings.length === 0) return;
      totalSeen += pageListings.length;

      const checksums = batchCreateTopRealityChecksums(pageListings);
      const comparison = await checksumClient.compareChecksums(checksums, runId ?? undefined);

      const byStatus: { new: any[]; changed: any[]; unchanged: any[] } = { new: [], changed: [], unchanged: [] };
      for (const r of comparison.results) {
        const listing = pageListings.find(l => String(l.id) === r.portalId);
        if (listing) byStatus[r.status as 'new' | 'changed' | 'unchanged'].push(listing);
      }

      totalNew += byStatus.new.length;
      totalChanged += byStatus.changed.length;
      totalUnchanged += byStatus.unchanged.length;

      // Update checksums for ALL seen listings immediately so that duplicate
      // listings across concurrent combos are detected as 'unchanged' on
      // subsequent pages/combos and not re-queued.
      try {
        await checksumClient.updateChecksums(checksums, runId ?? undefined);
      } catch (err: any) {
        console.warn(`Failed to update checksums for page batch: ${err.message}`);
      }

      // Queue new/changed for detail fetch + ingest
      if (byStatus.new.length > 0) await addDetailJobs(byStatus.new, 'new');
      if (byStatus.changed.length > 0) await addDetailJobs(byStatus.changed, 'changed');
    }, parseInt(process.env.CATEGORY_CONCURRENCY || '8'));

    console.log(`\nPhase 1 complete: seen=${totalSeen} new=${totalNew} changed=${totalChanged} unchanged=${totalUnchanged}`);
    console.log('Waiting for detail workers to drain queue...');

    // Wait for all detail jobs to complete
    let lastRemaining = -1;
    while (true) {
      const stats = await getQueueStats();
      const remaining = stats.waiting + stats.active;
      if (remaining !== lastRemaining) {
        console.log(JSON.stringify({ level: 'info', service: 'topreality-sk-scraper', msg: 'Queue progress', ...stats }));
        lastRemaining = remaining;
      }
      if (remaining === 0) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    // Flush any residual items in the batch accumulator (< BATCH_SIZE threshold)
    await flushRemainingBatch();

    await tracker.complete({ listings_found: totalSeen, listings_new: totalNew, listings_updated: totalChanged });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nScrape completed in ${duration}s | seen=${totalSeen} new=${totalNew} changed=${totalChanged} unchanged=${totalUnchanged}`);

  } catch (err: any) {
    await tracker.fail();
    console.error('Scrape failed:', err.message);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

// Scrape detail endpoint: fetch and re-ingest specific listings by URL
app.post('/scrape-detail', async (req, res) => {
  const { urls = [], concurrency = 5 } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array required' });
  }

  let succeeded = 0, failed = 0;
  const errors: string[] = [];
  const adapter = new IngestAdapter(PORTAL);
  const scraper = new ListingsScraper();

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(async (url: string) => {
      try {
        const detail = await scraper.fetchListingDetail(url);
        if (!detail) throw new Error('Detail fetch returned null');

        const idMatch = url.match(/\/([^\/]+)\/?$/);
        const id = idMatch ? idMatch[1] : url;
        const baseListing = { id, url, title: '', price: 0, currency: '€', location: '', propertyType: 'byty', transactionType: 'predaj' } as unknown as TopRealityListing;
        const enriched = scraper.enrichListingFromDetail(baseListing, detail);
        const transformed = transformTopRealityToStandard(enriched);

        await adapter.sendProperties([{ portalId: id, data: transformed, rawData: enriched }]);
        succeeded++;
      } catch (e: any) {
        failed++;
        errors.push(`${url}: ${e.message}`);
      }
    }));
    if (i + concurrency < urls.length) await new Promise(r => setTimeout(r, 300));
  }

  res.json({ processed: urls.length, succeeded, failed, errors: errors.slice(0, 20) });
});

app.listen(PORT, () => {
  console.log(`\nTopReality.sk scraper running`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Trigger: POST http://localhost:${PORT}/scrape`);
  console.log(`   Worker concurrency: ${WORKER_CONCURRENCY}`);
  console.log(`\nWaiting for scrape triggers...\n`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  try {
    await workers.close();
    await detailQueue.close();
  } catch { /* non-fatal */ }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  try {
    await workers.close();
    await detailQueue.close();
  } catch { /* non-fatal */ }
  process.exit(0);
});
