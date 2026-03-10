/**
 * Search Engine
 *
 * Core search logic that orchestrates queries across multiple countries.
 */

import { SearchRequest, SearchResponse, SearchSort, SortByPreset, PaginationMetadata } from '../types/search';
import { getCountryModules, getAllCountryCodes } from '../countries';
import { buildSearchQuery } from '../database/query-builder';
import { queryCountries } from '../database/multi-db-manager';
import { mergeAndRankResults } from '../federation/result-aggregator';
import { config } from '../config';
import {
  getCachedSearchResults,
  cacheSearchResults,
  cacheSearchCount,
  getCachedSearchCount
} from '../cache/cache-strategies';
import { searchResultsTotal, searchErrorsTotal } from '../metrics';
import { searchLog } from '../logger';
import { resolveBoundaryGeometry } from '../database/boundary-resolver';

import * as crypto from 'crypto';

// ─── Single-flight coalescing ────────────────────────────────────────────────
// Deduplicates concurrent identical requests so only one hits the DB.
const inFlight = new Map<string, Promise<SearchResponse>>();

function requestKey(request: SearchRequest): string {
  return crypto.createHash('md5').update(JSON.stringify(request)).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────

const SORT_BY_PRESETS: Record<SortByPreset, SearchSort> = {
  price_asc: { field: 'price', order: 'asc' },
  price_desc: { field: 'price', order: 'desc' },
  date_newest: { field: 'created_at', order: 'desc' },
  date_oldest: { field: 'created_at', order: 'asc' },
};

/**
 * Resolve sort parameters from sort_by preset or explicit sort object
 */
export function resolveSort(request: SearchRequest): SearchSort {
  if (request.sort_by && SORT_BY_PRESETS[request.sort_by]) {
    return SORT_BY_PRESETS[request.sort_by];
  }
  return request.sort || { field: 'created_at', order: 'desc' };
}

/**
 * Resolve page-based pagination into limit/offset
 */
export function resolvePagination(request: SearchRequest): { page: number; limit: number; offset: number } {
  const page = Math.max(1, request.page || 1);
  let limit: number;

  if (request.limit !== undefined) {
    limit = Math.min(Math.max(1, request.limit), config.search.maxLimit);
  } else if (request.pagination?.limit !== undefined) {
    limit = Math.min(Math.max(1, request.pagination.limit), config.search.maxLimit);
  } else {
    limit = config.search.defaultLimit;
  }

  const offset = request.pagination?.offset !== undefined
    ? request.pagination.offset
    : (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build pagination metadata from total count and resolved pagination
 */
export function buildPaginationMetadata(total: number, page: number, limit: number): PaginationMetadata {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Execute search across multiple countries.
 * Uses single-flight coalescing to deduplicate concurrent identical requests,
 * and Redis caching for cross-instance shared cache.
 */
export async function executeSearch(request: SearchRequest): Promise<SearchResponse> {
  // 1. Redis cache
  const cached = await getCachedSearchResults(request);
  if (cached) {
    searchLog.debug('Redis cache hit for search request');
    return cached;
  }

  // 2. Single-flight: reuse in-flight promise for identical concurrent requests
  const key = requestKey(request);
  if (inFlight.has(key)) {
    searchLog.debug('Single-flight coalescing for search request');
    return inFlight.get(key)!;
  }

  const promise = _executeSearch(request).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/**
 * Internal search execution (called once per unique concurrent request)
 */
async function _executeSearch(request: SearchRequest): Promise<SearchResponse> {
  // Resolve sort and pagination
  const sort = resolveSort(request);
  const { page, limit, offset } = resolvePagination(request);

  // Determine which countries to query
  const countries = request.countries?.includes('*')
    ? getAllCountryCodes()
    : (request.countries || getAllCountryCodes());

  searchLog.info({ countryCount: countries.length, countries, page, limit }, 'Executing search');

  // Resolve boundary geometry if boundary_id filter is set
  if (request.filters.boundary_id && !request.filters._boundary_geojson) {
    const geojson = await resolveBoundaryGeometry(request.filters.boundary_id);
    if (!geojson) {
      return {
        total: 0,
        results: [],
        pagination: buildPaginationMetadata(0, page, limit),
        aggregations: {
          by_country: {},
          by_property_type: {},
          by_transaction_type: {},
          price_range: { min: 0, max: 0, avg: 0 },
          total_results: 0,
        },
        query_time_ms: 0,
        countries_queried: countries,
      };
    }
    request.filters._boundary_geojson = geojson;
  }

  // Get country modules
  const countryModules = getCountryModules(countries);

  // Build base query
  const baseQuery = buildSearchQuery(request);

  // Enhance queries per country (country-specific filters)
  const enhancedQueries = new Map<string, { data: { sql: string; params: any[] }; count: { sql: string; params: any[] } }>();

  countryModules.forEach(module => {
    const countryQuery = baseQuery.clone();

    // Apply country-specific enhancements
    const enhanced = module.enhanceQuery(countryQuery, request.filters);

    // Validate country-specific filters
    const validation = module.validateFilters(request.filters);
    if (!validation.valid) {
      searchLog.warn({ country: module.config.code, errors: validation.errors }, 'Invalid filters for country');
      return;
    }

    // Over-fetch for global sorting: fetch 20% extra per country so the
    // in-memory merge has enough candidates without doubling DB I/O.
    const finalQuery = enhanced.build(sort, Math.ceil((limit + offset) * 1.2), 0);
    const countQuery = enhanced.buildCount(10000);
    enhancedQueries.set(module.config.code, { data: finalQuery, count: countQuery });
  });

  // Execute data + count queries in parallel per country
  const queriesArray = Array.from(enhancedQueries.entries());
  const [dataResults, countResults] = await Promise.all([
    // Data queries
    Promise.all(
      queriesArray.map(async ([country, { data: query }]) => {
        try {
          const result = await queryCountries([country], query.sql, query.params);
          const countryResult = result.get(country);
          if (countryResult?.result) {
            searchResultsTotal.observe({ country }, countryResult.result.rowCount ?? 0);
          }
          return { country, result: countryResult };
        } catch (error) {
          searchLog.error({ err: error, country }, 'Error querying country');
          searchErrorsTotal.inc({ type: 'query', country });
          return { country, result: { country, error: error as Error } };
        }
      })
    ),
    // Count queries (skipped on page 2+ if cached)
    (async () => {
      if (page > 1) {
        const cachedCount = await getCachedSearchCount(request);
        if (cachedCount !== null) {
          searchLog.debug('Using cached count for page 2+ request');
          return cachedCount;
        }
      }
      // Run capped count queries in parallel across countries
      const counts = await Promise.all(
        queriesArray.map(async ([country, { count: cq }]) => {
          try {
            const result = await queryCountries([country], cq.sql, cq.params);
            const row = result.get(country)?.result?.rows?.[0];
            return row ? Number(row._total_count ?? 0) : 0;
          } catch {
            return 0;
          }
        })
      );
      return counts.reduce((a, b) => a + b, 0);
    })()
  ]);

  let grandTotal: number;
  if (typeof countResults === 'number') {
    grandTotal = countResults;
    if (page === 1) {
      await cacheSearchCount(request, grandTotal);
    }
  } else {
    grandTotal = 0;
  }

  // Convert data results to Map
  const resultsByCountry = new Map(
    dataResults.map(r => [r.country, r.result!])
  );

  // Merge and rank results
  const response = mergeAndRankResults(
    resultsByCountry,
    countries,
    sort.field,
    sort.order,
    limit,
    offset,
    grandTotal,
    page
  );

  // Cache the response in Redis
  await cacheSearchResults(request, response);

  return response;
}

/**
 * Validate search request
 */
export function validateSearchRequest(request: SearchRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate countries
  if (request.countries && request.countries.length > 0) {
    if (!request.countries.includes('*')) {
      const allCountries = getAllCountryCodes();
      const invalidCountries = request.countries.filter(c => !allCountries.includes(c));
      if (invalidCountries.length > 0) {
        errors.push(`Invalid countries: ${invalidCountries.join(', ')}`);
      }
    }
  }

  // Validate filters
  if (request.filters) {
    // Price validation
    if (request.filters.price_min !== undefined && request.filters.price_min < 0) {
      errors.push('price_min must be non-negative');
    }

    if (request.filters.price_max !== undefined && request.filters.price_max < 0) {
      errors.push('price_max must be non-negative');
    }

    if (
      request.filters.price_min !== undefined &&
      request.filters.price_max !== undefined &&
      request.filters.price_min > request.filters.price_max
    ) {
      errors.push('price_min must be less than or equal to price_max');
    }

    // Bedroom validation
    if (request.filters.bedrooms !== undefined && request.filters.bedrooms < 0) {
      errors.push('bedrooms must be non-negative');
    }

    // Square meter validation
    if (request.filters.sqm_min !== undefined && request.filters.sqm_min < 0) {
      errors.push('sqm_min must be non-negative');
    }

    if (
      request.filters.sqm_min !== undefined &&
      request.filters.sqm_max !== undefined &&
      request.filters.sqm_min > request.filters.sqm_max
    ) {
      errors.push('sqm_min must be less than or equal to sqm_max');
    }

    // Boundary ID validation (must be a UUID)
    if (request.filters.boundary_id !== undefined) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(request.filters.boundary_id)) {
        errors.push('boundary_id must be a valid UUID');
      }
    }
  }

  // Validate sort
  if (request.sort) {
    const validSortFields = [
      'price', 'created_at', 'updated_at', 'sqm', 'bedrooms', 'bathrooms', 'city'
    ];
    if (!validSortFields.includes(request.sort.field)) {
      errors.push(`Invalid sort field: ${request.sort.field}. Must be one of: ${validSortFields.join(', ')}`);
    }

    if (!['asc', 'desc'].includes(request.sort.order)) {
      errors.push('Invalid sort order. Must be "asc" or "desc"');
    }
  }

  // Validate sort_by preset
  if (request.sort_by) {
    const validPresets: SortByPreset[] = ['price_asc', 'price_desc', 'date_newest', 'date_oldest'];
    if (!validPresets.includes(request.sort_by)) {
      errors.push(`Invalid sort_by: ${request.sort_by}. Must be one of: ${validPresets.join(', ')}`);
    }
  }

  // Validate page-based pagination
  if (request.page !== undefined) {
    if (!Number.isInteger(request.page) || request.page < 1) {
      errors.push('page must be a positive integer');
    }
  }

  if (request.limit !== undefined) {
    if (request.limit < 1 || request.limit > config.search.maxLimit) {
      errors.push(`limit must be between 1 and ${config.search.maxLimit}`);
    }
  }

  // Validate legacy pagination
  if (request.pagination) {
    if (request.pagination.limit < 1 || request.pagination.limit > config.search.maxLimit) {
      errors.push(`limit must be between 1 and ${config.search.maxLimit}`);
    }

    if (request.pagination.offset < 0) {
      errors.push('offset must be non-negative');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
