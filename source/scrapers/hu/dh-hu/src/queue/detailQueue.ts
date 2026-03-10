import { Queue, Worker, Job } from 'bullmq';
import { transformDHToStandard } from '../transformers/dhTransformer';
import { IngestAdapter, PropertyPayload } from '../adapters/ingestAdapter';
import { DHListing } from '../types/dhTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('dh-details', {
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
  portalId: string;
  listing: DHListing;
}

let batch: PropertyPayload[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('dh-hu');

async function flushBatch() {
  if (batch.length === 0) return;

  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'dh-hu', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'dh-hu', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

export function createDetailWorker(concurrency: number = 30) {
  const worker = new Worker<DetailJob>(
    'dh-details',
    async (job: Job<DetailJob>) => {
      const { portalId, listing } = job.data;

      try {
        const standardData = transformDHToStandard(listing);

        batch.push({
          portalId,
          data: standardData,
          rawData: listing.rawData || listing,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, portalId };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'dh-hu', msg: 'Failed to process listing', portalId, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'dh-hu', msg: 'Job failed', portalId: job?.data.portalId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'dh-hu', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    console.log(JSON.stringify({ level: 'info', service: 'dh-hu', msg: 'Flushing remaining batch before shutdown' }));
    await flushBatch();
  });

  setInterval(async () => {
    if (batch.length > 0) {
      await flushBatch();
    }
  }, 5000);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.portalId}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'dh-hu', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
