/**
 * Prometheus Metrics for Search Service
 *
 * Defines all custom metrics and collects default Node.js metrics.
 */

import client from 'prom-client';
import { getPoolStats } from '../database/multi-db-manager';

// Collect default Node.js metrics (event loop, heap, GC, etc.)
client.collectDefaultMetrics({ prefix: 'landomo_search_' });

// --- Request metrics ---

export const httpRequestsTotal = new client.Counter({
  name: 'landomo_search_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['route', 'method', 'status'] as const,
});

export const httpRequestDuration = new client.Histogram({
  name: 'landomo_search_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['route'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// --- Search-specific metrics ---

export const searchResultsTotal = new client.Histogram({
  name: 'landomo_search_results_total',
  help: 'Number of results returned per search query',
  labelNames: ['country'] as const,
  buckets: [0, 1, 5, 10, 20, 50, 100, 250, 500],
});

export const searchErrorsTotal = new client.Counter({
  name: 'landomo_search_errors_total',
  help: 'Total number of search errors',
  labelNames: ['type', 'country'] as const,
});

// --- Cache metrics ---

export const cacheHitsTotal = new client.Counter({
  name: 'landomo_search_cache_hits_total',
  help: 'Total number of cache hits',
});

export const cacheMissesTotal = new client.Counter({
  name: 'landomo_search_cache_misses_total',
  help: 'Total number of cache misses',
});

// --- Database pool metrics ---

export const dbPoolActive = new client.Gauge({
  name: 'landomo_search_db_pool_active',
  help: 'Number of active database connections',
  labelNames: ['country'] as const,
});

export const dbPoolIdle = new client.Gauge({
  name: 'landomo_search_db_pool_idle',
  help: 'Number of idle database connections',
  labelNames: ['country'] as const,
});

// --- Geo search metrics ---

export const geoQueriesTotal = new client.Counter({
  name: 'landomo_search_geo_queries_total',
  help: 'Total number of geo-search queries',
});

/**
 * Collect current DB pool stats into gauges.
 * Called before each /metrics scrape.
 */
export function collectDbPoolMetrics(): void {
  try {
    const stats = getPoolStats();
    for (const [country, pool] of Object.entries(stats)) {
      const p = pool as { total: number; idle: number; waiting: number };
      dbPoolActive.set({ country }, p.total - p.idle);
      dbPoolIdle.set({ country }, p.idle);
    }
  } catch {
    // Pool stats unavailable during startup; ignore
  }
}

export { client as promClient };
