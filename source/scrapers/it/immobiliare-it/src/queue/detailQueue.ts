import { Queue, Worker, Job } from 'bullmq';
import { transformImmobiliareToStandard } from '../transformers/immobiliareTransformer';
import { IngestAdapter } from '../adapters/ingestAdapter';
import { ImmobiliareResult, SearchConfig } from '../types/immobiliareTypes';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

const QUEUE_NAME = 'immobiliare-it-details';
const JOB_BATCH_SIZE = 50;
const INGEST_BATCH_SIZE = 100;

export interface DetailJob {
  results: ImmobiliareResult[];
  config?: SearchConfig;
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

const adapter = new IngestAdapter('immobiliare.it');
let ingestBatch: any[] = [];

async function flushBatch() {
  if (ingestBatch.length === 0) return;
  const toSend = ingestBatch.splice(0, ingestBatch.length);
  try {
    await adapter.sendProperties(toSend);
    console.log(JSON.stringify({ level: 'info', service: 'immobiliare-scraper', msg: 'Sent ingest batch', count: toSend.length }));
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'immobiliare-scraper', msg: 'Failed to send ingest batch', err: error.message }));
  }
}

export function createDetailWorker(concurrency = 10) {
  const worker = new Worker<DetailJob>(
    QUEUE_NAME,
    async (job: Job<DetailJob>) => {
      const { results, config } = job.data;

      for (const result of results) {
        try {
          const transformed = transformImmobiliareToStandard(result, config);
          ingestBatch.push({
            portalId: `immobiliare-it-${result.realEstate.id}`,
            data: transformed,
            rawData: result,
          });
        } catch (err: any) {
          console.error(JSON.stringify({ level: 'error', service: 'immobiliare-scraper', msg: 'Transform failed', id: result.realEstate?.id, err: err.message }));
        }
      }

      if (ingestBatch.length >= INGEST_BATCH_SIZE) {
        await flushBatch();
      }

      return { processed: results.length };
    },
    {
      connection: redisConfig,
      concurrency,
      lockDuration: 120000,
      lockRenewTime: 60000,
    }
  );

  worker.on('failed', (job: any, err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immobiliare-scraper', msg: 'Job failed', err: err.message }));
  });

  worker.on('error', (err: any) => {
    console.error(JSON.stringify({ level: 'error', service: 'immobiliare-scraper', msg: 'Worker error', err: err?.message || String(err) }));
  });

  worker.on('closing', async () => {
    await flushBatch();
  });

  setInterval(async () => {
    if (ingestBatch.length > 0) await flushBatch();
  }, 5000);

  return worker;
}

export async function addDetailJobs(results: ImmobiliareResult[], config?: SearchConfig) {
  const jobs = [];
  for (let i = 0; i < results.length; i += JOB_BATCH_SIZE) {
    jobs.push({
      name: `detail-${Date.now()}-${i}`,
      data: { results: results.slice(i, i + JOB_BATCH_SIZE), config },
    });
  }
  await detailQueue.addBulk(jobs);
  console.log(JSON.stringify({ level: 'info', service: 'immobiliare-scraper', msg: 'Queued detail jobs', batches: jobs.length, results: results.length }));
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
