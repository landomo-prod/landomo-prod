/**
 * Bazos Scraper
 * Multi-country (CZ, SK, PL, AT) classifieds scraper
 *
 * Supports optional LLM-enhanced extraction via Azure OpenAI
 */

import express from 'express';
import { ScrapeRunTracker, createLogger, setupScraperMetrics, scraperMetrics } from '@landomo/core';
import { ListingsScraper, scrapeWithChecksums } from './scrapers/listingsScraper';
import { IngestAdapter } from './adapters/ingestAdapter';
import { transformBazosListingByCategory } from './transformers/bazosTransformer';
import { getLLMExtractor } from './services/bazosLLMExtractor';
import { getExtractionCache } from './services/extractionCache';
import { LLMExtractedProperty } from './types/llmExtraction';
import { validateProperty } from './utils/propertyValidator';
import { createCircuitBreaker } from './utils/circuitBreaker';
import { addExtractionJobs, waitForJobs, closeLLMQueue, getLLMQueue, LLMExtractionJobResult } from './queue/llmQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8102', 10);
const PORTAL = 'bazos';

const log = createLogger({ service: 'bazos-scraper', portal: PORTAL, country: 'czech_republic' });

// Feature flags
const LLM_EXTRACTION_ENABLED = process.env.LLM_EXTRACTION_ENABLED === 'true';
const ENABLE_CHECKSUM_MODE = process.env.ENABLE_CHECKSUM_MODE === 'true';

// JSON body parser
app.use(express.json());

// Prometheus metrics endpoint + request tracking
setupScraperMetrics(app as any, PORTAL);

// Drain stale LLM queue jobs from previous incomplete runs
(async () => {
  const llmQueue = getLLMQueue();
  const waitingCount = await llmQueue.getWaitingCount();
  if (waitingCount > 0) {
    log.warn({ staleJobs: waitingCount }, 'Draining stale LLM queue jobs from previous run');
    await llmQueue.drain();
  }
})();

// Health check endpoint
app.get('/health', async (req, res) => {
  const cacheStats = LLM_EXTRACTION_ENABLED ? getExtractionCache().getStats() : null;

  let latestMetrics = null;
  let aggregatedMetrics = null;

  if (LLM_EXTRACTION_ENABLED) {
    try {
      const { createMetricsCollector } = await import('./utils/metricsCollector');
      const metricsCollector = createMetricsCollector();

      const latest = await metricsCollector.getLatestMetrics('bazos', 1);
      if (latest.length > 0) {
        const metric = latest[0];
        const hits = metric.cache_hits || 0;
        const misses = metric.cache_misses || 0;
        const total = hits + misses;
        const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : '0.0';

        latestMetrics = {
          timestamp: metric.timestamp,
          total_listings: metric.total_listings,
          cache_hit_rate: `${hitRate}%`,
          llm_extractions: metric.llm_extractions,
          validation_failures: metric.validation_failures,
          total_cost: `$${metric.total_cost_usd?.toFixed(6) || '0.000000'}`,
          cost_saved: `$${metric.cost_saved_usd?.toFixed(6) || '0.000000'}`,
          avg_extraction_ms: metric.avg_extraction_ms,
        };
      }

      const aggregated = await metricsCollector.getAggregatedMetrics('bazos', 30);
      if (aggregated) {
        aggregatedMetrics = {
          period: 'Last 30 days',
          total_runs: aggregated.total_runs,
          total_listings: aggregated.total_listings,
          avg_cache_hit_rate: `${aggregated.avg_cache_hit_rate}%`,
          total_extractions: aggregated.total_extractions,
          total_cost_usd: `$${aggregated.total_cost_usd.toFixed(2)}`,
          total_saved_usd: `$${aggregated.total_saved_usd.toFixed(2)}`,
          net_savings: `$${(aggregated.total_saved_usd - aggregated.total_cost_usd).toFixed(2)}`,
        };
      }

      await metricsCollector.disconnect();
    } catch (error: any) {
      log.error({ err: error }, 'Failed to fetch metrics for health check');
    }
  }

  res.json({
    status: 'healthy',
    scraper: PORTAL,
    focus: 'real-estate',
    version: '3.1.0-checksum',
    timestamp: new Date().toISOString(),
    supported_countries: ['cz', 'sk', 'pl', 'at'],
    supported_sections: ['RE'],
    features: {
      checksum_mode: ENABLE_CHECKSUM_MODE,
      llm_extraction: LLM_EXTRACTION_ENABLED,
      llm_provider: LLM_EXTRACTION_ENABLED ? 'Azure AI Foundry (DeepSeek-V3.2)' : 'disabled',
      llm_model: LLM_EXTRACTION_ENABLED ? 'DeepSeek-V3.2' : null,
      cost_per_listing: LLM_EXTRACTION_ENABLED ? '$0.000634' : null,
      checksum_savings: ENABLE_CHECKSUM_MODE ? '95-99% fewer LLM extractions on subsequent scrapes' : null,
      persistent_cache: process.env.PERSISTENT_CACHE_ENABLED === 'true' ? 'Redis (7d) + PostgreSQL (90d)' : 'disabled',
      validation: process.env.VALIDATION_ENABLED === 'true',
      circuit_breaker: process.env.CIRCUIT_BREAKER_ENABLED === 'true',
    },
    cache_stats: cacheStats,
    latest_run: latestMetrics,
    metrics_30d: aggregatedMetrics,
  });
});

