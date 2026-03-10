import { Queue, Worker, Job } from 'bullmq';
import { ListingsScraper } from '../scrapers/listingsScraper';
import { transformImmodirektToStandard } from '../transformers/immodirektTransformer';
import { IngestAdapter, PropertyPayload } from '../adapters/ingestAdapter';
import { createLogger } from '@landomo/core';

const log = createLogger({ service: 'immodirekt-at-scraper', portal: 'immodirekt-at', country: 'at' });

// Config from env
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const RATE_LIMIT_MS = parseInt(process.env.DETAIL_RATE_LIMIT_MS || '3000');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50');

const QUEUE_NAME = 'immodirekt-at-details';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue(QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});

export interface DetailJob {
  id: string;
  url: string;
  transactionType: 'sale' | 'rent';
  propertyType: string;
}

let batch: PropertyPayload[] = [];
const adapter = new IngestAdapter('immodirekt-at');

async function flushBatch() {
  if (batch.length === 0) return;
  const toSend = [...batch];
  batch = [];
  try {
    await adapter.sendProperties(toSend);
    log.info({ count: toSend.length }, 'Flushed batch');
  } catch (error: any) {
    log.error({ err: error.message, count: toSend.length }, 'Flush failed');
    batch.unshift(...toSend);
  }
}

// Shared scraper instance for detail fetches (reuses browser + Cloudflare bypass)
let sharedScraper: ListingsScraper | null = null;

function getSharedScraper(): ListingsScraper {
  if (!sharedScraper) {
    sharedScraper = new ListingsScraper();
  }
  return sharedScraper;
}

export function createDetailWorker(concurrency?: number) {
  const worker = new Worker<DetailJob>(
    QUEUE_NAME,
    async (job: Job<DetailJob>) => {
      const { id, url, transactionType, propertyType } = job.data;

      try {
        // Rate limiting with jitter (slower for Cloudflare)
        const jitter = Math.floor(Math.random() * 2000);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS + jitter));

        // Fetch detail page using existing Playwright + Cloudflare bypass logic
        const scraper = getSharedScraper();
        const detail = await scraper.scrapeListingDetails(url);

        if (!detail) {
          return { skipped: true, reason: 'no detail' };
        }

        const mergedListing = {
          id,
          url,
          transactionType,
          propertyType,
          ...detail,
        };

        const standardData = transformImmodirektToStandard(mergedListing as any);

        batch.push({
          portalId: `immodirekt-${id}`,
          data: standardData,
          rawData: mergedListing,
        });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, id };
      } catch (error: any) {
        log.error({ id, err: error.message }, 'Detail job failed');
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
        duration: 10000,
      },
    }
  );

  worker.on('failed', (job: any, err: any) => {
    log.error({ id: job?.data?.id, err: err.message }, 'Job failed');
  });

  worker.on('error', (err: any) => {
    log.error({ err: err?.message }, 'Worker error');
  });

  worker.on('closing', async () => {
    await flushBatch();
    if (sharedScraper) {
      await sharedScraper.close();
      sharedScraper = null;
    }
  });

  // Periodic flush every 10s
  setInterval(() => flushBatch(), 10000);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.id}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  log.info({ count: jobs.length }, 'Queued detail jobs');
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
