import { Queue, Worker, Job } from 'bullmq';
import { fetchPropertyDetail } from '../utils/fetchData';
import { getRandomDelay } from '../utils/headers';
import { transformToApartment } from '../transformers/apartmentTransformer';
import { transformToHouse } from '../transformers/houseTransformer';
import { transformToLand } from '../transformers/landTransformer';
import { transformToCommercial } from '../transformers/commercialTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('funda-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  listingId: string;
  url: string;
  propertyType: string; // 'appartement' | 'woonhuis' | 'bouwgrond' | 'bedrijfspand'
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('funda');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'funda-scraper', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

function mapPropertyType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('appartement') || t.includes('flat') || t.includes('bovenwoning') || t.includes('benedenwoning')) return 'appartement';
  if (t.includes('woonhuis') || t.includes('villa') || t.includes('herenhuis')) return 'woonhuis';
  if (t.includes('bouwgrond') || t.includes('perceel')) return 'bouwgrond';
  if (t.includes('bedrijf') || t.includes('kantoor') || t.includes('winkel')) return 'bedrijfspand';
  return 'appartement';
}

export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'funda-details',
    async (job: Job<DetailJob>) => {
      const { listingId, url, propertyType } = job.data;

      try {
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 800)));

        const detail = await fetchPropertyDetail(url);
        if (!detail) return { skipped: true, reason: 'fetch_failed' };

        const type = mapPropertyType(detail.propertyType || propertyType);
        let standardData: any;

        switch (type) {
          case 'woonhuis':
            standardData = transformToHouse(detail);
            break;
          case 'bouwgrond':
            standardData = transformToLand(detail);
            break;
          case 'bedrijfspand':
            standardData = transformToCommercial(detail);
            break;
          default:
            standardData = transformToApartment(detail);
            break;
        }

        batch.push({
          portalId: `funda-${listingId}`,
          data: standardData,
          rawData: detail,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, listingId };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'funda-scraper', msg: 'Failed to process listing', listingId, err: error.message }));
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
    console.error(JSON.stringify({ level: 'error', service: 'funda-scraper', msg: 'Job failed', listingId: job?.data.listingId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'funda-scraper', msg: 'Worker error', err: err?.message || String(err) }));
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
  console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();
  return { waiting, active, completed, failed };
}
