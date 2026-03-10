import { Queue, Worker, Job } from 'bullmq';
import { fetchPropertyDetail } from '../utils/fetchData';
import { transformToStandard } from '../transformers/apartments/apartmentTransformer';
import { transformHouseToStandard } from '../transformers/houses/houseTransformer';
import { transformLandToStandard } from '../transformers/land/landTransformer';
import { transformCommercialToStandard } from '../transformers/commercial/commercialTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('immoscout24-ch-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  propertyId: string;
  category: string;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('immoscout24-ch');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'immoscout24-ch', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

function getTransformer(category: string) {
  if (category.includes('apartment') || category.includes('wohnung')) return transformToStandard;
  if (category.includes('house') || category.includes('haus')) return transformHouseToStandard;
  if (category.includes('land') || category.includes('grundstueck')) return transformLandToStandard;
  if (category.includes('commercial') || category.includes('gewerbe')) return transformCommercialToStandard;
  return transformToStandard; // default
}

export function createDetailWorker(concurrency: number = 3) {
  const worker = new Worker<DetailJob>(
    'immoscout24-ch-details',
    async (job: Job<DetailJob>) => {
      const { propertyId, category } = job.data;

      try {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        const detailData = await fetchPropertyDetail(propertyId);
        if (!detailData) {
          return { skipped: true, reason: 'no data' };
        }

        const transformer = getTransformer(category);
        const standardData = transformer(detailData);

        batch.push({
          portalId: `immoscout24-ch-${propertyId}`,
          data: standardData,
          rawData: detailData,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, propertyId };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'immoscout24-ch', msg: 'Failed to process property', propertyId, err: error.message }));
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
    console.error(JSON.stringify({ level: 'error', service: 'immoscout24-ch', msg: 'Job failed', propertyId: job?.data.propertyId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immoscout24-ch', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Flushing remaining batch before shutdown' }));
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
    name: `detail-${job.propertyId}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'immoscout24-ch', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();
  return { waiting, active, completed, failed };
}
