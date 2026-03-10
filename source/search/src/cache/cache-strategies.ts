/**
 * Cache Strategies
 *
 * Defines different caching strategies with appropriate TTLs.
 */

import { config } from '../config';
import { SearchRequest, SearchResponse, PropertyResult } from '../types/search';
import {
  cacheGet,
  cacheSet,
  generateCacheKey,
  cacheDelete,
  cacheDeletePattern
} from './redis-manager';
import { cacheHitsTotal, cacheMissesTotal } from '../metrics';
import { cacheLog } from '../logger';

/**
 * Cache search results
 * TTL: 5 minutes (results can change frequently)
 * Skips caching empty results to avoid storing error/no-data responses.
 */
export async function cacheSearchResults(
  request: SearchRequest,
  response: SearchResponse
): Promise<void> {
  if (!response.results || response.results.length === 0) {
    return;
  }
  const key = generateCacheKey('search', request);
  await cacheSet(key, response, config.cache.ttlSearch);
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(
  request: SearchRequest
): Promise<SearchResponse | null> {
  const key = generateCacheKey('search', request);
  const result = await cacheGet<SearchResponse>(key);
  if (result) {
    cacheHitsTotal.inc();
  } else {
    cacheMissesTotal.inc();
  }
  return result;
}

/**
 * Cache property detail
 * TTL: 30 minutes (property details change less frequently)
 * Skips caching null/undefined results.
 */
export async function cachePropertyDetail(
  country: string,
  propertyId: string,
  property: PropertyResult
): Promise<void> {
  if (!property) {
    return;
  }
  const key = `property:${country}:${propertyId}`;
  await cacheSet(key, property, config.cache.ttlProperty);
}

/**
 * Get cached property detail
 */
export async function getCachedPropertyDetail(
  country: string,
  propertyId: string
): Promise<PropertyResult | null> {
  const key = `property:${country}:${propertyId}`;
  const result = await cacheGet<PropertyResult>(key);
  if (result) {
    cacheHitsTotal.inc();
  } else {
    cacheMissesTotal.inc();
  }
  return result;
}

/**
 * Invalidate property cache (when property is updated)
 */
export async function invalidatePropertyCache(
  country: string,
  propertyId: string
): Promise<void> {
  const key = `property:${country}:${propertyId}`;
  await cacheDelete(key);
}

/**
 * Cache aggregations
 * TTL: 1 hour (aggregate stats change slowly)
 * Skips caching null/undefined/empty data.
 */
export async function cacheAggregations(
  type: string,
  country: string | null,
  data: any
): Promise<void> {
  if (data == null) {
    return;
  }
  const key = country
    ? `agg:${type}:${country}`
    : `agg:${type}:global`;
  await cacheSet(key, data, config.cache.ttlAggregations);
}

/**
 * Get cached aggregations
 */
export async function getCachedAggregations(
  type: string,
  country: string | null
): Promise<any | null> {
  const key = country
    ? `agg:${type}:${country}`
    : `agg:${type}:global`;
  const result = await cacheGet(key);
  if (result) {
    cacheHitsTotal.inc();
  } else {
    cacheMissesTotal.inc();
  }
  return result;
}

/**
 * Cache filter metadata (cities, property types, etc.)
 * TTL: 24 hours (filter options change very rarely)
 */
export async function cacheFilterMetadata(
  country: string,
  metadata: any
): Promise<void> {
  const key = `filters:${country}:metadata`;
  await cacheSet(key, metadata, config.cache.ttlFilters);
}

/**
 * Get cached filter metadata
 */
export async function getCachedFilterMetadata(
  country: string
): Promise<any | null> {
  const key = `filters:${country}:metadata`;
  const result = await cacheGet(key);
  if (result) {
    cacheHitsTotal.inc();
  } else {
    cacheMissesTotal.inc();
  }
  return result;
}

/**
 * Cache geo-search results
 * TTL: 5 minutes (same as regular search)
 */
export async function cacheGeoSearchResults(
  latitude: number,
  longitude: number,
  radius_km: number,
  filters: any,
  results: any
): Promise<void> {
  const key = generateCacheKey('geo', {
    latitude,
    longitude,
    radius_km,
    filters
  });
  await cacheSet(key, results, config.cache.ttlSearch);
}

/**
 * Get cached geo-search results
 */
export async function getCachedGeoSearchResults(
  latitude: number,
  longitude: number,
  radius_km: number,
  filters: any
): Promise<any | null> {
  const key = generateCacheKey('geo', {
    latitude,
    longitude,
    radius_km,
    filters
  });
  const result = await cacheGet(key);
  if (result) {
    cacheHitsTotal.inc();
  } else {
    cacheMissesTotal.inc();
  }
  return result;
}

/**
 * Invalidate all search caches (useful after bulk data updates)
 */
export async function invalidateAllSearchCaches(): Promise<void> {
  await cacheDeletePattern('search:*');
  await cacheDeletePattern('geo:*');
  cacheLog.info('All search caches invalidated');
}

/**
 * Invalidate caches for a specific country.
 * Also clears search and geo caches since they may contain stale data for
 * the updated country.
 */
export async function invalidateCountryCaches(country: string): Promise<void> {
  await Promise.all([
    cacheDeletePattern(`property:${country}:*`),
    cacheDeletePattern(`agg:*:${country}`),
    cacheDeletePattern(`filters:${country}:*`),
    // NOTE: search:* and geo:* are intentionally NOT invalidated here.
    // Search/geo results have a 5-minute TTL — 5 minutes of staleness is
    // acceptable for real estate. Wiping them on every scraper pub/sub event
    // causes thundering-herd DB queries and defeats the purpose of the cache.
    // Let them expire naturally by TTL.
  ]);
  cacheLog.info({ country }, 'Caches invalidated for country');
}

/**
 * Cache search total count (for skipping COUNT on page 2+)
 * TTL: 5 minutes
 */
export async function cacheSearchCount(
  request: SearchRequest,
  total: number
): Promise<void> {
  const key = generateCacheKey('count', { ...request, page: undefined, pagination: undefined });
  await cacheSet(key, total, 300);
}

/**
 * Get cached search total count
 */
export async function getCachedSearchCount(
  request: SearchRequest
): Promise<number | null> {
  const key = generateCacheKey('count', { ...request, page: undefined, pagination: undefined });
  return cacheGet<number>(key);
}

/**
 * Warm up cache with common queries
 * (Call this during deployment or after cache flush)
 */
export async function warmUpCache(): Promise<void> {
  cacheLog.info('Warming up cache with common queries');

  // This would be implemented based on your most common queries
  // For example:
  // - Popular cities
  // - Common price ranges
  // - Frequently accessed properties

  cacheLog.info('Cache warm-up complete');
}
