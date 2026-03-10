import { Queue, Worker, Job } from 'bullmq';
import { fetchPropertyDetail } from '../utils/fetchData';
import { transformImmoScout24ToStandard } from '../transformers/immoscout24Transformer';
import { IngestAdapter } from '../adapters/ingestAdapter';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('immoscout24-at-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  exposeId: string;
  category: string;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('immobilienscout24-at');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'immoscout24-at', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'immoscout24-at', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

export function createDetailWorker(concurrency: number = 3) {
  const effectiveConcurrency = Math.min(concurrency, 2);

  const worker = new Worker<DetailJob>(
    'immoscout24-at-details',
    async (job: Job<DetailJob>) => {
      const { exposeId } = job.data;

      try {
        // Jitter to avoid thundering herd (1-3s for Playwright)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        const detailData = await fetchPropertyDetail(exposeId);

        if (!detailData) {
          return { skipped: true, reason: 'no data' };
        }

        const standardData = transformImmoScout24ToStandard(detailData);

        batch.push({
          portalId: `immobilienscout24-at-${exposeId}`,
          data: standardData,
          rawData: detailData,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, exposeId };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'immoscout24-at', msg: 'Failed to process exposeId', exposeId, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: effectiveConcurrency,
      lockDuration: 300000,
      lockRenewTime: 150000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immoscout24-at', msg: 'Job failed', exposeId: job?.data.exposeId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immoscout24-at', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    console.log(JSON.stringify({ level: 'info', service: 'immoscout24-at', msg: 'Flushing remaining batch before shutdown' }));
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
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.exposeId}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'immoscout24-at', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