app.post('/scrape', async (req, res) => {
  res.status(202).json({ status: 'scraping started', timestamp: new Date().toISOString() });
  runFullScraper().catch(error => { log.error({ err: error }, 'Scraping failed'); });
});

app.post('/scrape/:country', async (req, res) => {
  const { country } = req.params;
  const { sections, maxPages } = req.body || {};

  if (!['cz', 'sk', 'pl', 'at'].includes(country)) {
    return res.status(400).json({ error: 'Invalid country', supported: ['cz', 'sk', 'pl', 'at'] });
  }

  res.status(202).json({ status: 'scraping started', country, timestamp: new Date().toISOString() });
  runCountryScraper(country, sections, maxPages).catch(error => {
    log.error({ err: error, country }, 'Scraping failed for country');
  });
});

async function runFullScraper() {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(PORTAL);
  const runId = await tracker.start();
  scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 1);

  log.info({ mode: ENABLE_CHECKSUM_MODE ? 'checksum' : 'legacy' }, 'Starting Bazos Real Estate scrape');

  try {
    const adapter = new IngestAdapter(PORTAL);
    const ingestApiUrl = process.env.INGEST_API_URL || 'http://cz-ingest:3000';
    const ingestApiKey = process.env.INGEST_API_KEY || '';

    let listings;
    let allListings;
    let stats = { total: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0 };

    if (ENABLE_CHECKSUM_MODE) {
      log.info('Fetching listings with checksum-based change detection');
      const result = await scrapeWithChecksums(ingestApiUrl, ingestApiKey, runId ?? undefined);
      listings = result.listings;
      allListings = result.allListings;
      stats = result.stats;
      log.info({ needExtraction: listings.length, unchanged: stats.unchanged }, 'Checksum mode results');
    } else {
      log.info('Fetching listings (legacy mode)');
      const countries = (process.env.SCRAPE_COUNTRIES || 'cz').split(',').map(c => c.trim());
      const scraper = new ListingsScraper({ countries, sections: ['RE'], maxPages: 10000, delayMs: 1000 });
      allListings = await scraper.scrapeAll();
      listings = allListings;
      stats.total = listings.length;
      stats.new = listings.length;
      log.info({ count: listings.length }, 'Listings found');
    }

    if (allListings.length === 0) {
      log.warn('No listings found');
      await tracker.complete({ listings_found: 0, listings_new: 0, listings_updated: 0 });
      return;
    }

    log.info({ count: allListings.length }, 'Fetching detail pages via API');
    const { fetchDetailDataBatch } = await import('./scrapers/detailScraper');
    const adIds = allListings.map(l => l.id);
    const detailMap = await fetchDetailDataBatch(adIds, 300);

    for (const listing of allListings) {
      const detail = detailMap.get(listing.id);
      if (detail) {
        (listing as any).description = detail.description || '';
        (listing as any).detail_images = detail.images || [];
        (listing as any).detail_latitude = detail.latitude;
        (listing as any).detail_longitude = detail.longitude;
        (listing as any).detail_zip_code = detail.zip_code;
        (listing as any).detail_category_id = detail.category_id;
        (listing as any).detail_category_title = detail.category_title;
        if (detail.type) (listing as any).detail_type = detail.type;
      }
    }
    log.info({ fetched: detailMap.size, total: adIds.length }, 'Detail pages fetched via API');

    let llmExtractionMap: Map<string, LLMExtractedProperty> | undefined;
    if (LLM_EXTRACTION_ENABLED) {
      if (listings.length > 0) {
        log.info({ count: listings.length }, 'Starting LLM extraction');
        llmExtractionMap = await extractWithLLM(listings);
        log.info({ extracted: llmExtractionMap.size }, 'LLM extraction completed');
        if (ENABLE_CHECKSUM_MODE) {
          log.info({ llmCost: (listings.length * 0.000634).toFixed(4), savedCost: (stats.unchanged * 0.000634).toFixed(4) }, 'LLM cost summary');
        }
      } else {
        log.info('No new/changed listings - skipping LLM extraction');
        llmExtractionMap = new Map();
      }
    } else {
      log.info('LLM extraction disabled');
    }

    log.info({ count: allListings.length }, 'Transforming listings');
    const validatedProperties = [];
    let validationFailures = 0;

    for (const listing of allListings) {
      try {
        const llmData = llmExtractionMap?.get(listing.id);
        const transformed = await transformBazosListingByCategory(listing, listing._country);
        const validation = validateProperty(transformed);

        if (!validation.isValid) {
          log.warn({ listingId: listing.id, errors: validation.errors }, 'Validation failed');
          validationFailures++;
          continue;
        }
        if (validation.warnings.length > 0) {
          log.debug({ listingId: listing.id, warnings: validation.warnings }, 'Validation warnings');
        }

        validatedProperties.push({ portalId: listing.id, data: transformed, rawData: listing });
      } catch (error: any) {
        log.error({ listingId: listing.id, err: error }, 'Error transforming listing');
        validationFailures++;
      }
    }

    const properties = validatedProperties;
    log.info({ validated: properties.length, total: listings.length, failures: validationFailures }, 'Validation complete');

    const batchSize = 100;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      log.info({ batch: Math.floor(i / batchSize) + 1, size: batch.length }, 'Sending batch');
      try { await adapter.sendProperties(batch); }
      catch (error: any) { log.error({ err: error }, 'Failed to send batch'); }
      if (i + batchSize < properties.length) { await new Promise(resolve => setTimeout(resolve, 500)); }
    }

    await tracker.complete({ listings_found: stats.total, listings_new: stats.new, listings_updated: stats.changed });

    const durationSec = (Date.now() - startTime) / 1000;
    scraperMetrics.scrapeDuration.observe({ portal: PORTAL, category: 'all' }, durationSec);
    scraperMetrics.propertiesScraped.inc({ portal: PORTAL, category: 'all', result: 'success' }, properties.length);
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'success' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.info({
      durationSec: durationSec.toFixed(2),
      total: stats.total, transformed: properties.length, sent: properties.length,
      ...(ENABLE_CHECKSUM_MODE ? { savingsPercent: stats.savingsPercent, unchanged: stats.unchanged } : {}),
    }, 'Scrape completed');

  } catch (error: any) {
    await tracker.fail();
    scraperMetrics.scrapeRuns.inc({ portal: PORTAL, status: 'failure' });
    scraperMetrics.scrapeRunActive.set({ portal: PORTAL }, 0);
    log.error({ err: error }, 'Scrape failed');
    throw error;
  }
}

