/**
 * Shared Prometheus Metrics for Scrapers
 *
 * Provides RED metrics (Rate, Errors, Duration) plus scraper-specific
 * business metrics. Import and call setupScraperMetrics() in your
 * Express app to add a /metrics endpoint.
 *
 * Usage:
 *   import { setupScraperMetrics, scraperMetrics } from '@landomo/core';
 *   setupScraperMetrics(app, 'sreality');
 *   // then in scraper logic:
 *   scraperMetrics.scrapeDuration.observe({ portal: 'sreality', category: 'apartment' }, 12.5);
 */

import client from 'prom-client';
import type { Express, Request, Response, NextFunction } from 'express';

// Collect default Node.js metrics (GC, event loop, heap)
client.collectDefaultMetrics({
  prefix: 'landomo_scraper_',
});

export const registry = client.register;

// --- RED Metrics ---

export const httpRequestsTotal = new client.Counter({
  name: 'landomo_scraper_http_requests_total',
  help: 'Total HTTP requests to scraper',
  labelNames: ['method', 'route', 'status'] as const,
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'landomo_scraper_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// --- Scraper Business Metrics ---

export const scrapeDurationSeconds = new client.Histogram({
  name: 'landomo_scraper_scrape_duration_seconds',
  help: 'Duration of a full scrape run in seconds',
  labelNames: ['portal', 'category'] as const,
  buckets: [10, 30, 60, 120, 300, 600, 1200, 1800, 3600],
});

export const propertiesScrapedTotal = new client.Counter({
  name: 'landomo_scraper_properties_scraped_total',
  help: 'Total properties scraped from portal',
  labelNames: ['portal', 'category', 'result'] as const,
});

export const scrapeRunsTotal = new client.Counter({
  name: 'landomo_scraper_scrape_runs_total',
  help: 'Total scrape runs',
  labelNames: ['portal', 'status'] as const,
});

export const scrapeRunActive = new client.Gauge({
  name: 'landomo_scraper_scrape_run_active',
  help: '1 if a scrape is currently running, 0 otherwise',
  labelNames: ['portal'] as const,
});

export const ingestBatchesSentTotal = new client.Counter({
  name: 'landomo_scraper_ingest_batches_sent_total',
  help: 'Total batches sent to ingest API',
  labelNames: ['portal', 'status'] as const,
});

export const ingestBatchDurationSeconds = new client.Histogram({
  name: 'landomo_scraper_ingest_batch_duration_seconds',
  help: 'Duration of sending a batch to ingest API in seconds',
  labelNames: ['portal'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const listingsFoundGauge = new client.Gauge({
  name: 'landomo_scraper_listings_found',
  help: 'Listings found in most recent scrape run',
  labelNames: ['portal', 'category'] as const,
});

export const lastRunTimestampGauge = new client.Gauge({
  name: 'landomo_scraper_last_run_timestamp',
  help: 'Unix timestamp of last completed scrape run',
  labelNames: ['portal'] as const,
});

export const scraperErrorCountTotal = new client.Counter({
  name: 'landomo_scraper_error_count',
  help: 'Scraper errors by type',
  labelNames: ['portal', 'error_type'] as const,
});

export const scraperMetrics = {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  scrapeDuration: scrapeDurationSeconds,
  propertiesScraped: propertiesScrapedTotal,
  scrapeRuns: scrapeRunsTotal,
  scrapeRunActive,
  ingestBatchesSent: ingestBatchesSentTotal,
  ingestBatchDuration: ingestBatchDurationSeconds,
  listingsFound: listingsFoundGauge,
  lastRunTimestamp: lastRunTimestampGauge,
  errorCount: scraperErrorCountTotal,
};

/**
 * Add Prometheus /metrics endpoint and request tracking middleware to an Express app.
 */
export function setupScraperMetrics(app: Express, portal: string): void {
  // Request tracking middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics') {
      next();
      return;
    }
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path || req.path;
      httpRequestsTotal.inc({
        method: req.method,
        route,
        status: String(res.statusCode),
      });
      httpRequestDurationSeconds.observe(
        { method: req.method, route },
        durationSec
      );
    });
    next();
  });

  // Metrics endpoint
  app.get('/metrics', async (_req: Request, res: Response) => {
    try {
      const metrics = await registry.metrics();
      res.set('Content-Type', registry.contentType);
      res.send(metrics);
    } catch (err) {
      res.status(500).send('Error collecting metrics');
    }
  });
}
