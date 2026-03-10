import { Queue, Worker, Job } from 'bullmq';
import { ChecksumClient, ListingChecksum } from '@landomo/core';
import { scrapeDetailPage } from '../scrapers/listingsScraper';
import { transformApartment } from '../transformers/ceskerealityApartmentTransformer';
import { transformHouse } from '../transformers/ceskerealityHouseTransformer';
import { transformLand } from '../transformers/ceskerealityLandTransformer';
import { transformCommercial } from '../transformers/ceskerealityCommercialTransformer';
import { IngestAdapter } from '../adapters/queueIngestAdapter';

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

// Queue for detail page fetching
export const detailQueue = new Queue('ceskereality-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: {
      count: 100000, // Keep last 100k successful jobs — never hit in practice
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
  url: string;
  category: 'apartment' | 'house' | 'land' | 'commercial';
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
        console.error(JSON.stringify({ level: 'error', service: 'ceskereality-scraper', msg: 'Failed to save checksums after retries', attempts: maxAttempts, err: err.message }));
        return;
      }
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

// Batch accumulators for ingestion
let batch: any[] = [];
let pendingChecksums: ListingChecksum[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('ceskereality');

let flushing = false;
let consecutiveFailures = 0;
const MAX_FLUSH_RETRIES = 3;

async function flushBatch() {
  if (batch.length === 0 || flushing) return;
  flushing = true;

  // Swap arrays BEFORE async work — workers continue pushing to new arrays
  const toSend = batch;
  const checksumsToSave = pendingChecksums;
  batch = [];
  pendingChecksums = [];

  try {
    await adapter.sendProperties(toSend);
    console.log(`📤 Sent batch: ${toSend.length} properties`);
    consecutiveFailures = 0;

    // Save checksums only after successful ingest — prevents stale checksums
    // from masking uningested listings if the worker crashed mid-run.
    if (checksumsToSave.length > 0) {
      await saveChecksumsWithRetry(checksumsToSave);
    }
  } catch (error) {
    consecutiveFailures++;
    console.error(`Failed to send batch (failure ${consecutiveFailures}/${MAX_FLUSH_RETRIES}):`, error);
    if (consecutiveFailures < MAX_FLUSH_RETRIES) {
      // Push items back on failure so they are retried on next flush
      batch.unshift(...toSend);
      pendingChecksums.unshift(...checksumsToSave);
    } else {
      console.error(JSON.stringify({ level: 'error', service: 'ceskereality-scraper', msg: 'Circuit breaker: dropping batch after max retries', dropped: toSend.length }));
      // Do not push back — drop the batch to prevent infinite growth
    }
  } finally {
    flushing = false;
  }
}

// Transform based on category
function transformListing(listing: any, category: string) {
  switch (category) {
    case 'apartment':
      return transformApartment(listing.jsonLd, listing.url, listing.htmlData);
    case 'house':
      return transformHouse(listing.jsonLd, listing.url, listing.htmlData);
    case 'land':
      return transformLand(listing.jsonLd, listing.url, listing.htmlData);
    case 'commercial':
      return transformCommercial(listing.jsonLd, listing.url, listing.htmlData);
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

// Worker to process detail fetches
export function createDetailWorker(concurrency: number = 3) {
  const worker = new Worker<DetailJob>(
    'ceskereality-details',
    async (job: Job<DetailJob>) => {
      const { url, category } = job.data;

      try {
        // Fetch detail page (retries handled inside scrapeDetailPage)
        const listing = await scrapeDetailPage(url);

        if (!listing) {
          return { skipped: true, reason: 'Failed to scrape detail page' };
        }

        // Transform to TierI property
        const property = transformListing(listing, category);

        if (!property) {
          return { skipped: true, reason: 'Failed to transform property' };
        }

        // Extract numeric ID from URL (e.g. "-3641486.html" → "ceskereality-3641486")
        const urlMatch = url.match(/-(\d+)\.html$/);
        if (!urlMatch) {
          console.error(JSON.stringify({ level: 'error', service: 'ceskereality-scraper', msg: 'Cannot extract portal ID from URL — skipping', url }));
          return { skipped: true, reason: 'No portal ID in URL' };
        }
        const portalId = `ceskereality-${urlMatch[1]}`;

        // Add to batch
        batch.push({
          portalId,
          data: property,
          rawData: listing
        });

        // Accumulate checksum to save after ingest
        if (job.data.checksum) {
          pendingChecksums.push(job.data.checksum);
        }

        // Flush batch if full
        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, url, category };
      } catch (error: any) {
        console.error(`Failed to process ${url}:`, error.message);
        throw error; // Will trigger retry
      }
    },
    {
      connection: redisConfig,
      concurrency,
    }
  );

  // Event handlers
  worker.on('completed', (job: any) => {
    // Silent success (too noisy to log every completion)
  });

  worker.on('failed', (job: any, err: any) => {
    console.error(`❌ Failed: ${job?.data.url} - ${err.message}`);
  });

  worker.on('error', (err: any) => {
    console.error('Worker error:', err);
  });

  // Flush remaining batch on graceful shutdown
  worker.on('closing', async () => {
    console.log('Flushing remaining batch before shutdown...');
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
  const bulkJobs = jobs.map((job, idx) => ({
    name: `detail-${idx}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(`📥 Queued ${jobs.length} detail jobs`);
}

// Get queue stats
export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
