import { Queue, Worker, Job } from 'bullmq';
import { fetchOfferDetail } from '../utils/fetchData';
import { fetchDetailPage } from '../scrapers/htmlScraper';
import { transformWGGesuchtToStandard } from '../transformers/wgGesuchtTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';

const USE_API = !!(process.env.WG_GESUCHT_USERNAME && process.env.WG_GESUCHT_PASSWORD);

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const RATE_LIMIT_MS = parseInt(process.env.DETAIL_RATE_LIMIT_MS || '5000');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50');

const QUEUE_NAME = 'wg-gesucht-details';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue(QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  id: string;
  transactionType: 'sale' | 'rent';
  category?: string;
  cityId?: number;
  url?: string;
}

let batch: any[] = [];
const adapter = new IngestAdapter('wg-gesucht');

async function flushBatch() {
  if (batch.length === 0) return;
  const size = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ msg: 'Flushed batch', count: size }));
  } catch (error: any) {
    console.error(JSON.stringify({ msg: 'Flush failed', err: error.message }));
  }
}

export function createDetailWorker(concurrency?: number) {
  const worker = new Worker<DetailJob>(
    QUEUE_NAME,
    async (job: Job<DetailJob>) => {
      const { id } = job.data;

      try {
        // WG-Gesucht requires 5-8s delays to avoid reCAPTCHA
        const jitter = Math.floor(Math.random() * 3000);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS + jitter));

        let detail: any;
        if (USE_API) {
          detail = await fetchOfferDetail(id);
        } else {
          // HTML-based detail fetch (no auth needed)
          const detailUrl = job.data.url || `https://www.wg-gesucht.de/${id}.html`;
          detail = await fetchDetailPage(detailUrl);
          detail.id = id;
        }

        if (!detail) {
          return { skipped: true, reason: 'no detail' };
        }

        const standardData = transformWGGesuchtToStandard(detail);

        batch.push({
          portalId: `wg-gesucht-${id}`,
          data: standardData,
          rawData: detail,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id };
      } catch (error: any) {
        console.error(JSON.stringify({ msg: 'Detail job failed', id, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: concurrency ?? WORKER_CONCURRENCY,
      lockDuration: 300000,
      lockRenewTime: 150000,
      limiter: {
        max: 3,
        duration: 15000,
      },
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ msg: 'Job failed', id: job?.data?.id, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ msg: 'Worker error', err: err?.message }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  setInterval(() => flushBatch(), 10000);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.id}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    detailQueue.getWaitingCount(),
    detailQueue.getActiveCount(),
    detailQueue.getCompletedCount(),
    detailQueue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}
