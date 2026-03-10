import { Queue, Worker, Job } from 'bullmq';
import { fetchDetailPage } from '../utils/fetchData';
import { transformEnalquilerToStandard } from '../transformers/enalquilerTransformer';
import { IngestAdapter, PropertyPayload } from '../adapters/ingestAdapter';
import { EnalquilerListingRaw } from '../types/enalquilerTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('enalquiler-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  listing: EnalquilerListingRaw;
}

let batch: PropertyPayload[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('enalquiler');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSnapshot = [...batch];
  batch = [];
  try {
    await adapter.sendProperties(batchSnapshot);
    console.log(JSON.stringify({
      level: 'info', service: 'enalquiler-scraper',
      msg: 'Sent batch', count: batchSnapshot.length,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error', service: 'enalquiler-scraper',
      msg: 'Failed to send batch', err: (error as any)?.message,
    }));
  }
}

export function createDetailWorker(concurrency: number = 20) {
  const worker = new Worker<DetailJob>(
    'enalquiler-details',
    async (job: Job<DetailJob>) => {
      const { listing } = job.data;

      try {
        const detailResult = await fetchDetailPage(listing);

        if (detailResult.isInactive) {
          return { skipped: true, reason: detailResult.inactiveReason };
        }

        const standardData = transformEnalquilerToStandard(detailResult.data);

        batch.push({
          portalId: `enalquiler-${listing.id}`,
          data: standardData,
          rawData: detailResult.data,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id: listing.id };
      } catch (error: any) {
        console.error(JSON.stringify({
          level: 'error', service: 'enalquiler-scraper',
          msg: 'Failed to process listing', id: listing.id, err: error.message,
        }));
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
    console.error(JSON.stringify({
      level: 'error', service: 'enalquiler-scraper',
      msg: 'Job failed', id: job?.data?.listing?.id, err: err.message,
    }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({
      level: 'error', service: 'enalquiler-scraper',
      msg: 'Worker error', err: err?.message,
    }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  // Periodic flush in case batch doesn't reach BATCH_SIZE
  setInterval(async () => {
    if (batch.length > 0) await flushBatch();
  }, 5000);

  return worker;
}

export async function addDetailJobs(listings: EnalquilerListingRaw[]) {
  const bulkJobs = listings.map(listing => ({
    name: `detail-${listing.id}`,
    data: { listing },
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({
    level: 'info', service: 'enalquiler-scraper',
    msg: 'Queued detail jobs', count: listings.length,
  }));
}

export async function getQueueStats() {
  return {
    waiting: await detailQueue.getWaitingCount(),
    active: await detailQueue.getActiveCount(),
    completed: await detailQueue.getCompletedCount(),
    failed: await detailQueue.getFailedCount(),
  };
}
