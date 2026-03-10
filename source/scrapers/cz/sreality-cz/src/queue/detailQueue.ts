import { Queue, Worker, Job } from 'bullmq';
import { fetchEstateDetail } from '../utils/fetchData';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { srealityRateLimiter } from '../utils/rateLimiter';
import { transformSRealityToStandard } from '../transformers/srealityTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { ChecksumClient, ListingChecksum } from '@landomo/core';

// Redis connection config
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  // Only set password if env var exists (dev Redis has no password)
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

const checksumClient = new ChecksumClient(
  process.env.INGEST_API_URL || 'http://localhost:3000',
  process.env.INGEST_API_KEY || ''
);

// Queue for discovered listings
export const detailQueue = new Queue('sreality-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 100000, // Keep last 100k successful jobs — never hit in practice for ~94k listings
      age: 3600, // Remove after 1 hour
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs for debugging
      age: 7200, // Remove after 2 hours
    },
  },
});

// Job data interface
export interface DetailJob {
  hashId: number;
  category: number;
  url: string;
  checksum?: ListingChecksum;
}

async function saveChecksumsWithRetry(checksums: ListingChecksum[], maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checksumClient.updateChecksums(checksums);
      return;
    } catch (err: any) {
      if (attempt === maxAttempts) {
        console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Failed to save checksums after retries', attempts: maxAttempts, err: err.message }));
        return;
      }
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

// Batch accumulator for ingestion
let batch: any[] = [];
let pendingChecksums: ListingChecksum[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('sreality');

// Accurate processed counter (not capped like BullMQ's completed count)
let processedCount = 0;
let skippedInactiveCount = 0;
export function getProcessedCount() { return processedCount; }
export function getSkippedInactiveCount() { return skippedInactiveCount; }
export function resetProcessedCount() { processedCount = 0; skippedInactiveCount = 0; }

// Mutex to prevent concurrent flushBatch calls from racing
let flushing = false;

async function flushBatch() {
  if (batch.length === 0 || flushing) return;
  flushing = true;

  // Swap arrays BEFORE the async send — new items from concurrent workers
  // go into fresh arrays while we send the old ones. This prevents the race
  // condition where items pushed during sendProperties are orphaned by `batch = []`.
  const toSend = batch;
  const checksumsToSave = pendingChecksums;
  batch = [];
  pendingChecksums = [];

  try {
    await adapter.sendProperties(toSend);
    // Save checksums only after successful ingest
    if (checksumsToSave.length > 0) {
      await saveChecksumsWithRetry(checksumsToSave);
    }
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Sent batch', count: toSend.length }));
  } catch (error) {
    // On error, prepend failed items back so they're retried on next flush
    batch = [...toSend, ...batch];
    pendingChecksums = [...checksumsToSave, ...pendingChecksums];
    console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Failed to send batch', count: toSend.length, err: (error as any)?.message || String(error) }));
  } finally {
    flushing = false;
  }
}

// Worker to process detail fetches
export function createDetailWorker(concurrency: number = 350) {
  const worker = new Worker<DetailJob>(
    'sreality-details',
    async (job: Job<DetailJob>) => {
      const { hashId, category } = job.data;

      try {
        // Apply rate limiting
        await srealityRateLimiter.throttle();

        // Jitter to avoid thundering herd (100-500ms)
        await new Promise(resolve => setTimeout(resolve, getRandomDelay(100, 500)));

        // Fetch detail with rotating headers
        const headers = getRealisticHeaders();
        const detailResult = await fetchEstateDetail(hashId, headers);

        // Skip inactive listings
        if (detailResult.isInactive) {
          skippedInactiveCount++;
          if (skippedInactiveCount <= 10 || skippedInactiveCount % 100 === 0) {
            console.log(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Skipped inactive listing', hashId, reason: detailResult.inactiveReason, totalSkipped: skippedInactiveCount }));
          }
          return { skipped: true, reason: detailResult.inactiveReason };
        }

        // Transform to StandardProperty
        const standardData = transformSRealityToStandard(detailResult.data);

        // Add to batch
        batch.push({
          portalId: `sreality-${hashId}`,
          data: standardData,
          rawData: detailResult.data
        });

        if (job.data.checksum) {
          pendingChecksums.push(job.data.checksum);
        }

        processedCount++;

        // Flush batch if full
        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, hashId, category };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Failed to process hashId', hashId, err: error.message }));
        throw error; // Will trigger retry
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 300000, // 5 minutes (handles rate limiting + retries + jitter)
      lockRenewTime: 150000, // Renew every 2.5 minutes
      limiter: {
        max: 20000, // Max 20k jobs per...
        duration: 60000, // ...60 seconds
      },
    }
  );

  // Event handlers
  worker.on('completed', (job: any) => {
    // Silent success (too noisy to log every completion)
  });

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Job failed', hashId: job?.data.hashId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  // Flush remaining batch on graceful shutdown
  worker.on('closing', async () => {
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Flushing remaining batch before shutdown' }));
    await flushBatch();
  });

  // Periodic flush (every 5 seconds) to ensure timely ingestion
  setInterval(async () => {
    if (batch.length > 0) {
      await flushBatch();
    }
  }, 5000);

  return worker;
}

// Helper to add jobs to queue
export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.hashId}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

// Get queue stats
export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
