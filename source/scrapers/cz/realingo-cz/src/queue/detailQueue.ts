import { Queue, Worker, Job } from 'bullmq';
import { ChecksumClient, ListingChecksum } from '@landomo/core';
import { DetailScraper } from '../scrapers/detailScraper';
import { transformRealingoToStandard } from '../transformers/realingoTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { RealingoOffer } from '../types/realingoTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

const QUEUE_NAME = 'realingo-details';
const JOB_BATCH_SIZE = 50;   // offers per job (matches alias-batch size in DetailScraper)
const INGEST_BATCH_SIZE = 100;

export interface DetailJob {
  offers: (RealingoOffer & { _checksum?: ListingChecksum })[];
  scrapeRunId?: string;
}

export const detailQueue = new Queue(QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100000, age: 3600 },
    removeOnFail: { count: 200, age: 7200 },
  },
});

const adapter = new IngestAdapter('realingo');

const checksumClient = new ChecksumClient(
  process.env.INGEST_API_URL || 'http://localhost:3000',
  process.env.INGEST_API_KEY || ''
);

async function saveChecksumsWithRetry(checksums: ListingChecksum[], scrapeRunId?: string, maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checksumClient.updateChecksums(checksums, scrapeRunId);
      return;
    } catch (err: any) {
      if (attempt === maxAttempts) {
        console.error(JSON.stringify({ level: 'error', service: 'realingo-scraper', msg: 'Failed to save checksums after retries', attempts: maxAttempts, err: err.message }));
        return;
      }
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

interface PendingBatchEntry {
  property: any;
  checksum?: ListingChecksum;
}

let ingestBatch: PendingBatchEntry[] = [];
let currentScrapeRunId: string | undefined;
let flushing = false;

async function flushBatch() {
  if (flushing || ingestBatch.length === 0) return;
  flushing = true;
  const toSend = ingestBatch;
  ingestBatch = [];
  const properties = toSend.map(e => e.property);
  const pendingChecksums = toSend
    .map(e => e.checksum)
    .filter((c): c is ListingChecksum => c !== undefined);

  try {
    await adapter.sendProperties(properties);
    console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'Sent ingest batch', count: properties.length }));

    // Save checksums only after successful ingest
    if (pendingChecksums.length > 0) {
      await saveChecksumsWithRetry(pendingChecksums, currentScrapeRunId);
    }
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'realingo-scraper', msg: 'Failed to send ingest batch', err: error.message }));
    // Put items back so they are not silently dropped; the job will be retried
    ingestBatch.unshift(...toSend);
    throw error;
  } finally {
    flushing = false;
  }
}

export function createDetailWorker(concurrency = 10) {
  const detailScraper = new DetailScraper();

  const worker = new Worker<DetailJob>(
    QUEUE_NAME,
    async (job: Job<DetailJob>) => {
      const { offers, scrapeRunId } = job.data;
      currentScrapeRunId = scrapeRunId;

      // Alias-batch fetch details for this job's offers
      const ids = offers.map(o => o.id);
      const detailMap = await detailScraper.fetchDetails(ids);

      // Merge detail into offers, transform, accumulate
      for (const offer of offers) {
        const detail = detailMap.get(offer.id);
        if (detail) offer.detail = detail;

        try {
          const transformed = transformRealingoToStandard(offer);
          ingestBatch.push({
            property: {
              portalId: `realingo-${offer.id}`,
              data: transformed,
              rawData: offer,
            },
            checksum: offer._checksum,
          });
        } catch (err: any) {
          console.error(JSON.stringify({ level: 'error', service: 'realingo-scraper', msg: 'Transform failed', id: offer.id, err: err.message }));
        }
      }

      if (ingestBatch.length >= INGEST_BATCH_SIZE) {
        await flushBatch();
      }

      return { processed: offers.length };
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 120000,
      lockRenewTime: 60000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'realingo-scraper', msg: 'Job failed', err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'realingo-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => { // eslint-disable-line @typescript-eslint/no-misused-promises
    await flushBatch();
  });

  // Periodic flush every 5 seconds
  setInterval(async () => {
    if (ingestBatch.length > 0) await flushBatch();
  }, 5000);

  return worker;
}

export async function addDetailJobs(
  offers: (RealingoOffer & { _checksum?: ListingChecksum })[],
  scrapeRunId?: string
) {
  const jobs = [];
  for (let i = 0; i < offers.length; i += JOB_BATCH_SIZE) {
    jobs.push({
      name: `detail-${Date.now()}-${i}`,
      data: { offers: offers.slice(i, i + JOB_BATCH_SIZE), scrapeRunId },
    });
  }
  await detailQueue.addBulk(jobs);
  console.log(JSON.stringify({ level: 'info', service: 'realingo-scraper', msg: 'Queued detail jobs', batches: jobs.length, offers: offers.length }));
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
