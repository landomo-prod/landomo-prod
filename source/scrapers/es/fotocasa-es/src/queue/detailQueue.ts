import { Queue, Worker, Job } from 'bullmq';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { fotocasaRateLimiter } from '../utils/rateLimiter';
import { transformFotocasaToStandard } from '../transformers/fotocasaTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { FotocasaListing } from '../types/fotocasaTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('fotocasa-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 3600,
    },
    removeOnFail: {
      count: 500,
      age: 7200,
    },
  },
});

export interface DetailJob {
  listing: FotocasaListing;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('fotocasa');

async function flushBatch() {
  if (batch.length === 0) return;

  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'fotocasa-scraper', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

/**
 * Create worker to process listings through transformation and ingestion
 * Fotocasa search API provides enough data, so no detail fetch needed
 */
export function createDetailWorker(concurrency: number = 75) {
  const worker = new Worker<DetailJob>(
    'fotocasa-details',
    async (job: Job<DetailJob>) => {
      const { listing } = job.data;

      try {
        // Transform to TierI type
        const standardData = transformFotocasaToStandard(listing);

        // Add to batch
        batch.push({
          portalId: `fotocasa-${listing.id}`,
          data: standardData,
          rawData: listing,
        });

        // Flush batch if full
        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id: listing.id };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'fotocasa-scraper', msg: 'Failed to process listing', id: listing.id, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 60000,
      lockRenewTime: 30000,
    },
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'fotocasa-scraper', msg: 'Job failed', id: job?.data?.listing?.id, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'fotocasa-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Flushing remaining batch before shutdown' }));
    await flushBatch();
  });

  // Periodic flush every 5 seconds
  setInterval(async () => {
    if (batch.length > 0) {
      await flushBatch();
    }
  }, 5000);

  return worker;
}

export async function addDetailJobs(listings: FotocasaListing[]) {
  const bulkJobs = listings.map(listing => ({
    name: `detail-${listing.id}`,
    data: { listing },
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'fotocasa-scraper', msg: 'Queued detail jobs', count: listings.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
