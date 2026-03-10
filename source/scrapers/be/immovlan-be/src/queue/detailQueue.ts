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

export const detailQueue = new Queue('immovlan-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  id: string | number;
  category: string;
  transactionType: string;
  listingData?: any;
}

let batch: any[] = [];
const BATCH_SIZE = 50;
const adapter = new IngestAdapter('immovlan');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'immovlan-scraper', msg: 'Failed to send batch', err: (error as any)?.message }));
  }
}

function transformListing(raw: any, category: string, transactionType: string): any {
  const cat = category.toLowerCase();
  if (cat === 'apartment') return transformApartment(raw, transactionType);
  if (cat === 'house') return transformHouse(raw, transactionType);
  if (cat === 'land') return transformLand(raw, transactionType);
  if (cat === 'commercial') return transformCommercial(raw, transactionType);
  return transformApartment(raw, transactionType);
}

export function createDetailWorker(concurrency: number = 30) {
  const worker = new Worker<DetailJob>(
    'immovlan-details',
    async (job: Job<DetailJob>) => {
      const { id, category, transactionType, listingData } = job.data;

      try {
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(500, 1500)));

        let data = listingData;
        if (!data || !data.description) {
          const result = await fetchListingDetail(id);
          if (result.isInactive) return { skipped: true, reason: result.inactiveReason };
          data = result.data;
        }

        const standardData = transformListing(data, category, transactionType);

        batch.push({
          portalId: `immovlan-${id}`,
          data: standardData,
          rawData: data,
        });

        if (batch.length >= BATCH_SIZE) await flushBatch();

        return { success: true, id };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'immovlan-scraper', msg: 'Failed to process', id, err: error.message }));
        throw error;
      }
    },
    { connection: redisConfig, concurrency, lockDuration: 300000, lockRenewTime: 150000 }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immovlan-scraper', msg: 'Job failed', id: job?.data.id, err: err.message }));
  });

  worker.on('closing', async () => { await flushBatch(); });
  setInterval(async () => { if (batch.length > 0) await flushBatch(); }, 5000);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  await detailQueue.addBulk(jobs.map(job => ({ name: `detail-${job.id}`, data: job })));
  console.log(JSON.stringify({ level: 'info', service: 'immovlan-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  return {
    waiting: await detailQueue.getWaitingCount(),
    active: await detailQueue.getActiveCount(),
    completed: await detailQueue.getCompletedCount(),
    failed: await detailQueue.getFailedCount(),
  };
}
