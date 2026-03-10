import { Queue, Worker, Job } from 'bullmq';
import { fetchDetailPage } from '../utils/fetchData';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { pisosRateLimiter } from '../utils/rateLimiter';
import { transformPisosToStandard } from '../transformers/pisosTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { PisosListingRaw } from '../types/pisosTypes';
import { detectCategoryFromDetailUrl } from '../utils/categoryDetection';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('pisos-com-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  portalId: string;
  detailUrl: string;
  listingData: PisosListingRaw;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('pisos-com');

async function flushBatch() {
  if (batch.length === 0) return;
  const size = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'pisos-com-scraper', msg: 'Sent batch', count: size }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'pisos-com-scraper', msg: 'Failed to send batch', err: (error as any)?.message }));
  }
}

export function createDetailWorker(concurrency: number = 40) {
  const worker = new Worker<DetailJob>(
    'pisos-com-details',
    async (job: Job<DetailJob>) => {
      const { portalId, detailUrl, listingData } = job.data;

      try {
        await pisosRateLimiter.throttle();
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 800)));

        const detail = await fetchDetailPage(detailUrl);

        if (!detail) {
          return { skipped: true, reason: 'not_found' };
        }

        const category = detectCategoryFromDetailUrl(detailUrl);
        const standardData = transformPisosToStandard(listingData, detail, category);

        batch.push({
          portalId: `pisos-com-${portalId}`,
          data: standardData,
          rawData: { listing: listingData, detail },
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, portalId };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'pisos-com-scraper', msg: 'Detail job failed', portalId, err: error.message }));
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
    console.error(JSON.stringify({ level: 'error', service: 'pisos-com-scraper', msg: 'Job failed', portalId: job?.data.portalId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'pisos-com-scraper', msg: 'Worker error', err: err?.message }));
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
    name: `detail-${job.portalId}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'pisos-com-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();
  return { waiting, active, completed, failed };
}
