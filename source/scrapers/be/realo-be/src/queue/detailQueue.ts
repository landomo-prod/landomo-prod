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

export const detailQueue = new Queue('realo-be-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  listingId: string;
  category: string;
  transactionType: string;
  url?: string;
}

let batch: any[] = [];
const BATCH_SIZE = 50;
const adapter = new IngestAdapter('realo-be');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchCopy = [...batch];
  batch = [];
  try {
    await adapter.sendProperties(batchCopy);
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'realo-be-scraper', msg: 'Failed to send batch', err: error.message }));
  }
}

function transformListing(raw: any, category: string) {
  switch (category) {
    case 'house': return transformHouse(raw);
    case 'land': return transformLand(raw);
    case 'commercial': return transformCommercial(raw);
    case 'apartment':
    default: return transformApartment(raw);
  }
}

export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'realo-be-details',
    async (job: Job<DetailJob>) => {
      const { listingId, category, url } = job.data;

      await new Promise(resolve => setTimeout(resolve, getRandomDelay(300, 800)));

      const detail = await fetchListingDetail(listingId, url);
      if (!detail) return { skipped: true };

      const transformed = transformListing(detail, category);

      batch.push({
        portalId: `realo-be-${listingId}`,
        data: transformed,
        rawData: detail,
      });

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }

      return { success: true, listingId };
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 300000,
      lockRenewTime: 150000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'realo-be-scraper', msg: 'Job failed', listingId: job?.data?.listingId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'realo-be-scraper', msg: 'Worker error', err: err?.message }));
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
  console.log(JSON.stringify({ level: 'info', service: 'realo-be-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  return {
    waiting: await detailQueue.getWaitingCount(),
    active: await detailQueue.getActiveCount(),
    completed: await detailQueue.getCompletedCount(),
    failed: await detailQueue.getFailedCount(),
  };
}
