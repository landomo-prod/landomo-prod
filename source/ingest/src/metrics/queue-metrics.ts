/**
 * BullMQ Queue Metrics Collector
 * Periodically collects detailed queue statistics for Prometheus
 */

import client from 'prom-client';
import { getInternalQueue } from '../queue/internal-queue';
import { workerLog } from '../logger';

// BullMQ-specific queue metrics
export const queueWaitingJobs = new client.Gauge({
  name: 'landomo_ingest_queue_waiting_jobs',
  help: 'Number of jobs waiting to be processed',
  labelNames: ['country'] as const,
});

export const queueActiveJobs = new client.Gauge({
  name: 'landomo_ingest_queue_active_jobs',
  help: 'Number of jobs currently being processed',
  labelNames: ['country'] as const,
});

export const queueCompletedJobs = new client.Gauge({
  name: 'landomo_ingest_queue_completed_jobs',
  help: 'Number of completed jobs (last 24h)',
  labelNames: ['country'] as const,
});

export const queueFailedJobs = new client.Gauge({
  name: 'landomo_ingest_queue_failed_jobs',
  help: 'Number of failed jobs (last 24h)',
  labelNames: ['country'] as const,
});

export const queueDelayedJobs = new client.Gauge({
  name: 'landomo_ingest_queue_delayed_jobs',
  help: 'Number of delayed/scheduled jobs',
  labelNames: ['country'] as const,
});

export const queuePaused = new client.Gauge({
  name: 'landomo_ingest_queue_paused',
  help: 'Queue paused status (1 = paused, 0 = active)',
  labelNames: ['country'] as const,
});

/**
 * Collect queue statistics and update Prometheus metrics
 */
export async function collectQueueMetrics(country: string): Promise<void> {
  try {
    const queue = getInternalQueue();

    // Get all queue counts in parallel
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    // Update Prometheus metrics
    queueWaitingJobs.set({ country }, waiting);
    queueActiveJobs.set({ country }, active);
    queueCompletedJobs.set({ country }, completed);
    queueFailedJobs.set({ country }, failed);
    queueDelayedJobs.set({ country }, delayed);
    queuePaused.set({ country }, isPaused ? 1 : 0);

    workerLog.debug(
      {
        country,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
      },
      'Queue metrics collected'
    );
  } catch (err) {
    workerLog.error({ err, country }, 'Failed to collect queue metrics');
  }
}

/**
 * Start periodic queue metrics collection
 * @param country - Country code for labeling
 * @param intervalMs - Collection interval in milliseconds (default: 15s)
 */
export function startQueueMetricsCollector(country: string, intervalMs = 15000): NodeJS.Timeout {
  workerLog.info({ country, intervalMs }, 'Starting queue metrics collector');

  // Collect immediately on start
  collectQueueMetrics(country).catch((err) => {
    workerLog.error({ err }, 'Initial queue metrics collection failed');
  });

  // Then collect periodically
  const interval = setInterval(() => {
    collectQueueMetrics(country).catch((err) => {
      workerLog.error({ err }, 'Queue metrics collection failed');
    });
  }, intervalMs);

  return interval;
}

/**
 * Stop queue metrics collection
 */
export function stopQueueMetricsCollector(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  workerLog.info('Queue metrics collector stopped');
}
