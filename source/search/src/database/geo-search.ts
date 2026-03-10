/**
 * Geo-Search
 *
 * PostGIS-based geographic search functionality.
 */

import { Pool } from 'pg';
import { getCountryPool } from './multi-db-manager';
import { GeoSearchRequest, GeoSearchResult, GeoSearchResponse, PaginationMetadata, SortByPreset, SearchSort } from '../types/search';
import { getCountryModule } from '../countries';
import { config } from '../config';

const SORT_BY_PRESETS: Record<SortByPreset, SearchSort> = {
  price_asc: { field: 'price', order: 'asc' },
  price_desc: { field: 'price', order: 'desc' },
  date_newest: { field: 'created_at', order: 'desc' },
  date_oldest: { field: 'created_at', order: 'asc' },
};
import {
  getCachedGeoSearchResults,
  cacheGeoSearchResults
} from '../cache/cache-strategies';
import { geoQueriesTotal } from '../metrics';
import { geoLog } from '../logger';
import * as crypto from 'crypto';

// Single-flight: deduplicates concurrent identical geo-search cache misses
const inFlightGeo = new Map<string, Promise<GeoSearchResponse>>();

/**
 * Perform geo-radius search on a single database
 */
export async function geoRadiusSearchSingle(
  pool: Pool,
  latitude: number,
  longitude: number,
  radius_km: number,
  additionalFilters?: Record<string, any>,
  limit: number = 100
): Promise<any[]> {
  // KNN returns the LIMIT nearest rows globally; exact radius filtering done in JS.
  // Params: $1=lon_center, $2=lat_center, $3=limit, $4+=filters
  // Center passed as a geometry literal for KNN ordering
  let additionalWhere = '';
  const params: any[] = [longitude, latitude, limit];
  let paramIndex = 4;

  if (additionalFilters) {
    const clauses: string[] = [];

    if (additionalFilters.property_type) {
      clauses.push(`property_type = $${paramIndex++}`);
      params.push(additionalFilters.property_type);
    }

    if (additionalFilters.price_max !== undefined) {
      clauses.push(`price <= $${paramIndex++}`);
      params.push(additionalFilters.price_max);
    }

    if (additionalFilters.bedrooms !== undefined) {
      clauses.push(`bedrooms = $${paramIndex++}`);
      params.push(additionalFilters.bedrooms);
    }

    if (clauses.length > 0) {
      additionalWhere = 'AND ' + clauses.join(' AND ');
    }
  }

  // KNN geo search using stored geom_point GiST index.
  // True ordered GiST traversal: visits only rows needed for LIMIT,
  // starting from the nearest — vastly faster than scan-all-then-sort.
  // ST_Distance (geography, exact) computed only for the returned LIMIT rows.
  const centerWkt = `ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)`;
  const sql = `
    SELECT
      id,
      portal,
      portal_id,
      title,
      price,
      currency,
      property_type,
      transaction_type,
      property_category,
      city,
      region,
      country,
      latitude,
      longitude,
      sqm,
      bedrooms,
      jsonb_build_array(images->0) AS images,
      status,
      created_at,
      source_url,
      -- Exact distance in km for returned rows only
      ST_Distance(geom_point::geography, ${centerWkt}::geography) / 1000.0 AS distance_km
    FROM properties
    WHERE
      geom_point IS NOT NULL
      AND status = 'active'
      AND (canonical_property_id IS NULL OR id = canonical_property_id)
      ${additionalWhere}
    ORDER BY
      -- Stored geom_point GiST: ordered traversal visits only rows needed for LIMIT
      geom_point <-> ${centerWkt}
    LIMIT $3
  `;

  const result = await pool.query(sql, params);
  // Filter out bbox corners: KNN returns nearest N within the bounding square,
  // but we need only those within the actual circle radius.
  return result.rows.filter((r: any) => r.distance_km <= radius_km);
}

/**
 * Perform geo-radius search across multiple countries (parallel)
 */
export async function multiCountryGeoSearch(
  countries: string[],
  latitude: number,
  longitude: number,
  radius_km: number,
  additionalFilters?: Record<string, any>,
  limit: number = 100
): Promise<Map<string, any[]>> {
  const queries = countries.map(async (country) => {
    try {
      const pool = getCountryPool(country);
      const results = await geoRadiusSearchSingle(
        pool,
        latitude,
        longitude,
        radius_km,
        additionalFilters,
        limit
      );
      return { country, results };
    } catch (error) {
      geoLog.error({ err: error, country }, 'Geo-search error');
      return { country, results: [] };
    }
  });

  const allResults = await Promise.all(queries);
  return new Map(allResults.map(r => [r.country, r.results]));
}

/**
 * Execute geo-search request
 */
