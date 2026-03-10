import { Queue, Worker, Job } from 'bullmq';
import { fetchDetailPage } from '../scrapers/detailScraper';
import { transformToTierI } from '../transformers/nieruchomosciTransformer';
import { getRandomDelay } from '../utils/headers';
import { nieruchomosciRateLimiter } from '../utils/rateLimiter';
import { IngestAdapter, PropertyPayload } from '../adapters/ingestAdapter';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('nieruchomosci-online-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  id: string;
  url: string;
  propertyCategory: 'apartment' | 'house' | 'land' | 'commercial';
  transactionType: 'sale' | 'rent';
}

let batch: PropertyPayload[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('nieruchomosci-online');

async function flushBatch() {
  if (batch.length === 0) return;
  // splice(0) atomically drains the array before the first await,
  // preventing concurrent workers from double-flushing the same items.
  const toSend = batch.splice(0);
  if (toSend.length === 0) return;
  try {
    await adapter.sendProperties(toSend);
    console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Sent batch', count: toSend.length }));
  } catch (error: any) {
    // Re-queue failed items at the front for next flush attempt
    batch.unshift(...toSend);
    console.error(JSON.stringify({ level: 'error', service: 'nieruchomosci-online-scraper', msg: 'Failed to send batch, re-queued', count: toSend.length, err: error.message }));
  }
}

export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'nieruchomosci-online-details',
    async (job: Job<DetailJob>) => {
      const { id, url, propertyCategory, transactionType } = job.data;

      try {
        await nieruchomosciRateLimiter.throttle();
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(200, 800)));

        const detail = await fetchDetailPage(url, propertyCategory, transactionType);
        if (!detail) {
          return { skipped: true, reason: 'parse_failed' };
        }

        const transformed = transformToTierI(detail);

        batch.push({
          portalId: `nieruchomosci-online-${id}`,
          data: transformed,
          rawData: detail,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'nieruchomosci-online-scraper', msg: 'Detail fetch failed', id, err: error.message }));
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
    console.error(JSON.stringify({ level: 'error', service: 'nieruchomosci-online-scraper', msg: 'Job failed', id: job?.data?.id, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'nieruchomosci-online-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
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
    name: `detail-${job.id}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'nieruchomosci-online-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();
  return { waiting, active, completed, failed };
}
