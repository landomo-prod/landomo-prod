/**
 * Search Engine Tests
 *
 * Tests for executeSearch and validateSearchRequest in the core search engine.
 */

import { SearchRequest } from '../types/search';

// --- Mocks must be defined before importing the module under test ---

jest.mock('../logger', () => {
  const noop = jest.fn();
  const log: any = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop };
  log.child = () => log;
  return {
    logger: log, searchLog: log, federationLog: log, geoLog: log,
    dbLog: log, cacheLog: log, routeLog: log, configLog: log, serverLog: log,
  };
});

jest.mock('../metrics', () => ({
  searchResultsTotal: { observe: jest.fn() },
  searchErrorsTotal: { inc: jest.fn() },
  cacheHitsTotal: { inc: jest.fn() },
  cacheMissesTotal: { inc: jest.fn() },
}));

const mockGetCachedSearchResults = jest.fn();
const mockCacheSearchResults = jest.fn();

jest.mock('../cache/cache-strategies', () => ({
  getCachedSearchResults: (...args: any[]) => mockGetCachedSearchResults(...args),
  cacheSearchResults: (...args: any[]) => mockCacheSearchResults(...args),
}));

const mockQueryCountries = jest.fn();

jest.mock('../database/multi-db-manager', () => ({
  queryCountries: (...args: any[]) => mockQueryCountries(...args),
}));

jest.mock('../countries', () => ({
  getAllCountryCodes: () => ['czech', 'germany', 'uk'],
  getCountryModules: (codes: string[]) =>
    codes.map(code => ({
      config: { code, name: code, database: `landomo_${code}`, currency: 'EUR', timezone: 'UTC' },
      enhanceQuery: (q: any, _filters: any) => q,
      validateFilters: (_filters: any) => ({ valid: true, errors: [] }),
      transformResult: (row: any) => ({ ...row, country: code }),
    })),
  getCountryModule: (code: string) => ({
    config: { code },
    transformResult: (row: any) => ({ ...row, country: code }),
  }),
}));

jest.mock('../config', () => ({
  config: {
    search: { defaultLimit: 20, maxLimit: 100 },
    cache: { ttlSearch: 300 },
  },
}));

import { executeSearch, validateSearchRequest, resolveSort, resolvePagination, buildPaginationMetadata } from '../core/search-engine';

/** Helper: make queryCountries return empty results keyed by the queried country */
function mockEmptyQueryCountries() {
  mockQueryCountries.mockImplementation((countries: string[], sql: string) => {
    const country = countries[0];
    // Return count row for COUNT queries, empty rows for data queries
    if (sql.includes('COUNT(*)')) {
      return Promise.resolve(new Map([
        [country, { country, result: { rows: [{ total: 0 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] } }],
      ]));
    }
    return Promise.resolve(new Map([
      [country, { country, result: { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] } }],
    ]));
  });
}

