import { Queue, Worker, Job } from 'bullmq';
import * as fs from 'fs';
import { fetchListingDetail } from '../utils/fetchData';
import { getRandomDelay } from '../utils/headers';
import { transformIdnesToStandard } from '../transformers/idnesTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { ChecksumClient, ListingChecksum } from '@landomo/core';

function readSecret(name: string, fallback?: string): string | undefined {
  try {
    const val = fs.readFileSync(`/run/secrets/${name}`, 'utf8').trim();
    return val || fallback;
  } catch {
    return fallback;
  }
}

// Redis connection config
const redisPassword = readSecret('redis_password', process.env.REDIS_PASSWORD);
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(redisPassword && { password: redisPassword }),
};

const checksumClient = new ChecksumClient(
  process.env.INGEST_API_URL || 'http://localhost:3000',
  process.env.INGEST_API_KEY || ''
);

// Queue for detail fetching
export const detailQueue = new Queue('idnes-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
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
  listingId: string;
  url: string;
  propertyType: string;
  transactionType: string;
  checksum?: ListingChecksum;
}

async function saveChecksumsWithRetry(checksums: ListingChecksum[], maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checksumClient.updateChecksums(checksums);
      return;
    } catch (err: any) {
      if (attempt === maxAttempts) {
        console.error(JSON.stringify({ level: 'error', service: 'idnes-scraper', msg: 'Failed to save checksums after retries', attempts: maxAttempts, err: err.message }));
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
const adapter = new IngestAdapter('idnes-reality');

// Mutex to prevent concurrent flushBatch calls from racing
let flushing = false;

async function flushBatch() {
  if (batch.length === 0 || flushing) return;
  flushing = true;

  // Swap arrays BEFORE the async send — new items from concurrent workers
  // go into fresh arrays while we send the old ones. Prevents orphaning items
  // pushed during the sendProperties network call.
  const toSend = batch;
  const checksumsToSave = pendingChecksums;
  batch = [];
  pendingChecksums = [];

  try {
    await adapter.sendProperties(toSend);
    if (checksumsToSave.length > 0) {
      await saveChecksumsWithRetry(checksumsToSave);
    }
    console.log(JSON.stringify({ level: 'info', service: 'idnes-scraper', msg: 'Sent batch', count: toSend.length }));
  } catch (error) {
    // On error, prepend failed items back so they're retried on next flush
    batch = [...toSend, ...batch];
    pendingChecksums = [...checksumsToSave, ...pendingChecksums];
    console.error(JSON.stringify({ level: 'error', service: 'idnes-scraper', msg: 'Failed to send batch', count: toSend.length, err: (error as any)?.message || String(error) }));
  } finally {
    flushing = false;
  }
}

// Worker to process detail fetches
export function createDetailWorker(concurrency: number = 50) {
  const worker = new Worker<DetailJob>(
    'idnes-details',
    async (job: Job<DetailJob>) => {
      const { listingId, url, propertyType, transactionType } = job.data;

      try {
        // Delay + jitter to avoid 429s
        await new Promise(resolve => setTimeout(resolve, 500 + Math.floor(Math.random() * 300)));

        // Fetch detail page
        const detailData = await fetchListingDetail(url);

        // Skip inactive/sold listings
        if (detailData._inactive) {
          return { success: true, listingId, skipped: 'inactive' };
        }

        // Derive transaction type from the canonical URL — the category page
        // can misclassify listings (e.g. rent listing on the sale index page).
        // The detail URL is the source of truth: /detail/pronajem/... vs /detail/prodej/...
        const canonicalUrl = detailData.canonicalUrl || url;
        const urlBasedType = /\/pronaj[eé]m\//i.test(canonicalUrl) ? 'rent'
          : /\/prodej\//i.test(canonicalUrl) ? 'sale'
          : transactionType;

        // Build IdnesListing from detail data
        const listing: any = {
          id: listingId,
          url: canonicalUrl,
          propertyType,
          transactionType: urlBasedType,
          title: detailData.title,
          price: detailData.price,
          priceText: detailData.priceText,
          description: detailData.description,
          features: detailData.features,
          images: detailData.images,
          coordinates: detailData.coordinates,
          area: detailData.area,
          _attributes: detailData.attributes,
          realtor: detailData.realtor,
        };

        // Map location from detail data
        if (detailData.location) {
          listing.location = {
            city: detailData.location.city,
            district: detailData.location.district,
            region: detailData.location.region,
            address: detailData.location.cityArea
              ? `${detailData.location.city} - ${detailData.location.cityArea}`
              : undefined,
          };
        }

        // Parse attributes for structured fields
        const attrs = detailData.attributes || {};
        if (attrs['vlastnictví']) listing.ownership = attrs['vlastnictví'];
        if (attrs['stav bytu'] || attrs['stav budovy'] || attrs['stav objektu']) {
          listing.condition = attrs['stav bytu'] || attrs['stav budovy'] || attrs['stav objektu'];
        }
        if (attrs['vybavení'] || attrs['vybavení domu']) listing.furnished = attrs['vybavení'] || attrs['vybavení domu'];
        if (attrs['penb']) listing.energyRating = attrs['penb'];
        if (attrs['topné těleso'] || attrs['vytápění']) {
          listing.heatingType = attrs['topné těleso'] || attrs['vytápění'];
        }
        if (attrs['konstrukce budovy'] || attrs['typ stavby']) {
          listing.constructionType = attrs['konstrukce budovy'] || attrs['typ stavby'];
        }

        // Extract plot area from attributes (for houses/land)
        if (attrs['plocha pozemku']) {
          const plotMatch = attrs['plocha pozemku'].match(/([\d\s]+)/);
          if (plotMatch) listing.plotArea = parseInt(plotMatch[1].replace(/\s/g, ''));
        }

        // Extract floor from attributes
        if (attrs['podlaží']) {
          const floorText = attrs['podlaží'].toLowerCase();
          if (floorText.includes('přízemí')) {
            listing.floor = 0;
          } else {
            const floorMatch = floorText.match(/(\d+)/);
            if (floorMatch) listing.floor = parseInt(floorMatch[1]);
          }
        }

        // Transform to StandardProperty
        const standardData = transformIdnesToStandard(listing);

        // Add to batch
        batch.push({
          portalId: `idnes-${listingId}`,
          data: standardData,
          rawData: detailData,
        });

        if (job.data.checksum) {
          pendingChecksums.push(job.data.checksum);
        }

        // Flush batch if full
        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }

        return { success: true, listingId };
      } catch (error: any) {
        console.error(`Failed to process listing ${listingId}:`, error.message);
        throw error; // Will trigger retry
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 120000,
      lockRenewTime: 60000,
    }
  );

  // Event handlers
  worker.on('completed', (job: any) => {
    // Silent success
  });

  worker.on('failed', (job: any, err: any) => {
    console.error(`❌ Failed: ${job?.data.listingId} - ${err.message}`);
  });

  worker.on('error', (err: any) => {
    console.error('Worker error:', err);
  });

  // Flush remaining batch on graceful shutdown
  worker.on('closing', async () => {
    console.log('Flushing remaining batch before shutdown...');
    await flushBatch();
  });

  // Periodic flush (every 5 seconds)
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
    name: `detail-${job.listingId}`,
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