async function runCountryScraper(country: string, sections?: string[], maxPages?: number) {
  const startTime = Date.now();
  const tracker = new ScrapeRunTracker(`${PORTAL}-${country}`);
  const runId = await tracker.start();

  log.info({ country, mode: ENABLE_CHECKSUM_MODE ? 'checksum' : 'legacy' }, 'Starting Bazos country scrape');

  try {
    const adapter = new IngestAdapter(PORTAL);
    const ingestApiUrl = process.env.INGEST_API_URL || 'http://cz-ingest:3000';
    const ingestApiKey = process.env.INGEST_API_KEY || '';

    let listings, allListings;
    let stats = { total: 0, new: 0, changed: 0, unchanged: 0, savingsPercent: 0 };

    if (ENABLE_CHECKSUM_MODE) {
      const result = await scrapeWithChecksums(ingestApiUrl, ingestApiKey, runId ?? undefined);
      listings = result.listings; allListings = result.allListings; stats = result.stats;
      log.info({ needExtraction: listings.length, unchanged: stats.unchanged }, 'Checksum results');
    } else {
      const scraper = new ListingsScraper({ countries: [country], sections: sections || ['RE'], maxPages: maxPages || 10000, delayMs: 1000 });
      allListings = await scraper.scrapeAll(); listings = allListings;
      stats.total = listings.length; stats.new = listings.length;
      log.info({ count: listings.length }, 'Listings found');
    }

    if (allListings.length === 0) {
      log.warn('No listings found');
      await tracker.complete({ listings_found: 0, listings_new: 0, listings_updated: 0 });
      return;
    }

    log.info({ count: allListings.length }, 'Fetching detail pages via API');
    const { fetchDetailDataBatch } = await import('./scrapers/detailScraper');
    const adIds = allListings.map(l => l.id);
    const detailMap = await fetchDetailDataBatch(adIds, 300);
    for (const listing of allListings) {
      const detail = detailMap.get(listing.id);
      if (detail) {
        (listing as any).description = detail.description || '';
        (listing as any).detail_images = detail.images || [];
        (listing as any).detail_latitude = detail.latitude;
        (listing as any).detail_longitude = detail.longitude;
        (listing as any).detail_zip_code = detail.zip_code;
        if (detail.type) (listing as any).detail_type = detail.type;
      }
    }
    log.info({ fetched: detailMap.size, total: adIds.length }, 'Detail pages fetched via API');

    let llmExtractionMap: Map<string, LLMExtractedProperty> | undefined;
    if (LLM_EXTRACTION_ENABLED && listings.length > 0) {
      log.info({ count: listings.length }, 'Starting LLM extraction');
      llmExtractionMap = await extractWithLLM(listings);
      log.info({ extracted: llmExtractionMap.size }, 'LLM extraction completed');
    } else {
      if (LLM_EXTRACTION_ENABLED) log.info('No new/changed listings - skipping LLM extraction');
      llmExtractionMap = new Map();
    }

    log.info({ count: allListings.length }, 'Transforming listings');
    const properties = await Promise.all(allListings.map(async listing => {
      try {
        const llmData = llmExtractionMap?.get(listing.id);
        return { portalId: listing.id, data: await transformBazosListingByCategory(listing, listing._country), rawData: listing };
      } catch (error: any) {
        log.error({ listingId: listing.id, err: error }, 'Error transforming listing');
        return null;
      }
    })).then(results => results.filter(p => p !== null) as any[]);

    log.info({ count: properties.length }, 'Transformed listings');

    const batchSize = 100;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      try { await adapter.sendProperties(batch); }
      catch (error: any) { log.error({ err: error }, 'Failed to send batch'); }
      if (i + batchSize < properties.length) { await new Promise(resolve => setTimeout(resolve, 500)); }
    }

    await tracker.complete({ listings_found: stats.total, listings_new: stats.new, listings_updated: stats.changed });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info({ country, durationSec: duration, total: stats.total, transformed: properties.length, ...(ENABLE_CHECKSUM_MODE ? { savingsPercent: stats.savingsPercent } : {}) }, 'Country scrape completed');

  } catch (error: any) {
    await tracker.fail();
    log.error({ err: error, country }, 'Scrape failed');
    throw error;
  }
}

