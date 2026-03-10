import { Queue, Worker, Job } from 'bullmq';
import { transformIngatlannetToStandard } from '../transformers/ingatlannetTransformer';
import { IngestAdapter, PropertyPayload } from '../adapters/ingestAdapter';
import { IngatlannetListing } from '../types/ingatlannetTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('ingatlannet-details', {
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
  listing: IngatlannetListing;
}

let batch: PropertyPayload[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('ingatlannet-hu');

async function flushBatch() {
  if (batch.length === 0) return;

  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'ingatlannet-hu', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'ingatlannet-hu', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'ingatlannet-details',
    async (job: Job<DetailJob>) => {
      const { listing } = job.data;

      try {
        const standardData = transformIngatlannetToStandard(listing);

        batch.push({
          portalId: `ingatlannet-${listing.id}`,
          data: standardData,
          rawData: listing,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id: listing.id };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'ingatlannet-hu', msg: 'Failed to process listing', id: listing.id, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 60000,
      lockRenewTime: 30000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'ingatlannet-hu', msg: 'Job failed', id: job?.data?.listing?.id, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'ingatlannet-hu', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    console.log(JSON.stringify({ level: 'info', service: 'ingatlannet-hu', msg: 'Flushing remaining batch before shutdown' }));
    await flushBatch();
  });

  setInterval(async () => {
    if (batch.length > 0) {
      await flushBatch();
    }
  }, 5000);

  return worker;
}

export async function addDetailJobs(listings: IngatlannetListing[]) {
  const bulkJobs = listings.map(listing => ({
    name: `detail-${listing.id}`,
    data: { listing },
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'ingatlannet-hu', msg: 'Queued detail jobs', count: listings.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
