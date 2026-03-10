/**
 * Queue Cleanup Worker
 *
 * Scheduled BullMQ job that purges old completed/failed jobs from
 * scraper detail queues to prevent Redis memory bloat.
 */

import { Queue, Worker } from 'bullmq';
import { config } from '../config';
import { workerLog } from '../logger';

const QUEUE_NAME = `queue-cleanup-${config.instance.country}`;

const SCRAPER_QUEUES = [
  'sreality-details',
  'idnes-details',
  'reality-details',
  'ceskereality-details',
  'realingo-details',
  'ulovdomov-details',
  'bazos-details-llm',
];

// 1 hour in ms
const COMPLETED_MAX_AGE = 3600000;
// 2 hours in ms
const FAILED_MAX_AGE = 7200000;
const CLEAN_LIMIT = 10000;

interface CleanupJobData {
  country: string;
}

export function startQueueCleanup(redisConnection: {
  host: string;
  port: number;
  password?: string;
}): { queue: Queue; worker: Worker } {
  const cronPattern = process.env.QUEUE_CLEANUP_CRON || '0 4 * * *';

  const queue = new Queue(QUEUE_NAME, { connection: redisConnection });

  queue.upsertJobScheduler(
    'queue-cleanup-scheduled',
    { pattern: cronPattern },
    {
      name: 'queue-cleanup',
      data: { country: config.instance.country } as CleanupJobData,
    }
  );

  workerLog.info({ country: config.instance.country, cron: cronPattern }, 'Queue cleanup scheduler registered');

  const worker = new Worker<CleanupJobData>(
    QUEUE_NAME,
    async (job) => {
      workerLog.info('Starting queue cleanup');
      let totalCleaned = 0;

      for (const queueName of SCRAPER_QUEUES) {
        const q = new Queue(queueName, { connection: redisConnection });
        try {
          const completedCleaned = await q.clean(COMPLETED_MAX_AGE, CLEAN_LIMIT, 'completed');
          const failedCleaned = await q.clean(FAILED_MAX_AGE, CLEAN_LIMIT, 'failed');
          const cleaned = (completedCleaned?.length || 0) + (failedCleaned?.length || 0);
          if (cleaned > 0) {
            workerLog.info({ queue: queueName, completed: completedCleaned?.length || 0, failed: failedCleaned?.length || 0 }, 'Cleaned old jobs');
          }
          totalCleaned += cleaned;
        } catch (err) {
          workerLog.warn({ err, queue: queueName }, 'Failed to clean queue');
        } finally {
          await q.close();
        }
      }

      workerLog.info({ totalCleaned }, 'Queue cleanup complete');
      return { totalCleaned };
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    workerLog.error({ err, jobId: job?.id }, 'Queue cleanup job failed');
  });

  return { queue, worker };
}