const LLM_QUEUE_TIMEOUT_MS = parseInt(process.env.LLM_QUEUE_TIMEOUT_MS || '300000', 10);

async function extractWithLLM(listings: Array<{ id: string; title?: string; url?: string; }>): Promise<Map<string, LLMExtractedProperty>> {
  const extractionMap = new Map<string, LLMExtractedProperty>();
  const llmLog = log.child({ module: 'llm' });

  if (!LLM_EXTRACTION_ENABLED) return extractionMap;

  try {
    const cache = getExtractionCache();
    const startTime = Date.now();

    llmLog.info({ count: listings.length }, 'Processing listings with persistent cache');

    // Phase 1: Check cache (checksum optimization preserved)
    const listingsToExtract: Array<{ id: string; title?: string; description?: string }> = [];
    let cacheHits = 0;

    for (const listing of listings) {
      const title = listing.title || '';
      const description = (listing as any).description || '';
      const listingText = description ? `${title}\n\n${description}` : title;
      if (!listingText.trim()) { llmLog.warn({ listingId: listing.id }, 'Skipping - no text'); continue; }

      const cached = await cache.get('bazos', listing.id, listingText);
      if (cached) { extractionMap.set(listing.id, cached); cacheHits++; }
      else { listingsToExtract.push({ id: listing.id, title, description }); }
    }

    llmLog.info({ cacheHits, needExtraction: listingsToExtract.length }, 'Cache check complete');

    // Phase 2: Dispatch to queue and wait for results
    if (listingsToExtract.length > 0) {
      llmLog.info({ count: listingsToExtract.length }, 'Dispatching to LLM extraction queue');

      const jobIdMap = await addExtractionJobs(listingsToExtract, 'bazos', 'cz');
      llmLog.info({ jobsQueued: jobIdMap.size }, 'Jobs dispatched, waiting for results');

      const results = await waitForJobs(jobIdMap, LLM_QUEUE_TIMEOUT_MS);

      let extractedCount = 0;
      let failedCount = 0;
      for (const [listingId, result] of results) {
        if (result.isValid) {
          extractionMap.set(listingId, result.data);
          extractedCount++;
        } else {
          failedCount++;
        }
      }

      const timedOut = jobIdMap.size - results.size;
      llmLog.info({
        extracted: extractedCount, failed: failedCount,
        timedOut, total: listingsToExtract.length,
      }, 'Queue extraction complete');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const cacheStats = cache.getStats();
    llmLog.info({
      durationSec: duration, totalResults: extractionMap.size, cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses, cacheHitRate: cacheStats.hitRate,
      costSaved: (cacheHits * 0.000634).toFixed(4),
    }, 'LLM extraction completed');

  } catch (error: any) {
    llmLog.error({ err: error }, 'Queue-based extraction failed');
  }

  return extractionMap;
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'Bazos scraper running');
});

async function shutdown() {
  log.info('Shutting down');
  await closeLLMQueue();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
