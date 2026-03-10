/**
 * Geo-Search Tests
 *
 * Tests for geographic radius search, bounding box search, and related utilities.
 */

import { Pool } from 'pg';

// --- Mocks ---

jest.mock('../logger', () => {
  const noop = jest.fn();
  const log: any = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop };
  log.child = () => log;
  return {
    logger: log, geoLog: log, searchLog: log, federationLog: log,
    dbLog: log, cacheLog: log, routeLog: log, configLog: log, serverLog: log,
  };
});

const mockPoolQuery = jest.fn();

jest.mock('../database/multi-db-manager', () => ({
  getCountryPool: (_country: string): Partial<Pool> => ({
    query: mockPoolQuery,
  }),
}));

const mockGetCachedGeoSearchResults = jest.fn();
const mockCacheGeoSearchResults = jest.fn();

jest.mock('../cache/cache-strategies', () => ({
  getCachedGeoSearchResults: (...args: any[]) => mockGetCachedGeoSearchResults(...args),
  cacheGeoSearchResults: (...args: any[]) => mockCacheGeoSearchResults(...args),
}));

jest.mock('../countries', () => ({
  getCountryModule: (code: string) => ({
    config: { code },
    transformResult: (row: any) => ({ ...row, country: code }),
    formatDistance: undefined,
  }),
  getAllCountryCodes: () => ['czech', 'germany'],
}));

jest.mock('../config', () => ({
  config: {
    geo: { defaultRadiusKm: 10, maxRadiusKm: 100 },
    search: { defaultLimit: 20, maxLimit: 100 },
    cache: { ttlSearch: 300 },
  },
}));

import {
  geoRadiusSearchSingle,
  multiCountryGeoSearch,
  executeGeoSearch,
  geoBoundingBoxSearch,
} from '../database/geo-search';

describe('geoRadiusSearchSingle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds PostGIS query with correct radius conversion', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoRadiusSearchSingle(pool, 50.0755, 14.4378, 10);

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockPoolQuery.mock.calls[0];

    // Check longitude, latitude, radius_m, limit
    expect(params[0]).toBe(14.4378); // longitude
    expect(params[1]).toBe(50.0755); // latitude
    expect(params[2]).toBe(10000);    // radius in meters (10km * 1000)
    expect(params[3]).toBe(100);      // default limit

    // SQL should contain PostGIS functions
    expect(sql).toContain('ST_DWithin');
    expect(sql).toContain('ST_Distance');
    expect(sql).toContain('ST_MakePoint');
    expect(sql).toContain("status = 'active'");
  });

  it('applies additional property_type filter', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoRadiusSearchSingle(pool, 50.0, 14.0, 5, { property_type: 'apartment' });

    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain('property_type = $5');
    expect(params[4]).toBe('apartment');
  });

  it('applies additional price_max filter', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoRadiusSearchSingle(pool, 50.0, 14.0, 5, { price_max: 500000 });

    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain('price <= $5');
    expect(params[4]).toBe(500000);
  });

  it('applies additional bedrooms filter', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoRadiusSearchSingle(pool, 50.0, 14.0, 5, { bedrooms: 3 });

    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain('bedrooms = $5');
    expect(params[4]).toBe(3);
  });

  it('applies multiple additional filters with correct param indexing', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoRadiusSearchSingle(pool, 50.0, 14.0, 5, {
      property_type: 'house',
      price_max: 300000,
      bedrooms: 2,
    });

    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain('property_type = $5');
    expect(sql).toContain('price <= $6');
    expect(sql).toContain('bedrooms = $7');
    expect(params.slice(4)).toEqual(['house', 300000, 2]);
  });

  it('uses custom limit', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoRadiusSearchSingle(pool, 50.0, 14.0, 5, undefined, 50);

    const [_sql, params] = mockPoolQuery.mock.calls[0];
    expect(params[3]).toBe(50);
  });

  it('returns rows from the query result', async () => {
    const rows = [
      { id: '1', title: 'Flat', distance_km: 2.5, latitude: 50.1, longitude: 14.5 },
    ];
    mockPoolQuery.mockResolvedValue({ rows });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    const result = await geoRadiusSearchSingle(pool, 50.0, 14.0, 10);

    expect(result).toEqual(rows);
  });
});

describe('multiCountryGeoSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches across multiple countries in parallel', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ id: '1', distance_km: 1.0 }],
    });

    const result = await multiCountryGeoSearch(
      ['czech', 'germany'],
      50.0, 14.0, 10
    );

    expect(result.size).toBe(2);
    expect(result.has('czech')).toBe(true);
    expect(result.has('germany')).toBe(true);
  });

  it('returns empty array for countries with errors', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ id: '1' }] })
      .mockRejectedValueOnce(new Error('db down'));

    const result = await multiCountryGeoSearch(
      ['czech', 'germany'],
      50.0, 14.0, 10
    );

    // The error country should still be in the map with empty results
    expect(result.get('czech')).toHaveLength(1);
    expect(result.get('germany')).toHaveLength(0);
  });
});

