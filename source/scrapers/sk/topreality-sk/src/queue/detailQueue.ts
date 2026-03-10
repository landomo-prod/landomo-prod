import { Queue, Worker, Job } from 'bullmq';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { transformTopRealityToStandard } from '../transformers';
import { IngestAdapter } from '../adapters/ingestAdapter';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export interface DetailJob {
  listing: any; // TopRealityListing (partial from list page)
  checksumStatus: 'new' | 'changed' | 'unchanged';
}

export const detailQueue = new Queue('topreality-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500, age: 3600 },
    removeOnFail: { count: 200, age: 7200 },
  },
});

// Batch accumulator
let batch: any[] = [];
const BATCH_SIZE = 50;
const adapter = new IngestAdapter('topreality-sk');

async function flushBatch() {
  if (batch.length === 0) return;
  const toSend = batch.splice(0);
  try {
    await adapter.sendProperties(toSend);
    console.log(JSON.stringify({ level: 'info', service: 'topreality-sk-scraper', msg: 'Batch sent to ingest', count: toSend.length }));
  } catch (err: any) {
    console.error(JSON.stringify({ level: 'error', service: 'topreality-sk-scraper', msg: 'Batch send failed', err: err.message }));
  }
}

export function createDetailWorker(concurrency = 15) {
  const scraper = new ListingsScraper();

  const worker = new Worker<DetailJob>(
    'topreality-details',
    async (job: Job<DetailJob>) => {
      const { listing, checksumStatus } = job.data;

      // For unchanged listings we still ingest list-page data (no detail fetch)
      if (checksumStatus === 'unchanged') {
        try {
          const transformed = transformTopRealityToStandard(listing);
          batch.push({ portalId: listing.id, data: transformed as any, rawData: listing });
          if (batch.length >= BATCH_SIZE) await flushBatch();
        } catch { /* non-fatal */ }
        return { skipped: true };
      }

      // Fetch detail for new/changed
      try {
        if (listing.url) {
          const detail = await scraper.fetchListingDetail(listing.url);
          if (detail) {
            const enriched = scraper.enrichListingFromDetail(listing, detail);
            const transformed = transformTopRealityToStandard(enriched);
            batch.push({ portalId: listing.id, data: transformed as any, rawData: enriched });
          } else {
            const transformed = transformTopRealityToStandard(listing);
            batch.push({ portalId: listing.id, data: transformed as any, rawData: listing });
          }
        } else {
          const transformed = transformTopRealityToStandard(listing);
          batch.push({ portalId: listing.id, data: transformed as any, rawData: listing });
        }
        if (batch.length >= BATCH_SIZE) await flushBatch();
        return { success: true };
      } catch (err: any) {
        throw err; // trigger retry
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 120000,
      lockRenewTime: 60000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'topreality-sk-scraper', msg: 'Job failed', id: job?.data?.listing?.id, err: err.message }));
  });

  worker.on('closing', async () => await flushBatch());

  setInterval(async () => { if (batch.length > 0) await flushBatch(); }, 5000);

  return worker;
}

export async function flushRemainingBatch() {
  await flushBatch();
}

export async function addDetailJobs(listings: any[], checksumStatus: 'new' | 'changed' | 'unchanged') {
  const jobs = listings.map(listing => ({
    name: `detail-${listing.id}`,
    data: { listing, checksumStatus } as DetailJob,
  }));
  await detailQueue.addBulk(jobs);
}

export async function getQueueStats() {
  return {
    waiting: await detailQueue.getWaitingCount(),
    active: await detailQueue.getActiveCount(),
    completed: await detailQueue.getCompletedCount(),
    failed: await detailQueue.getFailedCount(),
  };
}
