import { Queue, Worker, Job } from 'bullmq';
import { fetchDetailsBatch } from '../scrapers/detailScraper';
import { transformAdresowoProperty } from '../transformers/adresowoTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { AdresowoListingSummary } from '../scrapers/listingsScraper';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('adresowo-details', {
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
  url: string;
  categorySlug: string;
  summary: AdresowoListingSummary;
}

let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('adresowo');

async function flushBatch() {
  if (batch.length === 0) return;
  // splice(0) atomically drains the array before the first await,
  // preventing concurrent workers from double-flushing the same items.
  const toSend = batch.splice(0);
  if (toSend.length === 0) return;
  try {
    await adapter.sendProperties(toSend);
    console.log(JSON.stringify({ level: 'info', service: 'adresowo-scraper', msg: 'Sent batch', count: toSend.length }));
  } catch (error) {
    // Re-queue failed items at the front for next flush attempt
    batch.unshift(...toSend);
    console.error(JSON.stringify({ level: 'error', service: 'adresowo-scraper', msg: 'Failed to send batch, re-queued', count: toSend.length, err: (error as any)?.message || String(error) }));
  }
}

export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'adresowo-details',
    async (job: Job<DetailJob>) => {
      const { portalId, url, categorySlug, summary } = job.data;

      try {
        // Fetch detail page
        const results = await fetchDetailsBatch([{ portalId, url }]);
        const result = results.get(portalId);

        if (!result || result.error) {
          // Detail fetch failed — transform with summary-only data (degraded quality)
          console.warn(JSON.stringify({ level: 'warn', service: 'adresowo-scraper', msg: 'Detail fetch failed, ingesting summary-only (degraded)', portalId, err: result?.error }));
          const transformed = transformAdresowoProperty(summary, undefined, categorySlug);
          batch.push({ portalId, data: transformed, rawData: { summary } });
        } else {
          const transformed = transformAdresowoProperty(summary, result.detail, categorySlug);
          batch.push({ portalId, data: transformed, rawData: { summary, detail: result.detail } });
        }

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, portalId };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'adresowo-scraper', msg: 'Failed to process', portalId, err: error.message }));
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
    console.error(JSON.stringify({ level: 'error', service: 'adresowo-scraper', msg: 'Job failed', portalId: job?.data.portalId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'adresowo-scraper', msg: 'Worker error', err: err?.message || String(err) }));
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
    name: `detail-${job.portalId}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'adresowo-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();
  return { waiting, active, completed, failed };
}