export async function executeGeoSearch(request: GeoSearchRequest): Promise<GeoSearchResponse> {
  geoQueriesTotal.inc();

  // Validate radius
  const radius_km = Math.min(request.radius_km, config.geo.maxRadiusKm);

  // Round coordinates to ~1km precision for cache key deduplication
  // 0.01° ≈ 1.1km at equator — jittered requests within the same cell share a cache entry
  const cacheLatitude  = Math.round(request.latitude  * 100) / 100;
  const cacheLongitude = Math.round(request.longitude * 100) / 100;
  const cacheRadius    = Math.round(radius_km * 2) / 2; // round to nearest 0.5km

  // Check cache
  const cached = await getCachedGeoSearchResults(
    cacheLatitude,
    cacheLongitude,
    cacheRadius,
    request.filters || {}
  );

  if (cached) {
    geoLog.debug('Cache hit for geo-search');
    return cached;
  }

  // Single-flight: coalesce concurrent identical cache-miss requests
  const flightKey = crypto.createHash('md5').update(JSON.stringify({
    cacheLatitude, cacheLongitude, cacheRadius, filters: request.filters || {}
  })).digest('hex');
  if (inFlightGeo.has(flightKey)) {
    return inFlightGeo.get(flightKey)!;
  }
  const geoPromise = _executeGeoSearch(request, radius_km, cacheLatitude, cacheLongitude, cacheRadius)
    .finally(() => inFlightGeo.delete(flightKey));
  inFlightGeo.set(flightKey, geoPromise);
  return geoPromise;
}

async function _executeGeoSearch(
  request: GeoSearchRequest,
  radius_km: number,
  cacheLatitude: number,
  cacheLongitude: number,
  cacheRadius: number
): Promise<GeoSearchResponse> {
  const startTime = Date.now();

  // Determine countries to search
  const countries = request.countries || getAllCountryCodes();

  // Execute geo-search across countries
  const resultsByCountry = await multiCountryGeoSearch(
    countries,
    request.latitude,
    request.longitude,
    radius_km,
    request.filters,
    request.limit ? request.limit * 2 : 200  // Over-fetch for global sorting
  );

  // Flatten and transform results
  const allResults: GeoSearchResult[] = [];

  resultsByCountry.forEach((results, countryCode) => {
    const countryModule = getCountryModule(countryCode);

    results.forEach(row => {
      const transformed = countryModule.transformResult(row);

      // Add distance formatting
      const distance_formatted = countryModule.formatDistance
        ? countryModule.formatDistance(row.distance_km)
        : `${row.distance_km.toFixed(2)} km`;

      allResults.push({
        ...transformed,
        distance_km: row.distance_km,
        distance_formatted
      });
    });
  });

  // Apply sort: default by distance, or by sort_by preset
  if (request.sort_by && SORT_BY_PRESETS[request.sort_by]) {
    const sortPreset = SORT_BY_PRESETS[request.sort_by];
    allResults.sort((a, b) => {
      const aVal = (a as any)[sortPreset.field];
      const bVal = (b as any)[sortPreset.field];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortPreset.order === 'asc' ? cmp : -cmp;
    });
  } else {
    // Default: sort by distance
    allResults.sort((a, b) => a.distance_km - b.distance_km);
  }

  // Apply pagination
  const limit = Math.min(request.limit || 20, config.search.maxLimit);
  const page = Math.max(1, request.page || 1);
  const offset = (page - 1) * limit;
  const total = allResults.length;
  const paginated = allResults.slice(offset, offset + limit);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pagination: PaginationMetadata = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  const response: GeoSearchResponse = {
    center: {
      latitude: request.latitude,
      longitude: request.longitude
    },
    radius_km,
    total,
    results: paginated,
    pagination,
    query_time_ms: Date.now() - startTime
  };

  // Cache the response under the rounded key
  await cacheGeoSearchResults(
    cacheLatitude,
    cacheLongitude,
    cacheRadius,
    request.filters || {},
    response
  );

  return response;
}

/**
 * Find nearest properties (any country)
 */
export async function findNearestProperties(
  latitude: number,
  longitude: number,
  limit: number = 10
): Promise<GeoSearchResult[]> {
  const request: GeoSearchRequest = {
    latitude,
    longitude,
    radius_km: 50,  // Start with 50km radius
    limit: limit * 2  // Over-fetch
  };

  const response = await executeGeoSearch(request);
  return response.results.slice(0, limit);
}

/**
 * Geo-bounding box search (for map views)
 */
export async function geoBoundingBoxSearch(
  pool: Pool,
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
  limit: number = 100
): Promise<any[]> {
  // PostGIS envelope query using GIST index on geom_point
  const sql = `
    SELECT
      id,
      portal,
      portal_id,
      title,
      price,
      currency,
      property_type,
      transaction_type,
      property_category,
      city,
      region,
      country,
      latitude,
      longitude,
      sqm,
      bedrooms,
      jsonb_build_array(images->0) AS images,
      status,
      created_at,
      source_url
    FROM properties
    WHERE
      geom_point IS NOT NULL
      AND status = 'active'
      AND (canonical_property_id IS NULL OR id = canonical_property_id)
      AND geom_point && ST_MakeEnvelope($3, $1, $4, $2, 4326)
    LIMIT $5
  `;

  const result = await pool.query(sql, [
    bounds.south,
    bounds.north,
    bounds.west,
    bounds.east,
    limit
  ]);

  return result.rows;
}

// Import helper
import { getAllCountryCodes } from '../countries';