describe('validateSearchRequest', () => {
  it('returns valid for a minimal request', () => {
    const result = validateSearchRequest({ filters: {} });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid country codes', () => {
    const result = validateSearchRequest({
      countries: ['czech', 'invalid_country'],
      filters: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid countries');
  });

  it('allows wildcard country', () => {
    const result = validateSearchRequest({
      countries: ['*'],
      filters: {},
    });
    expect(result.valid).toBe(true);
  });

  it('rejects negative price_min', () => {
    const result = validateSearchRequest({
      filters: { price_min: -100 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('price_min must be non-negative');
  });

  it('rejects negative price_max', () => {
    const result = validateSearchRequest({
      filters: { price_max: -1 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('price_max must be non-negative');
  });

  it('rejects price_min > price_max', () => {
    const result = validateSearchRequest({
      filters: { price_min: 500000, price_max: 100000 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('price_min must be less than');
  });

  it('rejects negative bedrooms', () => {
    const result = validateSearchRequest({
      filters: { bedrooms: -1 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('bedrooms must be non-negative');
  });

  it('rejects negative sqm_min', () => {
    const result = validateSearchRequest({
      filters: { sqm_min: -10 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('sqm_min must be non-negative');
  });

  it('rejects sqm_min > sqm_max', () => {
    const result = validateSearchRequest({
      filters: { sqm_min: 200, sqm_max: 50 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('sqm_min must be less than');
  });

  it('rejects invalid sort field', () => {
    const result = validateSearchRequest({
      filters: {},
      sort: { field: 'invalid', order: 'asc' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid sort field');
  });

  it('rejects invalid sort order', () => {
    const result = validateSearchRequest({
      filters: {},
      sort: { field: 'price', order: 'random' as any },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid sort order');
  });

  it('rejects limit out of range', () => {
    const result = validateSearchRequest({
      filters: {},
      pagination: { limit: 0, offset: 0 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('limit must be between');
  });

  it('rejects limit above max', () => {
    const result = validateSearchRequest({
      filters: {},
      pagination: { limit: 999, offset: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects negative offset', () => {
    const result = validateSearchRequest({
      filters: {},
      pagination: { limit: 20, offset: -1 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('offset must be non-negative');
  });

  it('accepts valid sort and pagination', () => {
    const result = validateSearchRequest({
      filters: {},
      sort: { field: 'price', order: 'desc' },
      pagination: { limit: 50, offset: 10 },
    });
    expect(result.valid).toBe(true);
  });

  it('accepts valid sort_by preset', () => {
    const result = validateSearchRequest({
      filters: {},
      sort_by: 'price_asc',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid sort_by preset', () => {
    const result = validateSearchRequest({
      filters: {},
      sort_by: 'invalid_sort' as any,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid sort_by');
  });

  it('accepts valid page number', () => {
    const result = validateSearchRequest({
      filters: {},
      page: 5,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects page less than 1', () => {
    const result = validateSearchRequest({
      filters: {},
      page: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('page must be a positive integer');
  });

  it('rejects non-integer page', () => {
    const result = validateSearchRequest({
      filters: {},
      page: 1.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('page must be a positive integer');
  });

  it('accepts valid top-level limit', () => {
    const result = validateSearchRequest({
      filters: {},
      limit: 50,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects top-level limit out of range', () => {
    const result = validateSearchRequest({
      filters: {},
      limit: 200,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('limit must be between');
  });

  it('accepts page + limit + sort_by together', () => {
    const result = validateSearchRequest({
      filters: {},
      page: 2,
      limit: 25,
      sort_by: 'date_newest',
    });
    expect(result.valid).toBe(true);
  });

  it('collects multiple errors', () => {
    const result = validateSearchRequest({
      filters: { price_min: -1, bedrooms: -1, sqm_min: -1 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('resolveSort', () => {
  it('resolves sort_by preset', () => {
    expect(resolveSort({ filters: {}, sort_by: 'price_asc' })).toEqual({ field: 'price', order: 'asc' });
    expect(resolveSort({ filters: {}, sort_by: 'price_desc' })).toEqual({ field: 'price', order: 'desc' });
    expect(resolveSort({ filters: {}, sort_by: 'date_newest' })).toEqual({ field: 'created_at', order: 'desc' });
    expect(resolveSort({ filters: {}, sort_by: 'date_oldest' })).toEqual({ field: 'created_at', order: 'asc' });
  });

  it('prefers sort_by over sort object', () => {
    const result = resolveSort({
      filters: {},
      sort_by: 'price_asc',
      sort: { field: 'sqm', order: 'desc' },
    });
    expect(result).toEqual({ field: 'price', order: 'asc' });
  });

  it('falls back to sort object', () => {
    const result = resolveSort({
      filters: {},
      sort: { field: 'sqm', order: 'desc' },
    });
    expect(result).toEqual({ field: 'sqm', order: 'desc' });
  });

  it('defaults to created_at desc', () => {
    const result = resolveSort({ filters: {} });
    expect(result).toEqual({ field: 'created_at', order: 'desc' });
  });
});

describe('resolvePagination', () => {
  it('defaults to page 1 with defaultLimit', () => {
    const result = resolvePagination({ filters: {} });
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('computes offset from page number', () => {
    const result = resolvePagination({ filters: {}, page: 3, limit: 10 });
    expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('uses top-level limit over pagination.limit', () => {
    const result = resolvePagination({ filters: {}, limit: 50, pagination: { limit: 10, offset: 0 } });
    expect(result.limit).toBe(50);
  });

  it('falls back to pagination.limit if no top-level limit', () => {
    const result = resolvePagination({ filters: {}, pagination: { limit: 30, offset: 0 } });
    expect(result.limit).toBe(30);
  });

  it('respects pagination.offset when provided', () => {
    const result = resolvePagination({ filters: {}, pagination: { limit: 20, offset: 100 } });
    expect(result.offset).toBe(100);
  });

  it('clamps limit to maxLimit', () => {
    const result = resolvePagination({ filters: {}, limit: 999 });
    expect(result.limit).toBe(100);
  });

  it('clamps limit minimum to 1', () => {
    const result = resolvePagination({ filters: {}, limit: -5 });
    expect(result.limit).toBe(1);
  });

  it('clamps page minimum to 1', () => {
    const result = resolvePagination({ filters: {}, page: -1 });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });
});

describe('buildPaginationMetadata', () => {
  it('builds correct metadata for first page', () => {
    const meta = buildPaginationMetadata(100, 1, 20);
    expect(meta).toEqual({ page: 1, limit: 20, total: 100, totalPages: 5, hasNext: true, hasPrev: false });
  });

  it('builds correct metadata for middle page', () => {
    const meta = buildPaginationMetadata(100, 3, 20);
    expect(meta).toEqual({ page: 3, limit: 20, total: 100, totalPages: 5, hasNext: true, hasPrev: true });
  });

  it('builds correct metadata for last page', () => {
    const meta = buildPaginationMetadata(100, 5, 20);
    expect(meta).toEqual({ page: 5, limit: 20, total: 100, totalPages: 5, hasNext: false, hasPrev: true });
  });

  it('handles zero total', () => {
    const meta = buildPaginationMetadata(0, 1, 20);
    expect(meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false });
  });

  it('handles total less than limit', () => {
    const meta = buildPaginationMetadata(5, 1, 20);
    expect(meta).toEqual({ page: 1, limit: 20, total: 5, totalPages: 1, hasNext: false, hasPrev: false });
  });
});

describe('executeSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedSearchResults.mockResolvedValue(null);
    mockCacheSearchResults.mockResolvedValue(undefined);
  });

  it('returns cached results on cache hit', async () => {
    const cachedResponse = {
      total: 5,
      results: [],
      pagination: { page: 1, limit: 20, total: 5, totalPages: 1, hasNext: false, hasPrev: false },
      aggregations: {
        by_country: {},
        by_property_type: {},
        by_transaction_type: {},
        price_range: { min: 0, max: 0, avg: 0 },
        total_results: 5,
      },
      query_time_ms: 1,
      countries_queried: ['czech'],
    };
    mockGetCachedSearchResults.mockResolvedValue(cachedResponse);

    const result = await executeSearch({ filters: {} });

    expect(result).toBe(cachedResponse);
    expect(mockQueryCountries).not.toHaveBeenCalled();
    expect(mockCacheSearchResults).not.toHaveBeenCalled();
  });

  it('queries all countries when no countries specified', async () => {
    mockEmptyQueryCountries();

    await executeSearch({ filters: {} });

    // Should be called for data + count per country (3 countries x 2 queries each = 6)
    expect(mockQueryCountries).toHaveBeenCalledTimes(6);
  });

  it('queries specific countries when specified', async () => {
    mockEmptyQueryCountries();

    await executeSearch({ countries: ['czech'], filters: {} });

    // 1 data query + 1 count query
    expect(mockQueryCountries).toHaveBeenCalledTimes(2);
    expect(mockQueryCountries).toHaveBeenCalledWith(['czech'], expect.any(String), expect.any(Array));
  });

  it('queries all countries when wildcard specified', async () => {
    mockEmptyQueryCountries();

    await executeSearch({ countries: ['*'], filters: {} });

    // 3 data queries + 3 count queries
    expect(mockQueryCountries).toHaveBeenCalledTimes(6);
  });

  it('caches results after querying', async () => {
    mockEmptyQueryCountries();

    const request: SearchRequest = { countries: ['czech'], filters: {} };
    await executeSearch(request);

    expect(mockCacheSearchResults).toHaveBeenCalledTimes(1);
    expect(mockCacheSearchResults).toHaveBeenCalledWith(request, expect.any(Object));
  });

  it('returns response with correct structure including pagination', async () => {
    mockQueryCountries.mockImplementation((countries: string[], sql: string) => {
      const country = countries[0];
      // Detect COUNT query vs data query
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve(new Map([
          [country, {
            country,
            result: {
              rows: [{ total: 1 }],
              rowCount: 1,
              command: 'SELECT',
              oid: 0,
              fields: [],
            },
          }],
        ]));
      }
      return Promise.resolve(new Map([
        [country, {
          country,
          result: {
            rows: [{ id: '1', price: 100000, property_type: 'apartment', transaction_type: 'sale', created_at: '2024-01-01' }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          },
        }],
      ]));
    });

    const result = await executeSearch({ countries: ['czech'], filters: {} });

    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('pagination');
    expect(result).toHaveProperty('aggregations');
    expect(result).toHaveProperty('query_time_ms');
    expect(result).toHaveProperty('countries_queried');
    expect(result.countries_queried).toEqual(['czech']);
    expect(result.pagination).toEqual(expect.objectContaining({
      page: 1,
      limit: 20,
      hasNext: expect.any(Boolean),
      hasPrev: false,
    }));
  });

  it('handles query errors gracefully for individual countries', async () => {
    let callCount = 0;
    mockQueryCountries.mockImplementation((countries: string[]) => {
      callCount++;
      const country = countries[0];
      if (callCount === 2) {
        return Promise.reject(new Error('connection timeout'));
      }
      return Promise.resolve(new Map([
        [country, {
          country,
          result: { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] },
        }],
      ]));
    });

    // Should not throw
    const result = await executeSearch({ filters: {} });
    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.pagination).toBeDefined();
  });

  it('merges results from multiple countries', async () => {
    mockQueryCountries.mockImplementation((countries: string[], sql: string) => {
      const country = countries[0];
      if (sql.includes('COUNT(*)')) {
        const total = country === 'czech' ? 1 : 1;
        return Promise.resolve(new Map([
          [country, { country, result: { rows: [{ total }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] } }],
        ]));
      }
      const rows = country === 'czech'
        ? [{ id: '1', price: 100000, property_type: 'apartment', transaction_type: 'sale', created_at: '2024-01-01' }]
        : [{ id: '2', price: 200000, property_type: 'house', transaction_type: 'sale', created_at: '2024-02-01' }];
      return Promise.resolve(new Map([
        [country, { country, result: { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] } }],
      ]));
    });

    const result = await executeSearch({ countries: ['czech', 'germany'], filters: {} });

    expect(result.total).toBe(2);
    expect(result.results.length).toBeLessThanOrEqual(20); // default limit
    expect(result.countries_queried).toEqual(['czech', 'germany']);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total).toBe(2);
  });

  it('respects page and limit parameters', async () => {
    mockQueryCountries.mockImplementation((countries: string[], sql: string) => {
      const country = countries[0];
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve(new Map([
          [country, { country, result: { rows: [{ total: 50 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] } }],
        ]));
      }
      return Promise.resolve(new Map([
        [country, { country, result: { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] } }],
      ]));
    });

    const result = await executeSearch({ countries: ['czech'], filters: {}, page: 3, limit: 10 });

    expect(result.pagination.page).toBe(3);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.total).toBe(50);
    expect(result.pagination.totalPages).toBe(5);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it('respects sort_by parameter', async () => {
    mockEmptyQueryCountries();

    await executeSearch({ countries: ['czech'], filters: {}, sort_by: 'price_asc' });

    // Verify SQL contains price ASC
    const dataCall = mockQueryCountries.mock.calls.find(
      (call: any[]) => !call[1].includes('COUNT(*)')
    );
    expect(dataCall).toBeDefined();
    expect(dataCall![1]).toContain('ORDER BY price ASC');
  });
});
