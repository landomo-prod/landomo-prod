import { Queue, Worker, Job } from 'bullmq';
import { extractCsrfToken, fetchListingDetail } from '../utils/fetchData';
import { getRandomUserAgent } from '../utils/userAgents';
import { transformWillhabenToStandard } from '../transformers/willhabenTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('willhaben-details', {
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
  propertyTypeId?: string;
}

let batch: any[] = [];
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 10000;
const adapter = new IngestAdapter('willhaben');

async function flushBatch() {
  if (batch.length === 0) return;
  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'willhaben-scraper', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'willhaben-scraper', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

export function createDetailWorker(concurrency: number = 10) {
  let csrfToken: string | null = null;

  const worker = new Worker<DetailJob>(
    'willhaben-details',
    async (job: Job<DetailJob>) => {
      const { listingId } = job.data;

      try {
        // Ensure we have a CSRF token
        if (!csrfToken) {
          csrfToken = await extractCsrfToken();
        }

        const userAgent = getRandomUserAgent();

        // Jitter (100-500ms)
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

        const detailData = await fetchListingDetail(listingId, csrfToken, userAgent);
        const standardData = transformWillhabenToStandard(detailData);

        batch.push({
          portalId: `willhaben-${listingId}`,
          data: standardData,
          rawData: detailData,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, listingId };
      } catch (error: any) {
        // Reset CSRF token on auth errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          csrfToken = null;
        }
        console.error(JSON.stringify({ level: 'error', service: 'willhaben-scraper', msg: 'Failed to process listing', listingId, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 60000,
      lockRenewTime: 30000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'willhaben-scraper', msg: 'Job failed', listingId: job?.data.listingId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'willhaben-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  setInterval(async () => {
    if (batch.length > 0) {
      await flushBatch();
    }
  }, FLUSH_INTERVAL_MS);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.listingId}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'willhaben-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();
  return { waiting, active, completed, failed };
}
