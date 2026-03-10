import { Worker, Job } from 'bullmq';
import { PropertyBatchEvent } from '@landomo/core';
import { WatchdogEvaluator } from '../watchdog-evaluator';
import { NotificationRouter } from '../notification-router';
import { config } from '../config';
import { logger } from '../logger';
import { watchdogMatchesTotal, evaluationDuration } from '../metrics';

export function startEvaluateWorker(
  evaluator: WatchdogEvaluator,
  router: NotificationRouter
): Worker {
  const worker = new Worker<PropertyBatchEvent>(
    `notify-evaluate-${config.country}`,
    async (job: Job<PropertyBatchEvent>) => {
      const event = job.data;
      const startMs = Date.now();

      const matches = evaluator.evaluate(event.changes);

      const durationSec = (Date.now() - startMs) / 1000;
      evaluationDuration.observe({ country: config.country }, durationSec);

      // Track matches by event type
      for (const m of matches) {
        watchdogMatchesTotal.inc({ country: config.country, event_type: m.change.event_type });
      }

      if (matches.length === 0) {
        return { matches: 0, dispatched: 0, deduped: 0, capped: 0, errors: 0, durationMs: Date.now() - startMs };
      }

      const result = await router.route(matches);
      const durationMs = Date.now() - startMs;

      logger.info(
        {
          portal: event.portal,
          changes: event.changes.length,
          matches: matches.length,
          dispatched: result.dispatched,
          deduped: result.deduped,
          capped: result.capped,
          errors: result.errors,
          duration_ms: durationMs,
        },
        'batch evaluated'
      );

      return { matches: matches.length, ...result, durationMs };
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: 1, // Sequential evaluation — one batch at a time
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ job_id: job?.id, err: err.message }, 'evaluate job failed');
  });

  return worker;
}
