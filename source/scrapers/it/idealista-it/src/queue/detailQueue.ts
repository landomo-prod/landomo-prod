import { Queue, Worker, Job } from 'bullmq';
import { DetailScraper } from '../scrapers/detailScraper';
import { transformIdealistaToStandard } from '../transformers/idealistaTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { IdealistaListing } from '../types/idealistaTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

const QUEUE_NAME = 'idealista-it-details';
const JOB_BATCH_SIZE = 10;
const INGEST_BATCH_SIZE = 50;

export interface DetailJob {
  listings: IdealistaListing[];
}

export const detailQueue = new Queue(QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 500, age: 3600 },
    removeOnFail: { count: 200, age: 7200 },
  },
});

const adapter = new IngestAdapter('idealista.it');
let ingestBatch: any[] = [];

async function flushBatch() {
  if (ingestBatch.length === 0) return;
  const toSend = ingestBatch.splice(0, ingestBatch.length);
  try {
    await adapter.sendProperties(toSend);
    console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Sent ingest batch', count: toSend.length }));
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Failed to send ingest batch', err: error.message }));
  }
}

export function createDetailWorker(concurrency = 3) {
  const detailScraper = new DetailScraper();

  const worker = new Worker<DetailJob>(
    QUEUE_NAME,
    async (job: Job<DetailJob>) => {
      const { listings } = job.data;

      for (const listing of listings) {
        const detail = await detailScraper.fetchDetail(listing.url);

        try {
          const transformed = transformIdealistaToStandard(listing, detail || undefined);
          ingestBatch.push({
            portalId: `idealista-${listing.id}`,
            data: transformed,
            rawData: { listing, detail },
          });
        } catch (err: any) {
          console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Transform failed', id: listing.id, err: err.message }));
        }
      }

      if (ingestBatch.length >= INGEST_BATCH_SIZE) {
        await flushBatch();
      }

      return { processed: listings.length };
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 300000,
      lockRenewTime: 150000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Job failed', err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'idealista-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  setInterval(async () => {
    if (ingestBatch.length > 0) await flushBatch();
  }, 5000);

  return worker;
}

export async function addDetailJobs(listings: IdealistaListing[]) {
  const jobs = [];
  for (let i = 0; i < listings.length; i += JOB_BATCH_SIZE) {
    jobs.push({
      name: `detail-${Date.now()}-${i}`,
      data: { listings: listings.slice(i, i + JOB_BATCH_SIZE) },
    });
  }
  await detailQueue.addBulk(jobs);
  console.log(JSON.stringify({ level: 'info', service: 'idealista-scraper', msg: 'Queued detail jobs', batches: jobs.length, listings: listings.length }));
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
