/**
 * Map Clustering Resolvers
 *
 * Implements the mapClusters query with caching and multi-country support
 */

import crypto from 'crypto';
import { getClusters } from '../../database/cluster-queries';
import type { BoundingBox, PropertyFilters } from '../../database/cluster-queries';
import { getCountryPool } from '../../database/multi-db-manager';
import { getAllCountries } from '../../countries';
import { cacheGet, cacheSet } from '../../cache/redis-manager';

interface MapClustersArgs {
  bounds: BoundingBox;
  zoom: number;
  countries: string[];
  filters?: PropertyFilters;
}

/**
 * Generate cache key for cluster queries
 */
function generateClusterCacheKey(args: MapClustersArgs): string {
  const { bounds, zoom, filters, countries } = args;

  const boundsHash = crypto
    .createHash('md5')
    .update(`${bounds.north},${bounds.south},${bounds.east},${bounds.west}`)
    .digest('hex')
    .substring(0, 8);

  const filtersHash = crypto
    .createHash('md5')
    .update(
      JSON.stringify({
        categories: filters?.propertyCategory?.sort(),
        transaction: filters?.transactionType,
        priceMin: filters?.priceMin,
        priceMax: filters?.priceMax,
        bedroomsMin: filters?.bedroomsMin,
        hasParking: filters?.hasParking,
        hasElevator: filters?.hasElevator,
        hasGarden: filters?.hasGarden,
      })
    )
    .digest('hex')
    .substring(0, 8);

  const strategy = zoom <= 14 ? 'gh' : zoom <= 16 ? 'grid' : 'ind';
  const countriesStr = countries.sort().join(',');

  return `clusters:v1:${strategy}:z${zoom}:c${countriesStr}:b${boundsHash}:f${filtersHash}`;
}

/**
 * Get adaptive TTL based on zoom level
 * Lower zoom (country view) = longer cache (data changes less frequently)
 * Higher zoom (street view) = shorter cache (more dynamic)
 */
function getAdaptiveTTL(zoom: number): number {
  if (zoom <= 10) return 1800;  // 30 minutes for country/region view
  if (zoom <= 14) return 600;   // 10 minutes for city view
  if (zoom <= 16) return 300;   // 5 minutes for neighborhood view
  return 120;                    // 2 minutes for street view
}

/**
 * Map Clusters Resolver
 */
export async function mapClustersResolver(
  _: any,
  args: MapClustersArgs
): Promise<any> {
  const startTime = Date.now();
  const { bounds, zoom, countries, filters } = args;

  // Validate zoom level
  if (zoom < 1 || zoom > 20) {
    throw new Error('Zoom level must be between 1 and 20');
  }

  // Validate countries
  const allCountries = getAllCountries();
  const countryMap = new Map(allCountries.map((c) => [c.code, c]));
  const validCountries = countries.filter((code) => countryMap.has(code));

  if (validCountries.length === 0) {
    throw new Error(`No valid countries provided. Available: ${Array.from(countryMap.keys()).join(', ')}`);
  }

  // Check cache
  const cacheKey = generateClusterCacheKey(args);
  const cached = await cacheGet<any>(cacheKey);

  if (cached) {
    return {
      ...cached,
      queryTimeMs: Date.now() - startTime,
    };
  }

  // Execute clustering query on each country database in parallel
  console.log('[CLUSTER] Valid countries:', validCountries);
  console.log('[CLUSTER] Zoom:', zoom, 'Bounds:', bounds);

  const results = await Promise.allSettled(
    validCountries.map(async (countryCode) => {
      const country = countryMap.get(countryCode);
      if (!country) throw new Error(`Country not found: ${countryCode}`);

      console.log('[CLUSTER] Getting pool for country:', countryCode);
      const pool = getCountryPool(countryCode);
      console.log('[CLUSTER] Pool exists:', !!pool);

      return getClusters(pool, bounds, zoom, filters);
    })
  );

  // Merge results from all countries
  const allClusters: any[] = [];
  const allProperties: any[] = [];
  let strategy = '';

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const data = result.value;
      strategy = data.strategy;

      if (data.clusters) {
        allClusters.push(...data.clusters);
      }
      if (data.properties) {
        allProperties.push(...data.properties);
      }
    } else {
      // Log rejected promises for debugging - throw to see the error
      throw new Error(`Cluster query failed for country ${validCountries[index]}: ${result.reason?.message || result.reason}`);
    }
  });

  // Build response
  const response = {
    clusters: allClusters.length > 0 ? allClusters : null,
    properties: allProperties.length > 0 ? allProperties : null,
    total: allClusters.length > 0 ? allClusters.length : allProperties.length,
    strategy,
    zoom,
    queryTimeMs: Date.now() - startTime,
  };

  // Cache response with adaptive TTL
  const ttl = getAdaptiveTTL(zoom);
  await cacheSet(cacheKey, response, ttl).catch((err) => {
    console.error('Failed to cache cluster response:', err);
    // Non-fatal, continue
  });

  return response;
}
