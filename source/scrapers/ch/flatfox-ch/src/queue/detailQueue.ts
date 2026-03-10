import { Queue, Worker, Job } from 'bullmq';
import { transformFlatfoxToStandard } from '../transformers/flatfoxTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { fetchListingDetail } from '../utils/fetchData';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('flatfox-ch-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  pk: number;
  listingData: any;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('flatfox-ch');

async function flushBatch() {
  if (batch.length === 0) return;

  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'flatfox-ch', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'flatfox-ch-details',
    async (job: Job<DetailJob>) => {
      const { pk, listingData } = job.data;

      try {
        // Flatfox list API returns full data, so listingData should be complete
        // Only fetch detail if description is missing
        let data = listingData;
        if (!data.description) {
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
          data = await fetchListingDetail(pk);
        }

        const standardData = transformFlatfoxToStandard(data);

        batch.push({
          portalId: `flatfox-ch-${pk}`,
          data: standardData,
          rawData: data,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, pk };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'flatfox-ch', msg: 'Failed to process listing', pk, err: error.message }));
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
    console.error(JSON.stringify({ level: 'error', service: 'flatfox-ch', msg: 'Job failed', pk: job?.data.pk, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'flatfox-ch', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
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
    name: `detail-${job.pk}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'flatfox-ch', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