describe('executeGeoSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedGeoSearchResults.mockResolvedValue(null);
    mockCacheGeoSearchResults.mockResolvedValue(undefined);
  });

  it('returns cached results on cache hit', async () => {
    const cached = {
      center: { latitude: 50.0, longitude: 14.0 },
      radius_km: 10,
      total: 5,
      results: [],
      query_time_ms: 1,
    };
    mockGetCachedGeoSearchResults.mockResolvedValue(cached);

    const result = await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
    });

    expect(result).toBe(cached);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('caps radius at maxRadiusKm', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const result = await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 999, // exceeds max of 100
    });

    expect(result.radius_km).toBe(100);
  });

  it('sorts results by distance ascending', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [
        { id: '1', distance_km: 5.0, property_type: 'apartment', transaction_type: 'sale', price: 100000 },
        { id: '2', distance_km: 1.0, property_type: 'house', transaction_type: 'sale', price: 200000 },
      ],
    });

    const result = await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
      countries: ['czech'], // single country to avoid duplicates from mock
    });

    expect(result.results[0].distance_km).toBe(1.0);
    expect(result.results[1].distance_km).toBe(5.0);
  });

  it('applies limit to results', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      distance_km: i,
      property_type: 'apartment',
      transaction_type: 'sale',
      price: 100000,
    }));
    mockPoolQuery.mockResolvedValue({ rows });

    const result = await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
      limit: 5,
    });

    expect(result.results.length).toBeLessThanOrEqual(5);
    expect(result.pagination).toBeDefined();
    expect(result.pagination.limit).toBe(5);
    expect(result.pagination.page).toBe(1);
  });

  it('includes center coordinates and radius in response', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const result = await executeGeoSearch({
      latitude: 48.8566,
      longitude: 2.3522,
      radius_km: 25,
    });

    expect(result.center.latitude).toBe(48.8566);
    expect(result.center.longitude).toBe(2.3522);
    expect(result.radius_km).toBe(25);
  });

  it('caches results after querying', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
    });

    expect(mockCacheGeoSearchResults).toHaveBeenCalledTimes(1);
  });

  it('uses all countries when none specified', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
    });

    // Should query both czech and germany (mocked getAllCountryCodes)
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
  });

  it('uses specific countries when provided', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
      countries: ['czech'],
    });

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it('formats distance using default formatter', async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ id: '1', distance_km: 3.456, property_type: 'apartment', transaction_type: 'sale', price: 100000 }],
    });

    const result = await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
    });

    expect(result.results[0].distance_formatted).toBe('3.46 km');
  });

  it('includes query_time_ms in response', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const result = await executeGeoSearch({
      latitude: 50.0,
      longitude: 14.0,
      radius_km: 10,
    });

    expect(typeof result.query_time_ms).toBe('number');
    expect(result.query_time_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('geoBoundingBoxSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds bounding box SQL with correct params', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoBoundingBoxSearch(pool, {
      north: 51.0,
      south: 49.0,
      east: 15.0,
      west: 13.0,
    });

    const [sql, params] = mockPoolQuery.mock.calls[0];

    // Check param order: south, north, west, east, limit
    expect(params[0]).toBe(49.0); // south
    expect(params[1]).toBe(51.0); // north
    expect(params[2]).toBe(13.0); // west
    expect(params[3]).toBe(15.0); // east
    expect(params[4]).toBe(100);  // default limit

    expect(sql).toContain('latitude BETWEEN $1 AND $2');
    expect(sql).toContain('longitude BETWEEN $3 AND $4');
    expect(sql).toContain("status = 'active'");
  });

  it('uses custom limit', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoBoundingBoxSearch(pool, {
      north: 51.0, south: 49.0, east: 15.0, west: 13.0,
    }, 50);

    const [_sql, params] = mockPoolQuery.mock.calls[0];
    expect(params[4]).toBe(50);
  });

  it('returns rows from query result', async () => {
    const rows = [
      { id: '1', title: 'Flat', latitude: 50.0, longitude: 14.0 },
    ];
    mockPoolQuery.mockResolvedValue({ rows });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    const result = await geoBoundingBoxSearch(pool, {
      north: 51.0, south: 49.0, east: 15.0, west: 13.0,
    });

    expect(result).toEqual(rows);
  });

  it('selects appropriate fields for map view', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const pool = { query: mockPoolQuery } as unknown as Pool;
    await geoBoundingBoxSearch(pool, {
      north: 51.0, south: 49.0, east: 15.0, west: 13.0,
    });

    const [sql] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain('id');
    expect(sql).toContain('title');
    expect(sql).toContain('price');
    expect(sql).toContain('latitude');
    expect(sql).toContain('longitude');
    expect(sql).toContain('images');
  });
});
