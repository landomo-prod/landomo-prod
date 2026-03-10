/**
 * Start Batch Ingestion Worker + Staleness Checker
 * Entry point for running background processing workers
 */

import { initSentry } from './sentry';
initSentry('ingest-worker');

import { config } from './config';
import { startBatchIngestionWorker } from './workers/batch-ingestion';
import { startStalenessChecker } from './workers/staleness-checker';
import { startDataQualityChecker } from './workers/data-quality-checker';
import { startPolygonSync } from './workers/polygon-sync';
import { startAlertChecker } from './workers/alert-checker';
import { startGeoBackfill } from './workers/geo-enrichment-backfill';
import { startDedupBackfill } from './workers/dedup-backfill';
import { startQueueCleanup } from './workers/queue-cleanup';
import { workerLog } from './logger';
import { startQueueMetricsCollector, stopQueueMetricsCollector } from './metrics/queue-metrics';
import { registry } from './metrics';
import http from 'http';

workerLog.info('Starting Batch Ingestion Worker');

const ingestionWorker = startBatchIngestionWorker();

workerLog.info('Starting Staleness Checker');

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

const { queue: stalenessQueue, worker: stalenessWorker } = startStalenessChecker(redisConnection);

workerLog.info('Starting Data Quality Checker');

const { queue: dataQualityQueue, worker: dataQualityWorker } = startDataQualityChecker(redisConnection);

workerLog.info('Starting Polygon Sync Scheduler');

const { queue: polygonSyncQueue, worker: polygonSyncWorker } = startPolygonSync(redisConnection);

workerLog.info('Starting Alert Checker');

const { queue: alertQueue, worker: alertWorker } = startAlertChecker(redisConnection);

workerLog.info('Starting Geo Enrichment Backfill');

const { queue: geoBackfillQueue, worker: geoBackfillWorker } = startGeoBackfill(redisConnection);

workerLog.info('Starting Dedup Backfill Worker');

const { queue: dedupBackfillQueue, worker: dedupBackfillWorker } = startDedupBackfill(redisConnection);

workerLog.info('Starting Queue Cleanup Scheduler');

const { queue: queueCleanupQueue, worker: queueCleanupWorker } = startQueueCleanup(redisConnection);

workerLog.info('Starting Queue Metrics Collector');

// Expose worker metrics on a separate port so Prometheus can scrape them
const WORKER_METRICS_PORT = parseInt(process.env.WORKER_METRICS_PORT || '3006');
const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } else {
    res.writeHead(404);
    res.end();
  }
});
metricsServer.listen(WORKER_METRICS_PORT);
workerLog.info({ port: WORKER_METRICS_PORT }, 'Worker metrics server started');

// Start queue metrics collector (every 15 seconds)
const metricsInterval = startQueueMetricsCollector(config.instance.country);

// Graceful shutdown
async function shutdown(signal: string) {
  workerLog.info({ signal }, 'Received shutdown signal, closing workers');

  // Stop queue metrics collection
  stopQueueMetricsCollector(metricsInterval);

  await Promise.all([
    ingestionWorker.close(),
    stalenessWorker.close(),
    stalenessQueue.close(),
    dataQualityWorker.close(),
    dataQualityQueue.close(),
    polygonSyncWorker.close(),
    polygonSyncQueue.close(),
    alertWorker.close(),
    alertQueue.close(),
    geoBackfillWorker.close(),
    geoBackfillQueue.close(),
    dedupBackfillWorker.close(),
    dedupBackfillQueue.close(),
    queueCleanupWorker.close(),
    queueCleanupQueue.close(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

workerLog.info({
  batchConcurrency: config.batch.workers,
  stalenessCron: config.staleness.checkCronPattern,
  stalenessThresholdHours: config.staleness.defaultThresholdHours,
  dataQualityCron: process.env.DATA_QUALITY_CRON || '0 */6 * * *',
  polygonSyncCron: process.env.POLYGON_SYNC_CRON || '0 2 1 * *',
  alertCheckCron: process.env.ALERT_CHECK_CRON || '*/5 * * * *',
  geoBackfillCron: process.env.GEO_BACKFILL_CRON || '0 3 * * *',
  queueCleanupCron: process.env.QUEUE_CLEANUP_CRON || '0 4 * * *',
}, 'All workers started successfully');
