/**
 * Prometheus Metrics for Ingest Service
 */

import client from 'prom-client';

// Collect default Node.js metrics (GC, event loop, heap)
client.collectDefaultMetrics({
  prefix: 'landomo_ingest_',
});

export const registry = client.register;

// --- HTTP request metrics ---

export const httpRequestsTotal = new client.Counter({
  name: 'landomo_ingest_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['route', 'method', 'status'] as const,
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'landomo_ingest_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// --- Ingestion metrics ---

export const propertiesIngestedTotal = new client.Counter({
  name: 'landomo_ingest_properties_ingested_total',
  help: 'Total number of properties ingested (inserted)',
  labelNames: ['country', 'portal'] as const,
});

export const propertiesUpdatedTotal = new client.Counter({
  name: 'landomo_ingest_properties_updated_total',
  help: 'Total number of properties updated on re-ingest',
  labelNames: ['country', 'portal'] as const,
});

export const propertiesSkippedTotal = new client.Counter({
  name: 'landomo_ingest_properties_skipped_total',
  help: 'Total number of properties skipped (terminal status)',
  labelNames: ['country', 'portal'] as const,
});

export const batchSize = new client.Histogram({
  name: 'landomo_ingest_batch_size',
  help: 'Number of properties per batch operation',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

export const batchDurationSeconds = new client.Histogram({
  name: 'landomo_ingest_batch_duration_seconds',
  help: 'Duration of batch insert/update operations in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// --- Queue metrics ---

export const queueDepth = new client.Gauge({
  name: 'landomo_ingest_queue_depth',
  help: 'Number of jobs currently waiting in the ingestion queue',
});

// --- Error metrics ---

export const errorsTotal = new client.Counter({
  name: 'landomo_ingest_errors_total',
  help: 'Total number of errors by type',
  labelNames: ['type'] as const,
});

// --- Scrape run metrics ---

export const scrapeRunsActive = new client.Gauge({
  name: 'landomo_ingest_scrape_runs_active',
  help: 'Number of currently active (running) scrape runs',
});

// --- Staleness metrics ---

export const stalenessMarkedRemovedTotal = new client.Counter({
  name: 'landomo_ingest_staleness_marked_removed_total',
  help: 'Total properties marked removed by staleness checks',
});

export const stalenessCircuitBreakerSkipsTotal = new client.Counter({
  name: 'landomo_ingest_staleness_circuit_breaker_skips_total',
  help: 'Total portals skipped by the staleness circuit breaker',
});

export const stalenessCheckDurationSeconds = new client.Histogram({
  name: 'landomo_ingest_staleness_check_duration_seconds',
  help: 'Duration of staleness check operations in seconds',
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
});

export const orphanedRunsReapedTotal = new client.Counter({
  name: 'landomo_ingest_orphaned_runs_reaped_total',
  help: 'Total orphaned scrape runs reaped',
});

// --- Database pool metrics ---

export const dbPoolActive = new client.Gauge({
  name: 'landomo_ingest_db_pool_active',
  help: 'Number of active database connections in the pool',
});

export const dbPoolIdle = new client.Gauge({
  name: 'landomo_ingest_db_pool_idle',
  help: 'Number of idle database connections in the pool',
});

// --- Data quality metrics ---

export const dataQualityScore = new client.Gauge({
  name: 'landomo_data_quality_score',
  help: 'Overall data quality score per country/portal (0-100)',
  labelNames: ['country', 'portal'] as const,
});

export const missingPricePct = new client.Gauge({
  name: 'landomo_properties_missing_price_pct',
  help: 'Percentage of active properties missing price',
  labelNames: ['country', 'portal'] as const,
});

export const missingCoordinatesPct = new client.Gauge({
  name: 'landomo_properties_missing_coordinates_pct',
  help: 'Percentage of active properties missing coordinates',
  labelNames: ['country', 'portal'] as const,
});

export const missingImagesPct = new client.Gauge({
  name: 'landomo_properties_missing_images_pct',
  help: 'Percentage of active properties missing images',
  labelNames: ['country', 'portal'] as const,
});

export const suspiciousPricePct = new client.Gauge({
  name: 'landomo_properties_suspicious_price_pct',
  help: 'Percentage of active properties with suspicious prices',
  labelNames: ['country', 'portal'] as const,
});

export const scraperFreshnessHours = new client.Gauge({
  name: 'landomo_scraper_freshness_hours',
  help: 'Hours since newest listing update per country/portal',
  labelNames: ['country', 'portal'] as const,
});

export const updatedLast7dPct = new client.Gauge({
  name: 'landomo_properties_updated_last_7d_pct',
  help: 'Percentage of active properties updated in the last 7 days',
  labelNames: ['country', 'portal'] as const,
});

// --- Business KPI metrics: New Estates ---

export const propertiesNewTotal = new client.Counter({
  name: 'landomo_properties_total',
  help: 'Total new properties inserted (counter)',
  labelNames: ['country', 'category', 'portal'] as const,
});

export const propertiesNewRate = new client.Gauge({
  name: 'landomo_properties_rate',
  help: 'New properties per hour (gauge, updated per batch)',
  labelNames: ['country'] as const,
});

// --- Business KPI metrics: Price Changes ---

export const propertiesPriceChangedTotal = new client.Counter({
  name: 'landomo_properties_price_changed_total',
  help: 'Properties with price changes',
  labelNames: ['country', 'category', 'change_type'] as const,
});

export const propertiesPriceChangeAvgPercent = new client.Gauge({
  name: 'landomo_properties_price_change_avg_percent',
  help: 'Average price change percentage',
  labelNames: ['country', 'category'] as const,
});

// --- Business KPI metrics: Deactivated Estates ---

export const propertiesDeactivatedTotal = new client.Counter({
  name: 'landomo_properties_deactivated_total',
  help: 'Properties deactivated (sold, rented, or removed)',
  labelNames: ['country', 'category', 'reason'] as const,
});

export const propertiesStatusChangedTotal = new client.Counter({
  name: 'landomo_properties_status_changed_total',
  help: 'Property status transitions',
  labelNames: ['country', 'from_status', 'to_status'] as const,
});

export const propertiesTimeToDeactivationDays = new client.Histogram({
  name: 'landomo_properties_time_to_deactivation_days',
  help: 'Days from first seen to deactivation',
  labelNames: ['country', 'category'] as const,
  buckets: [1, 3, 7, 14, 30, 60, 90, 180, 365],
});

// --- Scraper KPIs (emitted by scrapers, recorded here for reference) ---

export const scraperListingsFound = new client.Gauge({
  name: 'landomo_scraper_listings_found',
  help: 'Listings found in most recent scrape run',
  labelNames: ['portal', 'category'] as const,
});

export const scraperSuccessRate = new client.Gauge({
  name: 'landomo_scraper_success_rate',
  help: 'Scraper success rate (0-1) from scrape_runs table',
  labelNames: ['portal'] as const,
});

export const scraperLastRunTimestamp = new client.Gauge({
  name: 'landomo_scraper_last_run_timestamp',
  help: 'Unix timestamp of last completed scrape run',
  labelNames: ['portal'] as const,
});

export const scraperErrorCount = new client.Counter({
  name: 'landomo_scraper_error_count',
  help: 'Scraper errors by type',
  labelNames: ['portal', 'error_type'] as const,
});

// Re-export BullMQ queue metrics
export {
  queueWaitingJobs,
  queueActiveJobs,
  queueCompletedJobs,
  queueFailedJobs,
  queueDelayedJobs,
  queuePaused,
} from './queue-metrics';
