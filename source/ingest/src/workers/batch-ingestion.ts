/**
 * Batch Ingestion Worker
 * Processes internal queue and performs bulk DB inserts
 */

import { Worker, Job } from 'bullmq';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { getCoreDatabase } from '../database/manager';
import { bulkInsertOrUpdateProperties, upsertApartments, upsertHouses, upsertLand, upsertCommercial, upsertOther, UpsertResult } from '../database/bulk-operations';
import { IngestionPayload, ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI, OtherPropertyTierI, geocodeAddress, buildAddressString, PropertyChangeEvent, PropertyBatchEvent } from '@landomo/core';
import {
  propertiesIngestedTotal,
  propertiesUpdatedTotal,
  batchSize,
  batchDurationSeconds,
  errorsTotal,
  propertiesNewTotal,
  propertiesPriceChangedTotal,
  scraperListingsFound,
  scraperLastRunTimestamp,
} from '../metrics';
import { workerLog } from '../logger';
import { lookupGeoEnrichment } from '../services/district-lookup';
import { classifyPropertyType } from '../utils/property-type-classifier';

let publisherClient: RedisClientType | null = null;

async function getPublisherClient(): Promise<RedisClientType> {
  if (!publisherClient) {
    publisherClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });
    publisherClient.on('error', (err) => {
      workerLog.error({ err }, 'Redis publisher error');
    });
    await publisherClient.connect();
  }
  return publisherClient;
}

/**
 * Publish a cache invalidation event for a country.
 * Best-effort: failures are logged but never block ingestion.
 */
async function publishCacheInvalidation(country: string): Promise<void> {
  try {
    const client = await getPublisherClient();
    const channel = `property:updated:${country}`;
    await client.publish(channel, JSON.stringify({ country, timestamp: Date.now() }));
    workerLog.debug({ country, channel }, 'Published cache invalidation');
  } catch (err) {
    workerLog.warn({ err, country }, 'Failed to publish cache invalidation (non-fatal)');
  }
}

/**
 * Publish property change events for the notification system.
 * Best-effort: failures are logged but never block ingestion.
 */
async function publishPropertyChanges(
  country: string,
  portal: string,
  changes: PropertyChangeEvent[]
): Promise<void> {
  if (changes.length === 0) return;

  try {
    const client = await getPublisherClient();
    const channel = `property:changes:${country}`;
    const event: PropertyBatchEvent = {
      country,
      portal,
      timestamp: Date.now(),
      batch_size: changes.length,
      changes,
    };
    await client.xAdd(channel, '*', { payload: JSON.stringify(event) }, { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 10000 } });
    workerLog.debug({ country, portal, channel, changeCount: changes.length }, 'Published property changes to stream');
  } catch (err) {
    workerLog.warn({ err, country, portal }, 'Failed to publish property changes (non-fatal)');
  }
}

/**
 * Process a batch job containing multiple properties
 */
