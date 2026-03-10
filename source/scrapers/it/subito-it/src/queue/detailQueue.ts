import { Queue, Worker, Job } from 'bullmq';
import { SubitoMinimalListing } from '../types/subitoTypes';
import { transformSubitoItem } from '../transformers';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { extractIdFromUrn } from '../utils/subitoHelpers';


const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

const QUEUE_NAME = 'subito-it-details';
const JOB_BATCH_SIZE = 50;
const INGEST_BATCH_SIZE = 100;

export interface DetailJob {
  listings: SubitoMinimalListing[];
}

export const detailQueue = new Queue(QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500, age: 3600 },
    removeOnFail: { count: 200, age: 7200 },
  },
});

const adapter = new IngestAdapter('subito.it');
let ingestBatch: any[] = [];

async function flushBatch(): Promise<void> {
  if (ingestBatch.length === 0) return;
  const toSend = ingestBatch.splice(0, ingestBatch.length);
  try {
    await adapter.sendProperties(toSend);
    console.log(JSON.stringify({
      level: 'info', service: 'subito-scraper',
      msg: 'Sent ingest batch', count: toSend.length,
    }));
  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'error', service: 'subito-scraper',
      msg: 'Failed to send ingest batch', err: error.message,
    }));
  }
}

export function createDetailWorker(concurrency = 5) {
  const worker = new Worker<DetailJob>(
    QUEUE_NAME,
    async (job: Job<DetailJob>) => {
      const { listings } = job.data;

      for (const listing of listings) {
        try {
          // Use the item from the Hades API (already has full data).
          // Subito.it blocks HTML detail page scraping from all IPs.
          const item = listing.item;
          if (!item || !Array.isArray(item.features)) {
            item.features = Array.isArray(item.features) ? item.features : [];
          }

          const transformed = transformSubitoItem(item, listing.config);
          const portalId = `subito-it-${extractIdFromUrn(item.urn)}`;

          ingestBatch.push({
            portalId,
            data: transformed,
            rawData: item,
          });
        } catch (err: any) {
          console.error(JSON.stringify({
            level: 'error', service: 'subito-scraper',
            msg: 'Transform/detail failed',
            portalId: listing.portalId,
            err: err.message,
          }));
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
      lockDuration: 120000,
      lockRenewTime: 60000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({
      level: 'error', service: 'subito-scraper',
      msg: 'Detail job failed', err: err.message,
    }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({
      level: 'error', service: 'subito-scraper',
      msg: 'Worker error', err: err?.message || String(err),
    }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  // Periodic flush every 5s to avoid data sitting too long in memory
  setInterval(async () => {
    if (ingestBatch.length > 0) await flushBatch();
  }, 5000);

  return worker;
}

export async function addDetailJobs(listings: SubitoMinimalListing[]): Promise<void> {
  const jobs = [];
  for (let i = 0; i < listings.length; i += JOB_BATCH_SIZE) {
    jobs.push({
      name: `detail-${Date.now()}-${i}`,
      data: { listings: listings.slice(i, i + JOB_BATCH_SIZE) },
    });
  }
  await detailQueue.addBulk(jobs);
  console.log(JSON.stringify({
    level: 'info', service: 'subito-scraper',
    msg: 'Queued detail jobs', batches: jobs.length, listings: listings.length,
  }));
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
