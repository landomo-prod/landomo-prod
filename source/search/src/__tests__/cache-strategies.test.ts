/**
 * Cache Strategies Tests
 *
 * Tests for caching and retrieval of search results, property details,
 * aggregations, geo-search results, and filter metadata.
 */

// --- Mocks ---

jest.mock('../logger', () => {
  const noop = jest.fn();
  const log: any = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop };
  log.child = () => log;
  return {
    logger: log, cacheLog: log, searchLog: log, federationLog: log,
    geoLog: log, dbLog: log, routeLog: log, configLog: log, serverLog: log,
  };
});

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();
const mockCacheDeletePattern = jest.fn();
const mockGenerateCacheKey = jest.fn();

jest.mock('../cache/redis-manager', () => ({
  cacheGet: (...args: any[]) => mockCacheGet(...args),
  cacheSet: (...args: any[]) => mockCacheSet(...args),
  cacheDelete: (...args: any[]) => mockCacheDelete(...args),
  cacheDeletePattern: (...args: any[]) => mockCacheDeletePattern(...args),
  generateCacheKey: (...args: any[]) => mockGenerateCacheKey(...args),
}));

jest.mock('../config', () => ({
  config: {
    cache: {
      ttlSearch: 300,
      ttlProperty: 1800,
      ttlAggregations: 3600,
      ttlFilters: 86400,
    },
  },
}));

import {
  cacheSearchResults,
  getCachedSearchResults,
  cachePropertyDetail,
  getCachedPropertyDetail,
  invalidatePropertyCache,
  cacheAggregations,
  getCachedAggregations,
  cacheFilterMetadata,
  getCachedFilterMetadata,
  cacheGeoSearchResults,
  getCachedGeoSearchResults,
  invalidateAllSearchCaches,
  invalidateCountryCaches,
} from '../cache/cache-strategies';
import { SearchRequest, SearchResponse, PropertyResult } from '../types/search';

describe('search result caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateCacheKey.mockReturnValue('search:abc123');
  });

  const request: SearchRequest = { filters: { city: 'Prague' } };
  const response: SearchResponse = {
    total: 1,
    results: [],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    aggregations: {
      by_country: {},
      by_property_type: {},
      by_transaction_type: {},
      price_range: { min: 0, max: 0, avg: 0 },
      total_results: 1,
    },
    query_time_ms: 10,
    countries_queried: ['czech'],
  };

  it('caches search results with correct TTL', async () => {
    await cacheSearchResults(request, response);

    expect(mockGenerateCacheKey).toHaveBeenCalledWith('search', request);
    expect(mockCacheSet).toHaveBeenCalledWith('search:abc123', response, 300);
  });

  it('retrieves cached search results', async () => {
    mockCacheGet.mockResolvedValue(response);

    const result = await getCachedSearchResults(request);

    expect(mockGenerateCacheKey).toHaveBeenCalledWith('search', request);
    expect(mockCacheGet).toHaveBeenCalledWith('search:abc123');
    expect(result).toBe(response);
  });

  it('returns null on cache miss', async () => {
    mockCacheGet.mockResolvedValue(null);

    const result = await getCachedSearchResults(request);
    expect(result).toBeNull();
  });
});

describe('property detail caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const property: PropertyResult = {
    id: 'uuid-1',
    portal: 'sreality',
    portal_id: 'p-1',
    title: 'Test',
    price: 100000,
    currency: 'CZK',
    property_type: 'apartment',
    transaction_type: 'sale',
    city: 'Prague',
    region: 'Central',
    country: 'czech',
    created_at: '2024-01-01',
  };

  it('caches property detail with country:id key and correct TTL', async () => {
    await cachePropertyDetail('czech', 'uuid-1', property);

    expect(mockCacheSet).toHaveBeenCalledWith(
      'property:czech:uuid-1',
      property,
      1800
    );
  });

  it('retrieves cached property detail', async () => {
    mockCacheGet.mockResolvedValue(property);

    const result = await getCachedPropertyDetail('czech', 'uuid-1');

    expect(mockCacheGet).toHaveBeenCalledWith('property:czech:uuid-1');
    expect(result).toBe(property);
  });

  it('returns null for uncached property', async () => {
    mockCacheGet.mockResolvedValue(null);

    const result = await getCachedPropertyDetail('czech', 'nonexistent');
    expect(result).toBeNull();
  });

  it('invalidates property cache', async () => {
    await invalidatePropertyCache('czech', 'uuid-1');

    expect(mockCacheDelete).toHaveBeenCalledWith('property:czech:uuid-1');
  });
});