async function processBatchJob(payload: any, country: string, jobLog: any) {
  const { portal, properties, batch_size, scrape_run_id } = payload;

  if (!Array.isArray(properties) || properties.length === 0) {
    jobLog.warn({ portal, batchSize: batch_size, scrapeRunId: scrape_run_id }, 'Batch job has no properties');
    return { success: true, inserted: 0, updated: 0 };
  }

  jobLog.info({ portal, count: properties.length, scrapeRunId: scrape_run_id }, 'Processing batch job');

  // Group properties by category for efficient batch processing
  const byCategory: Record<string, any[]> = {
    apartment: [],
    house: [],
    land: [],
    commercial: [],
    other: [],
  };

  // Transform and group properties
  for (const prop of properties) {
    const category = prop.data?.property_category;
    if (!category || !byCategory[category]) {
      jobLog.warn({ portal, portalId: prop.portal_id, category }, 'Unknown category, skipping');
      continue;
    }

    // Merge portal-level fields into property data
    const propertyData = {
      ...prop.data,
      source_platform: portal,
      portal_id: prop.portal_id,
      source_url: prop.data?.source_url || '',
    };

    byCategory[category].push(propertyData);
  }

  // Deduplicate within each category to prevent
  // "ON CONFLICT DO UPDATE command cannot affect row a second time"
  for (const cat of Object.keys(byCategory)) {
    const seen = new Map<string, any>();
    for (const prop of byCategory[cat]) {
      const key = `${prop.source_platform}:${prop.portal_id}`;
      seen.set(key, prop);
    }
    byCategory[cat] = Array.from(seen.values()).sort((a, b) => a.portal_id < b.portal_id ? -1 : a.portal_id > b.portal_id ? 1 : 0);
  }

  // Classify property_type for land and commercial where missing
  for (const cat of ['land', 'commercial'] as const) {
    for (const prop of byCategory[cat]) {
      if (!prop.property_type && prop.title) {
        prop.property_type = classifyPropertyType(prop.title, cat);
      }
    }
  }

  // Enrich properties with geo data from Pelias / polygon service
  if (process.env.PELIAS_URL || process.env.POLYGON_SERVICE_API_KEY) {
    for (const cat of Object.keys(byCategory)) {
      for (const prop of byCategory[cat]) {
        const lat = prop.location?.coordinates?.lat || prop.latitude || prop.location?.latitude;
        const lon = prop.location?.coordinates?.lon || prop.longitude || prop.location?.longitude;
        if (lat && lon && (!prop.district || !prop.municipality)) {
          const geo = await lookupGeoEnrichment(lat, lon);
          if (geo.district) prop.district = geo.district;
          if (geo.neighbourhood) prop.neighbourhood = geo.neighbourhood;
          if (geo.municipality) prop.municipality = geo.municipality;
          if (geo.region && !prop.region) prop.region = geo.region;
        }
      }
    }
  }

  // Process each category in parallel
  const results = await Promise.all([
    byCategory.apartment.length > 0 ? upsertApartments(byCategory.apartment, country, scrape_run_id) : null,
    byCategory.house.length > 0 ? upsertHouses(byCategory.house, country, scrape_run_id) : null,
    byCategory.land.length > 0 ? upsertLand(byCategory.land, country, scrape_run_id) : null,
    byCategory.commercial.length > 0 ? upsertCommercial(byCategory.commercial, country, scrape_run_id) : null,
    byCategory.other.length > 0 ? upsertOther(byCategory.other, country, scrape_run_id) : null,
  ]);

  // Aggregate results
  let totalInserted = 0;
  let totalUpdated = 0;
  const allChanges: PropertyChangeEvent[] = [];

  for (const result of results) {
    if (result) {
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      if (result.changes && result.changes.length > 0) {
        allChanges.push(...result.changes);
      }
    }
  }

  const processed = totalInserted + totalUpdated;

  jobLog.info({
    portal,
    count: properties.length,
    inserted: totalInserted,
    updated: totalUpdated,
    processed,
    changes: allChanges.length,
    scrapeRunId: scrape_run_id,
    apartment: byCategory.apartment.length,
    house: byCategory.house.length,
    land: byCategory.land.length,
    commercial: byCategory.commercial.length,
    other: byCategory.other.length,
  }, 'Batch job complete');

  // Record metrics
  batchSize.observe(properties.length);
  if (totalInserted > 0) {
    propertiesIngestedTotal.inc({ country, portal }, totalInserted);
    propertiesNewTotal.inc({ country, category: 'batch', portal }, totalInserted);
  }
  if (totalUpdated > 0) {
    propertiesUpdatedTotal.inc({ country, portal }, totalUpdated);
  }

  // Publish cache invalidation (best-effort)
  await publishCacheInvalidation(country);

  // Publish property changes for notification system (best-effort, fire and forget)
  publishPropertyChanges(country, portal, allChanges).catch(() => {});

  return {
    success: true,
    inserted: totalInserted,
    updated: totalUpdated,
    processed,
    country,
    portal,
    batch_size: properties.length,
  };
}

/**
 * Start batch ingestion worker
 */
