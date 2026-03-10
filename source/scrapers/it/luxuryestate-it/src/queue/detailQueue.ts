/**
 * BullMQ detail queue for LuxuryEstate.com Italy scraper
 *
 * Receives Phase 1 minimal listings (new/changed only from checksum comparison),
 * fetches detail pages, transforms to TierI types, and batches to ingest API.
 */

import { Queue, Worker, Job } from 'bullmq';
import { DetailScraper } from '../scrapers/detailScraper';
import { transformLuxuryEstateApartment } from '../transformers/apartments/apartmentTransformer';
import { transformLuxuryEstateHouse } from '../transformers/houses/houseTransformer';
import { IngestAdapter, PropertyPayload } from '../adapters/ingestAdapter';
import { LuxuryEstateMinimalListing, SearchConfig } from '../types/luxuryEstateTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

const QUEUE_NAME = 'luxuryestate-it-details';
const JOB_BATCH_SIZE = 20; // Smaller batches - detail pages need individual fetching
const INGEST_BATCH_SIZE = 50;

export interface DetailJob {
  listings: LuxuryEstateMinimalListing[];
  config?: SearchConfig;
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

const adapter = new IngestAdapter('luxuryestate.com');
const detailScraper = new DetailScraper(500); // 500ms delay between detail fetches

let ingestBatch: PropertyPayload[] = [];

async function flushBatch(): Promise<void> {
  if (ingestBatch.length === 0) return;
  const toSend = ingestBatch.splice(0, ingestBatch.length);
  try {
    await adapter.sendProperties(toSend);
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'luxuryestate-scraper',
        msg: 'Flushed ingest batch',
        count: toSend.length,
      })
    );
  } catch (error: any) {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'luxuryestate-scraper',
        msg: 'Failed to flush ingest batch',
        err: error.message,
      })
    );
  }
}

export function createDetailWorker(concurrency = 2) {
  const worker = new Worker<DetailJob>(
    QUEUE_NAME,
    async (job: Job<DetailJob>) => {
      const { listings } = job.data;
      let processed = 0;
      let failed = 0;

      for (const minimal of listings) {
        try {
          const detail = await detailScraper.fetchDetail(minimal);
          if (!detail) {
            failed++;
            continue;
          }

          let transformed: ReturnType<typeof transformLuxuryEstateApartment> | ReturnType<typeof transformLuxuryEstateHouse>;
          if (detail.propertyCategory === 'house') {
            transformed = transformLuxuryEstateHouse(detail);
          } else {
            transformed = transformLuxuryEstateApartment(detail);
          }

          ingestBatch.push({
            portalId: `luxuryestate-it-${minimal.id}`,
            data: transformed,
            rawData: detail.jsonLd,
          });

          processed++;
        } catch (err: any) {
          failed++;
          console.error(
            JSON.stringify({
              level: 'error',
              service: 'luxuryestate-scraper',
              msg: 'Detail transform failed',
              id: minimal.id,
              url: minimal.url,
              err: err.message,
            })
          );
        }

        if (ingestBatch.length >= INGEST_BATCH_SIZE) {
          await flushBatch();
        }
      }

      if (ingestBatch.length > 0) {
        await flushBatch();
      }

      console.log(
        JSON.stringify({
          level: 'info',
          service: 'luxuryestate-scraper',
          msg: 'Job complete',
          jobId: job.id,
          processed,
          failed,
        })
      );

      return { processed, failed };
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 300000, // 5 min lock - detail fetches take time
      lockRenewTime: 60000,
    }
  );

  worker.on('failed', (job: Job<DetailJob> | undefined, err: Error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'luxuryestate-scraper',
        msg: 'Job failed',
        jobId: job?.id,
        err: err.message,
      })
    );
  });

  worker.on('error', (err: Error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'luxuryestate-scraper',
        msg: 'Worker error',
        err: err?.message || String(err),
      })
    );
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  // Periodic flush in case batch doesn't fill up
  setInterval(async () => {
    if (ingestBatch.length > 0) await flushBatch();
  }, 10000);

  return worker;
}

export async function addDetailJobs(
  listings: LuxuryEstateMinimalListing[],
  config?: SearchConfig
): Promise<void> {
  const jobs = [];
  for (let i = 0; i < listings.length; i += JOB_BATCH_SIZE) {
    jobs.push({
      name: `detail-${Date.now()}-${i}`,
      data: { listings: listings.slice(i, i + JOB_BATCH_SIZE), config },
    });
  }
  await detailQueue.addBulk(jobs);
  console.log(
    JSON.stringify({
      level: 'info',
      service: 'luxuryestate-scraper',
      msg: 'Queued detail jobs',
      batches: jobs.length,
      listings: listings.length,
      category: config?.category,
    })
  );
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
