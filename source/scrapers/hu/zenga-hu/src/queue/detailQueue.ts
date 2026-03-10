import { Queue, Worker, Job } from 'bullmq';
import { transformZengaToStandard } from '../transformers/zengaTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { ZengaListing } from '../types/zengaTypes';

const log = (level: string, msg: string, extra: Record<string, any> = {}) =>
  console.log(JSON.stringify({ level, service: 'zenga-hu', msg, ...extra }));

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('zenga-details', {
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
  listing: ZengaListing;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('zenga-hu');

async function flushBatch() {
  if (batch.length === 0) return;

  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    log('info', 'Sent batch', { count: batchSize });
  } catch (error) {
    log('error', 'Failed to send batch', { err: (error as any)?.message || String(error) });
  }
}

export function createDetailWorker(concurrency: number = 30) {
  const worker = new Worker<DetailJob>(
    'zenga-details',
    async (job: Job<DetailJob>) => {
      const { listing } = job.data;

      try {
        const standardData = transformZengaToStandard(listing);

        batch.push({
          portalId: `zenga-${listing.id}`,
          data: standardData,
          rawData: listing.rawData || listing,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id: listing.id };
      } catch (error: any) {
        log('error', 'Failed to process listing', { id: listing.id, err: error.message });
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
    log('error', 'Job failed', { id: job?.data?.listing?.id, err: err.message });
  });

  worker.on('error', (err: any) => {
    log('error', 'Worker error', { err: err?.message || String(err) });
  });

  worker.on('closing', async () => {
    log('info', 'Flushing remaining batch before shutdown');
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

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map((job, i) => ({
    name: `detail-${job.listing.id}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
  log('info', 'Queued detail jobs', { count: jobs.length });
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