export function startBatchIngestionWorker() {
  const queueName = `ingest-property-${config.instance.country}`;
  const worker = new Worker<any>(
    queueName,
    async (job: Job<any>) => {
      const payload = job.data;
      const requestId = (payload as any).request_id;
      const jobLog = requestId ? workerLog.child({ requestId }) : workerLog;

      try {
        // Get country-specific Core DB (fallback to instance country)
        const rawCountry = payload.country || config.instance.country;
        const COUNTRY_CODE_MAP: Record<string, string> = { 'cz': 'czech', 'sk': 'slovakia', 'at': 'austria', 'de': 'germany', 'hu': 'hungary', 'pl': 'poland', 'ro': 'romania', 'uk': 'united_kingdom', 'au': 'australia' };
        const country = COUNTRY_CODE_MAP[rawCountry.toLowerCase()] || rawCountry;
        const db = getCoreDatabase(country);

        // Handle BATCH jobs (new efficient architecture)
        if (job.name === 'ingest-property-batch') {
          return await processBatchJob(payload, country, jobLog);
        }

        // Handle SINGLE property jobs (old architecture, backward compat)
        jobLog.debug({ portal: payload.portal, portalId: payload.portal_id, category: (payload.data as any)?.property_category, scrapeRunId: payload.scrape_run_id }, 'Processing single property job');

        // Route to category-specific upsert functions based on property_category
        let result;
        const category = (payload.data as any)?.property_category;

        // Classify property_type for land/commercial if missing
        if ((category === 'land' || category === 'commercial') && !payload.data?.property_type && payload.data?.title) {
          payload.data.property_type = classifyPropertyType(payload.data.title, category);
        }

        if (category === 'apartment') {
          // Merge portal-level fields into property data
          const apartmentData = {
            ...payload.data,
            source_platform: payload.portal,
            portal_id: payload.portal_id,
            source_url: (payload.data as any).source_url || ''
          } as unknown as ApartmentPropertyTierI;
          result = await upsertApartments([apartmentData], country);
        } else if (category === 'house') {
          const houseData = {
            ...payload.data,
            source_platform: payload.portal,
            portal_id: payload.portal_id,
            source_url: (payload.data as any).source_url || ''
          } as unknown as HousePropertyTierI;
          result = await upsertHouses([houseData], country);
        } else if (category === 'land') {
          const landData = {
            ...payload.data,
            source_platform: payload.portal,
            portal_id: payload.portal_id,
            source_url: (payload.data as any).source_url || ''
          } as unknown as LandPropertyTierI;
          result = await upsertLand([landData], country);
        } else if (category === 'commercial') {
          const commercialData = {
            ...payload.data,
            source_platform: payload.portal,
            portal_id: payload.portal_id,
            source_url: (payload.data as any).source_url || ''
          } as unknown as CommercialPropertyTierI;
          result = await upsertCommercial([commercialData], country);
        } else if (category === 'other') {
          const otherData = {
            ...payload.data,
            source_platform: payload.portal,
            portal_id: payload.portal_id,
            source_url: (payload.data as any).source_url || ''
          } as unknown as OtherPropertyTierI;
          result = await upsertOther([otherData], country);
        } else {
          // Fallback to old function for properties without category (backward compatibility)
          jobLog.warn({ portal: payload.portal, portalId: payload.portal_id, category, scrapeRunId: payload.scrape_run_id }, 'Property missing category, using legacy table');
          result = await bulkInsertOrUpdateProperties(db, [payload], requestId);
        }

        // Record metrics
        batchSize.observe(1);
        // UpsertResult doesn't have duration field, use fixed value for metrics
        const durationMs = (result as any).duration || 10;
        batchDurationSeconds.observe(durationMs / 1000);
        if (result.inserted > 0) {
          propertiesIngestedTotal.inc(
            { country: payload.country, portal: payload.portal },
            result.inserted
          );
          // Business KPI: new properties
          propertiesNewTotal.inc(
            { country: payload.country, category: category || 'unknown', portal: payload.portal },
            result.inserted
          );
        }
        if (result.updated > 0) {
          propertiesUpdatedTotal.inc(result.updated);
        }

        // Business KPI: track price changes from upsert result
        if ((result as any).priceChanged) {
          const changeType = (result as any).priceIncreased ? 'increase' : 'decrease';
          propertiesPriceChangedTotal.inc(
            { country: payload.country, category: category || 'unknown', change_type: changeType }
          );
        }

        // Business KPI: update scraper last run timestamp
        scraperLastRunTimestamp.set({ portal: payload.portal }, Date.now() / 1000);

        // Notify search-service to invalidate caches for this country (best-effort)
        if (result.inserted > 0 || result.updated > 0) {
          await publishCacheInvalidation(payload.country);
        }

        return {
          success: true,
          country: payload.country,
          portal: payload.portal,
          ...result,
        };
      } catch (error) {
        errorsTotal.inc({ type: 'batch_ingestion' });
        workerLog.error({ err: error, portal: payload.portal, portalId: payload.portal_id, country: payload.country, scrapeRunId: payload.scrape_run_id }, 'Failed to ingest property');
        throw error; // Will trigger retry
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: config.batch.workers,
      limiter: {
        max: 500, // Increased from 10 to handle Czech scraper throughput (~200 props/sec)
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    workerLog.debug({ jobId: job.id, scrapeRunId: job.data?.scrape_run_id, portal: job.data?.portal, result: job.returnvalue }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    errorsTotal.inc({ type: 'job_failed' });
    workerLog.error({ jobId: job?.id, scrapeRunId: job?.data?.scrape_run_id, portal: job?.data?.portal, err }, 'Job failed');
  });

  return worker;
}
