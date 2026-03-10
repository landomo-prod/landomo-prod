import { Queue, Worker, Job } from 'bullmq';
import { fetchListingDetail } from '../utils/fetchData';
import { getRandomDelay } from '../utils/headers';
import { transformApartment } from '../transformers/apartmentTransformer';
import { transformHouse } from '../transformers/houseTransformer';
import { transformLand } from '../transformers/landTransformer';
import { transformCommercial } from '../transformers/commercialTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('athome-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  listingId: number;
  category: string;
  transactionType: string;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('athome');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'athome-scraper', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'athome-scraper', msg: 'Failed to send batch', err: (error as any)?.message }));
  }
}

function transformByCategory(raw: any, category: string, transactionType: string): any {
  switch (category) {
    case 'flat': return transformApartment(raw, transactionType);
    case 'house': return transformHouse(raw, transactionType);
    case 'land': return transformLand(raw, transactionType);
    case 'office': return transformCommercial(raw, transactionType);
    default: return transformApartment(raw, transactionType);
  }
}

export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'athome-details',
    async (job: Job<DetailJob>) => {
      const { listingId, category, transactionType } = job.data;

      try {
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(100, 400)));

        const detail = await fetchListingDetail(listingId);
        if (!detail) {
          return { skipped: true, reason: 'not_found' };
        }

        const standardData = transformByCategory(detail, category, transactionType);

        batch.push({
          portalId: `athome-${listingId}`,
          data: standardData,
          rawData: detail,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, listingId };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'athome-scraper', msg: 'Failed to process listing', listingId, err: error.message }));
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
    console.error(JSON.stringify({ level: 'error', service: 'athome-scraper', msg: 'Job failed', listingId: job?.data.listingId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'athome-scraper', msg: 'Worker error', err: err?.message }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  setInterval(async () => {
    if (batch.length > 0) await flushBatch();
  }, 5000);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.listingId}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'athome-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();
  return { waiting, active, completed, failed };
}
