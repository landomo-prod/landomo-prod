import { Queue, Worker, Job } from 'bullmq';
import { ChecksumClient, ListingChecksum } from '@landomo/core';
import { getRealityAuth } from '../utils/realityAuth';
import { apiDetailToListing } from '../types/realityTypes';
import { transformRealityToStandard } from '../transformers/realityTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3');
const RATE_LIMIT_MS = parseInt(process.env.DETAIL_RATE_LIMIT_MS || '1500');
const BATCH_SIZE = 50;

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

const checksumClient = new ChecksumClient(
  process.env.INGEST_API_URL || 'http://localhost:3000',
  process.env.INGEST_API_KEY || ''
);

export const detailQueue = new Queue('reality-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 100000, age: 3600 },
    removeOnFail: { count: 200, age: 7200 },
  },
});

export interface DetailJob {
  id: string;
  transactionType: 'sale' | 'rent';
  checksum?: ListingChecksum;
}

async function saveChecksumsWithRetry(checksums: ListingChecksum[], maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checksumClient.updateChecksums(checksums);
      return;
    } catch (err: any) {
      if (attempt === maxAttempts) {
        console.error(JSON.stringify({ level: 'error', service: 'reality-scraper', msg: 'Failed to save checksums after retries', attempts: maxAttempts, err: err.message }));
        return;
      }
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

let batch: any[] = [];
let pendingChecksums: ListingChecksum[] = [];
let flushing = false;
const adapter = new IngestAdapter('reality');

async function flushBatch() {
  if (batch.length === 0 || flushing) return;
  flushing = true;

  // Swap batch and checksums BEFORE async work — prevents race with items pushed during await
  const toSend = batch;
  const checksumsToSave = pendingChecksums;
  batch = [];
  pendingChecksums = [];
  const size = toSend.length;

  try {
    await adapter.sendProperties(toSend);
    console.log(`Flushed ${size} reality properties to ingest`);

    // Save checksums only after successful ingest
    if (checksumsToSave.length > 0) {
      await saveChecksumsWithRetry(checksumsToSave);
    }
  } catch (error) {
    // Re-prepend failed items so they retry on next flush
    batch = toSend.concat(batch);
    pendingChecksums = checksumsToSave.concat(pendingChecksums);
    console.error('Failed to flush batch:', error);
  } finally {
    flushing = false;
  }
}

export function createDetailWorker() {
  const auth = getRealityAuth();

  const worker = new Worker<DetailJob>(
    'reality-details',
    async (job: Job<DetailJob>) => {
      const { id, transactionType } = job.data;

      // Fixed delay + jitter to avoid 429s
      const jitter = Math.floor(Math.random() * 500);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS + jitter));

      const detail = await auth.request<any>(`/${id}/`);

      if (!detail || detail.err || !detail.id) {
        return { skipped: true, reason: detail?.err ?? (!detail?.id ? 'no id' : 'no detail') };
      }

      const listing = apiDetailToListing(detail, transactionType);
      const standardData = transformRealityToStandard(listing);

      batch.push({
        portalId: listing.id,
        data: standardData,
        rawData: listing,
      });

      // Accumulate checksum to save after ingest
      if (job.data.checksum) {
        pendingChecksums.push(job.data.checksum);
      }

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }

      return { success: true, id };
    },
    {
      connection: redisConfig,
      concurrency: WORKER_CONCURRENCY,
      lockDuration: 120000,
      lockRenewTime: 60000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(`❌ Detail job failed ${job?.data?.id}: ${err.message}`);
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  // Periodic flush every 10s so data doesn't sit in memory
  setInterval(() => flushBatch(), 10000);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.id}`,
    data: job,
  }));
  await detailQueue.addBulk(bulkJobs);
  console.log(`📥 Queued ${jobs.length} reality detail jobs`);
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
