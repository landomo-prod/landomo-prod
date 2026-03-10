import { Queue, Worker, Job } from 'bullmq';
import { launchBrowser, createContext, navigateWithRetry, handleCookieConsent, extractNextData, randomDelay } from '../utils/browser';
import { transformImmoweltToStandard } from '../transformers/immoweltTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { Browser } from 'playwright';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

export const detailQueue = new Queue('immowelt-at-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 3600,
    },
    removeOnFail: {
      count: 500,
      age: 7200,
    },
  },
});

export interface DetailJob {
  listingId: string;
  url: string;
  transactionType?: string;
  propertyType?: string;
  searchData?: any;
}

// Batch accumulator
let batch: any[] = [];
const BATCH_SIZE = 100;
const adapter = new IngestAdapter('immowelt-at');

async function flushBatch() {
  if (batch.length === 0) return;

  const batchSize = batch.length;
  try {
    await adapter.sendProperties(batch);
    batch = [];
    console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Sent batch', count: batchSize }));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', service: 'immowelt-at-scraper', msg: 'Failed to send batch', err: (error as any)?.message || String(error) }));
  }
}

// Playwright browser-based detail worker
// Low concurrency (3) because Playwright is memory-heavy
export function createDetailWorker(concurrency: number = 3) {
  let browser: Browser | null = null;

  const worker = new Worker<DetailJob>(
    'immowelt-at-details',
    async (job: Job<DetailJob>) => {
      const { listingId, url, searchData, transactionType, propertyType } = job.data;

      try {
        // If we have searchData from Phase 1, transform directly
        if (searchData) {
          if (transactionType) searchData.transactionType = transactionType;
          if (propertyType) searchData.propertyType = propertyType;

          const standardData = transformImmoweltToStandard(searchData);

          batch.push({
            portalId: listingId,
            data: standardData,
            rawData: searchData,
          });

          if (batch.length >= BATCH_SIZE) {
            await flushBatch();
          }

          return { success: true, listingId, method: 'search-data' };
        }

        // Fallback: Visit detail page with browser
        if (!browser) {
          browser = await launchBrowser({ headless: true });
        }

        const context = await createContext(browser);
        const page = await context.newPage();

        try {
          await navigateWithRetry(page, url, 3, 30000);
          await handleCookieConsent(page);
          await randomDelay(1000, 2000);

          // Try __NEXT_DATA__ extraction
          const nextData = await extractNextData(page);
          const listing: any = {
            id: listingId,
            url,
            transactionType,
            propertyType,
          };

          if (nextData?.props?.pageProps) {
            const expose = nextData.props.pageProps.expose || nextData.props.pageProps.property || nextData.props.pageProps;
            Object.assign(listing, expose);
          }

          const standardData = transformImmoweltToStandard(listing);

          batch.push({
            portalId: listingId,
            data: standardData,
            rawData: listing,
          });

          if (batch.length >= BATCH_SIZE) {
            await flushBatch();
          }

          return { success: true, listingId, method: 'detail-page' };
        } finally {
          await page.close().catch(() => {});
          await context.close().catch(() => {});
        }
      } catch (error: any) {
        console.error(JSON.stringify({ level: 'error', service: 'immowelt-at-scraper', msg: 'Failed to process listing', listingId, err: error.message }));
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 300000,
      lockRenewTime: 150000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immowelt-at-scraper', msg: 'Job failed', listingId: job?.data.listingId, err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immowelt-at-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Flushing remaining batch before shutdown' }));
    await flushBatch();
    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }
  });

  // Periodic flush every 5 seconds
  setInterval(async () => {
    if (batch.length > 0) {
      await flushBatch();
    }
  }, 5000);

  return worker;
}

export async function addDetailJobs(jobs: DetailJob[]) {
  const bulkJobs = jobs.map(job => ({
    name: `detail-${job.listingId}`,
    data: job,
  }));

  await detailQueue.addBulk(bulkJobs);
  console.log(JSON.stringify({ level: 'info', service: 'immowelt-at-scraper', msg: 'Queued detail jobs', count: jobs.length }));
}

export async function getQueueStats() {
  const waiting = await detailQueue.getWaitingCount();
  const active = await detailQueue.getActiveCount();
  const completed = await detailQueue.getCompletedCount();
  const failed = await detailQueue.getFailedCount();

  return { waiting, active, completed, failed };
}
