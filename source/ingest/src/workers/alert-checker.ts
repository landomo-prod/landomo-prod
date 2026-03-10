/**
 * Alert Checker Worker
 * Runs periodically via BullMQ to evaluate alert conditions and log warnings.
 * Integrates with Prometheus metrics for external alerting (e.g., Alertmanager).
 */

import { Queue, Worker } from 'bullmq';
import { config } from '../config';
import { getCoreDatabase } from '../database/manager';
import { getInternalQueue } from '../queue/internal-queue';
import { workerLog } from '../logger';
import client from 'prom-client';

// Alert state metric for Prometheus/Alertmanager integration
const alertState = new client.Gauge({
  name: 'landomo_alert_triggered',
  help: 'Whether an alert is currently triggered (1) or not (0)',
  labelNames: ['alert_name', 'severity', 'country'] as const,
});

interface AlertRule {
  name: string;
  severity: 'warning' | 'critical';
  evaluate: () => Promise<{ triggered: boolean; value: number | string; message: string }>;
  threshold: number | string;
}

function buildAlertRules(country: string): AlertRule[] {
  const db = getCoreDatabase(country);

  return [
    {
      name: 'queue_backlog',
      severity: 'critical',
      threshold: 1000,
      evaluate: async () => {
        const queue = getInternalQueue();
        const waiting = await queue.getWaitingCount();
        return {
          triggered: waiting > 1000,
          value: waiting,
          message: `Queue backlog: ${waiting} waiting jobs (threshold: 1000)`,
        };
      },
    },
    {
      name: 'failed_jobs_high',
      severity: 'warning',
      threshold: 50,
      evaluate: async () => {
        const queue = getInternalQueue();
        const failed = await queue.getFailedCount();
        return {
          triggered: failed > 50,
          value: failed,
          message: `Failed jobs: ${failed} (threshold: 50)`,
        };
      },
    },
    {
      name: 'no_ingestion_1h',
      severity: 'warning',
      threshold: '1 hour',
      evaluate: async () => {
        const result = await db.query(`
          SELECT COUNT(*) AS cnt
          FROM properties
          WHERE last_seen_at > NOW() - INTERVAL '1 hour'
        `);
        const count = parseInt(result.rows[0]?.cnt) || 0;
        return {
          triggered: count === 0,
          value: count,
          message: count === 0
            ? 'No properties ingested in the last hour'
            : `${count} properties ingested in the last hour`,
        };
      },
    },
    {
      name: 'db_size_high',
      severity: 'warning',
      threshold: '80% disk',
      evaluate: async () => {
        const result = await db.query(`
          SELECT pg_database_size(current_database()) / (1024 * 1024 * 1024.0) AS size_gb
        `);
        const sizeGb = parseFloat(result.rows[0]?.size_gb) || 0;
        // Alert if DB exceeds 50GB (configurable via env)
        const maxGb = parseInt(process.env.ALERT_DB_MAX_GB || '50', 10);
        return {
          triggered: sizeGb > maxGb,
          value: `${sizeGb.toFixed(2)} GB`,
          message: `Database size: ${sizeGb.toFixed(2)} GB (threshold: ${maxGb} GB)`,
        };
      },
    },
    {
      name: 'stale_portals',
      severity: 'critical',
      threshold: '72 hours',
      evaluate: async () => {
        const result = await db.query(`
          SELECT COUNT(DISTINCT portal) AS cnt
          FROM properties
          WHERE status = 'active'
          GROUP BY portal
          HAVING MAX(last_seen_at) < NOW() - INTERVAL '72 hours'
        `);
        const staleCount = result.rows.length;
        return {
          triggered: staleCount > 0,
          value: staleCount,
          message: staleCount > 0
            ? `${staleCount} portal(s) have not sent data in 72+ hours`
            : 'All portals reporting within 72h window',
        };
      },
    },
    {
      name: 'worker_queue_paused',
      severity: 'critical',
      threshold: 'not paused',
      evaluate: async () => {
        const queue = getInternalQueue();
        const paused = await queue.isPaused();
        return {
          triggered: paused,
          value: paused ? 'paused' : 'active',
          message: paused ? 'Ingestion queue is PAUSED' : 'Queue is active',
        };
      },
    },
  ];
}

async function runAlertCheck(country: string): Promise<void> {
  const rules = buildAlertRules(country);
  const triggered: string[] = [];

  for (const rule of rules) {
    try {
      const result = await rule.evaluate();

      // Update Prometheus gauge
      alertState.set(
        { alert_name: rule.name, severity: rule.severity, country },
        result.triggered ? 1 : 0
      );

      if (result.triggered) {
        triggered.push(rule.name);
        workerLog[rule.severity === 'critical' ? 'error' : 'warn'](
          {
            alert: rule.name,
            severity: rule.severity,
            value: result.value,
            threshold: rule.threshold,
            country,
          },
          `ALERT [${rule.severity.toUpperCase()}]: ${result.message}`
        );
      } else {
        workerLog.debug({ alert: rule.name, country }, `OK: ${result.message}`);
      }
    } catch (err) {
      workerLog.error({ err, alert: rule.name, country }, 'Alert rule evaluation failed');
    }
  }

  workerLog.info(
    { country, totalRules: rules.length, triggeredCount: triggered.length, triggered },
    'Alert check completed'
  );
}

export function startAlertChecker(redisConnection: { host: string; port: number; password?: string }) {
  const country = config.instance.country;
  const queueName = `alert-check-${country}`;

  const queue = new Queue(queueName, { connection: redisConnection });
  const cronPattern = process.env.ALERT_CHECK_CRON || '*/5 * * * *'; // every 5 min

  queue.upsertJobScheduler(
    `alert-scheduler-${country}`,
    { pattern: cronPattern },
    { name: `alert-check-${country}`, data: { country } }
  );

  const worker = new Worker(
    queueName,
    async (job) => {
      const jobCountry = job.data?.country || country;
      await runAlertCheck(jobCountry);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    workerLog.error({ err, jobId: job?.id }, 'Alert check job failed');
  });

  workerLog.info({ country, cron: cronPattern }, 'Alert checker started');

  return { queue, worker };
}
