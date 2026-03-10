/**
 * Staleness Checker Worker
 * Scheduled BullMQ job that detects and marks stale listings as removed.
 * Runs inside existing worker containers (no new containers needed).
 */

import { Queue, Worker } from 'bullmq';
import { config } from '../config';
import { getCoreDatabase } from '../database/manager';
import { markStalePropertiesRemoved, reapOrphanedRuns } from '../database/staleness-operations';
import {
  stalenessMarkedRemovedTotal,
  stalenessCircuitBreakerSkipsTotal,
  stalenessCheckDurationSeconds,
  orphanedRunsReapedTotal,
  errorsTotal,
  propertiesDeactivatedTotal,
  propertiesStatusChangedTotal,
} from '../metrics';
import { stalenessLog } from '../logger';

const QUEUE_NAME = `staleness-check-${config.instance.country}`;

interface StalenessJobData {
  country: string;
}

/**
 * Start the staleness checker: creates a scheduled repeatable job
 * and a worker to process it.
 */
export function startStalenessChecker(redisConnection: {
  host: string;
  port: number;
  password?: string;
}): { queue: Queue; worker: Worker } {
  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
  });

  // Register repeatable job via BullMQ v5 job scheduler
  queue.upsertJobScheduler(
    'staleness-check-scheduled',
    { pattern: config.staleness.checkCronPattern },
    {
      name: 'check-staleness',
      data: { country: config.instance.country } as StalenessJobData,
    }
  );

  const worker = new Worker<StalenessJobData>(
    QUEUE_NAME,
    async (job) => {
      const { country } = job.data;
      stalenessLog.info({ country }, 'Running staleness check');

      try {
        const pool = getCoreDatabase(country);

        // Reap orphaned scrape runs before checking staleness
        const reapedCount = await reapOrphanedRuns(pool);
        if (reapedCount > 0) {
          orphanedRunsReapedTotal.inc(reapedCount);
          stalenessLog.info({ reapedCount }, 'Reaped orphaned scrape runs before staleness check');
        }

        const result = await markStalePropertiesRemoved(
          pool,
          config.staleness.defaultThresholdHours,
          config.staleness.batchSize
        );

        // Record staleness metrics
        stalenessCheckDurationSeconds.observe(result.duration / 1000);
        if (result.markedRemoved > 0) {
          stalenessMarkedRemovedTotal.inc(result.markedRemoved);
          // Business KPI: deactivated estates
          propertiesDeactivatedTotal.inc(
            { country, category: 'all', reason: 'removed' },
            result.markedRemoved
          );
          propertiesStatusChangedTotal.inc(
            { country, from_status: 'active', to_status: 'removed' },
            result.markedRemoved
          );
        }
        if (result.skippedPortals.length > 0) {
          stalenessCircuitBreakerSkipsTotal.inc(result.skippedPortals.length);
        }

        stalenessLog.info({
          markedRemoved: result.markedRemoved,
          skippedPortals: result.skippedPortals,
          durationMs: result.duration,
        }, 'Staleness check complete');

        return result;
      } catch (error) {
        errorsTotal.inc({ type: 'staleness_check' });
        stalenessLog.error({ err: error }, 'Staleness check failed');
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // One staleness check at a time
    }
  );

  worker.on('completed', (job) => {
    stalenessLog.debug({ jobId: job.id, result: job.returnvalue }, 'Staleness job completed');
  });

  worker.on('failed', (job, err) => {
    stalenessLog.error({ jobId: job?.id, err }, 'Staleness job failed');
  });

  return { queue, worker };
}