describe('aggregation caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caches aggregations with country-specific key', async () => {
    await cacheAggregations('overview', 'czech', { total: 100 });

    expect(mockCacheSet).toHaveBeenCalledWith(
      'agg:overview:czech',
      { total: 100 },
      3600
    );
  });

  it('caches global aggregations with null country', async () => {
    await cacheAggregations('overview', null, { total: 1000 });

    expect(mockCacheSet).toHaveBeenCalledWith(
      'agg:overview:global',
      { total: 1000 },
      3600
    );
  });

  it('retrieves cached country aggregations', async () => {
    mockCacheGet.mockResolvedValue({ total: 100 });

    const result = await getCachedAggregations('overview', 'czech');

    expect(mockCacheGet).toHaveBeenCalledWith('agg:overview:czech');
    expect(result).toEqual({ total: 100 });
  });

  it('retrieves cached global aggregations', async () => {
    mockCacheGet.mockResolvedValue({ total: 1000 });

    const result = await getCachedAggregations('price_stats', null);

    expect(mockCacheGet).toHaveBeenCalledWith('agg:price_stats:global');
    expect(result).toEqual({ total: 1000 });
  });
});

describe('filter metadata caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caches filter metadata with correct TTL (24h)', async () => {
    const metadata = { cities: ['Prague', 'Brno'] };
    await cacheFilterMetadata('czech', metadata);

    expect(mockCacheSet).toHaveBeenCalledWith(
      'filters:czech:metadata',
      metadata,
      86400
    );
  });

  it('retrieves cached filter metadata', async () => {
    const metadata = { cities: ['Prague'] };
    mockCacheGet.mockResolvedValue(metadata);

    const result = await getCachedFilterMetadata('czech');

    expect(mockCacheGet).toHaveBeenCalledWith('filters:czech:metadata');
    expect(result).toEqual(metadata);
  });
});

describe('geo-search result caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateCacheKey.mockReturnValue('geo:xyz789');
  });

  it('caches geo-search results with correct key and TTL', async () => {
    const results = { total: 5, results: [] };

    await cacheGeoSearchResults(50.0, 14.0, 10, {}, results);

    expect(mockGenerateCacheKey).toHaveBeenCalledWith('geo', {
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
      filters: {},
    });
    expect(mockCacheSet).toHaveBeenCalledWith('geo:xyz789', results, 300);
  });

  it('retrieves cached geo-search results', async () => {
    const cachedResults = { total: 5, results: [] };
    mockCacheGet.mockResolvedValue(cachedResults);

    const result = await getCachedGeoSearchResults(50.0, 14.0, 10, {});

    expect(result).toEqual(cachedResults);
  });
});

describe('cache invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates all search and geo caches', async () => {
    await invalidateAllSearchCaches();

    expect(mockCacheDeletePattern).toHaveBeenCalledWith('search:*');
    expect(mockCacheDeletePattern).toHaveBeenCalledWith('geo:*');
  });

  it('invalidates all caches for a specific country', async () => {
    await invalidateCountryCaches('czech');

    expect(mockCacheDeletePattern).toHaveBeenCalledWith('property:czech:*');
    expect(mockCacheDeletePattern).toHaveBeenCalledWith('agg:*:czech');
    expect(mockCacheDeletePattern).toHaveBeenCalledWith('filters:czech:*');
  });
});
