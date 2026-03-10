import { Queue, Worker, Job } from 'bullmq';
import { fetchDetailPage } from '../utils/fetchData';
import { transformHabitacliaToStandard } from '../transformers/habitacliaTransformer';
import { IngestAdapter, PropertyPayload } from '../adapters/ingestAdapter';
import { HabitacliaListingRaw } from '../types/habitacliaTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('habitaclia-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  listing: HabitacliaListingRaw;
}

let batch: PropertyPayload[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('habitaclia');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Failed to send batch', err: (error as any)?.message }));
  }
}

export function createDetailWorker(concurrency: number = 40) {
  const worker = new Worker<DetailJob>(
    'habitaclia-details',
    async (job: Job<DetailJob>) => {
      const { listing } = job.data;

      try {
        const detailResult = await fetchDetailPage(listing);

        if (detailResult.isInactive) {
          return { skipped: true, reason: detailResult.inactiveReason };
        }

        const standardData = transformHabitacliaToStandard(detailResult.data);

        batch.push({
          portalId: `habitaclia-${listing.id}`,
          data: standardData,
          rawData: detailResult.data,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id: listing.id };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Failed to process listing', id: listing.id, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 300000,
      lockRenewTime: 150000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Job failed', id: job?.data?.listing?.id, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Worker error', err: err?.message }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  setInterval(async () => {
    if (batch.length > 0) await flushBatch();
  }, 5000);

  return worker;
}

export async function addDetailJobs(listings: HabitacliaListingRaw[]) {
  const bulkJobs = listings.map(listing => ({
    name: `detail-${listing.id}`,
    data: { listing },
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Queued detail jobs', count: listings.length }));
}

export async function getQueueStats() {
  return {
    waiting: await detailQueue.getWaitingCount(),
    active: await detailQueue.getActiveCount(),
    completed: await detailQueue.getCompletedCount(),
    failed: await detailQueue.getFailedCount(),
  };
}
