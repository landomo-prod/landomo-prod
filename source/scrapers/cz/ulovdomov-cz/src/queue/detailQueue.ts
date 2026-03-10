import { Queue, Worker, Job } from 'bullmq';
import { ChecksumClient, ListingChecksum } from '@landomo/core';
import { fetchDetailPage } from '../scraper/detailScraper';
import { transformUlovDomovToStandard } from '../transformers/ulovdomovTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { UlovDomovOffer } from '../types/ulovdomovTypes';

// Redis connection config
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

const checksumClient = new ChecksumClient(
  process.env.INGEST_API_URL || 'http://cz-ingest:3000',
  process.env.INGEST_API_KEY || process.env['INGEST_API_KEY_ULOVDOMOV'] || 'dev_key_cz_1'
);

// Queue for detail page fetching
export const detailQueue = new Queue('ulovdomov-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100000,
      age: 3600,
    },
    removeOnFail: {
      count: 500,
      age: 7200,
    },
  },
});

// Job data interface
export interface DetailJob {
  offer: UlovDomovOffer;
  scrapeRunId?: string;
  checksum?: ListingChecksum;
}

async function saveChecksumsWithRetry(checksums: ListingChecksum[], maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checksumClient.updateChecksums(checksums);
      return;
    } catch (err: any) {
      if (attempt === maxAttempts) {
        console.error(JSON.stringify({ level: 'error', service: 'ulovdomov-scraper', msg: 'Failed to save checksums after retries', attempts: maxAttempts, err: err.message }));
        return;
      }
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

// Batch accumulators for ingestion
let batch: any[] = [];
let pendingChecksums: ListingChecksum[] = [];
const BATCH_SIZE = 50;
const adapter = new IngestAdapter('ulovdomov');

let flushing = false;
async function flushBatch(scrapeRunId?: string) {
  if (batch.length === 0 || flushing) return;
  flushing = true;

  // Swap arrays BEFORE async work
  const toSend = batch;
  const checksumsToSave = pendingChecksums;
  batch = [];
  pendingChecksums = [];

  try {
    await adapter.sendProperties(toSend, scrapeRunId);
    console.log(JSON.stringify({ level: 'info', service: 'ulovdomov-scraper', msg: 'Batch sent', count: toSend.length }));

    if (checksumsToSave.length > 0) {
      await saveChecksumsWithRetry(checksumsToSave);
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'ulovdomov-scraper', msg: 'Failed to send batch', err: String(error) }));
    // Push items back on failure
    batch.unshift(...toSend);
    pendingChecksums.unshift(...checksumsToSave);
  } finally {
    flushing = false;
  }
}

// Processed count tracker
let processedCount = 0;
export function getProcessedCount(): number {
  return processedCount;
}
export function resetProcessedCount(): void {
  processedCount = 0;
}

// Worker to process detail fetches
export function createDetailWorker(concurrency: number = 10) {
  const worker = new Worker<DetailJob>(
    'ulovdomov-details',
    async (job: Job<DetailJob>) => {
      const { offer, scrapeRunId } = job.data;

      try {
        // Fetch detail page for this offer
        let detailData = null;
        try {
          detailData = await fetchDetailPage(offer.seo, offer.id);
        } catch (err: any) {
          // Log but continue with listing API data only
          console.warn(JSON.stringify({ level: 'warn', service: 'ulovdomov-scraper', msg: 'Detail fetch failed, using API data only', offerId: offer.id, err: err.message }));
        }

        // Merge detail data into offer
        const enrichedOffer: UlovDomovOffer = detailData
          ? { ...offer, _detail: detailData }
          : offer;

        // Transform
        const property = transformUlovDomovToStandard(enrichedOffer);

        // Add to batch
        batch.push({
          portalId: String(offer.id),
          data: property,
          rawData: enrichedOffer,
        });

        // Accumulate checksum
        if (job.data.checksum) {
          pendingChecksums.push(job.data.checksum);
        }

        processedCount++;

        // Flush batch if full
        if (batch.length >= BATCH_SIZE) {
          await flushBatch(scrapeRunId);
        }

        return { success: true, offerId: offer.id, hasDetail: !!detailData };
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'ulovdomov-scraper', msg: 'Detail job failed', offerId: offer.id, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'ulovdomov-scraper', msg: 'Detail job permanently failed', offerId: job?.data?.offer?.id, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'ulovdomov-scraper', msg: 'Worker error', err: err.message }));
  });

  // Periodic flush (every 5 seconds) to ensure timely ingestion
  const flushInterval = setInterval(async () => {
    if (batch.length > 0) {
      await flushBatch();
    }
  }, 5000);

  // Clean up interval on worker close
  const origClose = worker.close.bind(worker);
  worker.close = async function (...args: any[]) {
    clearInterval(flushInterval);
    // Flush remaining batch
    if (batch.length > 0) {
      await flushBatch();
    }
    return origClose(...args);
  };

  return worker;
}

// Helper to add jobs to queue
export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map((job, idx) => ({
    name: `detail-${job.offer.id}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
}

// Get queue stats
export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
