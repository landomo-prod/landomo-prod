/**
 * Result Aggregator Tests
 *
 * Tests for merging, sorting, paginating, and aggregating results from multiple countries.
 */

import {
  aggregateResults,
  sortResults,
  paginateResults,
  mergeAndRankResults,
  calculateStatistics,
} from '../federation/result-aggregator';
import { PropertyResult, SearchAggregations } from '../types/search';
import { CountryQueryResult } from '../database/multi-db-manager';

// Mock logger
jest.mock('../logger', () => {
  const noop = jest.fn();
  const log: any = { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop };
  log.child = () => log;
  return {
    logger: log, federationLog: log, searchLog: log, geoLog: log,
    dbLog: log, cacheLog: log, routeLog: log, configLog: log, serverLog: log,
  };
});

// Mock country modules
jest.mock('../countries', () => ({
  getCountryModule: (code: string) => ({
    config: { code, name: code, database: `landomo_${code}`, currency: 'EUR', timezone: 'UTC' },
    transformResult: (row: any) => ({
      ...row,
      country: code,
      country_name: code,
    }),
  }),
}));

function makeRow(overrides: Partial<PropertyResult> = {}): any {
  return {
    id: 'uuid-1',
    portal: 'test-portal',
    portal_id: 'p-1',
    title: 'Test Property',
    price: 250000,
    currency: 'EUR',
    property_type: 'apartment',
    transaction_type: 'sale',
    city: 'Prague',
    region: 'Central',
    country: 'czech',
    bedrooms: 2,
    bathrooms: 1,
    sqm: 65,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeQueryResult(rows: any[], country: string): CountryQueryResult {
  return {
    country,
    result: { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] },
  };
}

function makeErrorResult(country: string, message: string): CountryQueryResult {
  return {
    country,
    error: new Error(message),
  };
}

describe('aggregateResults', () => {
  it('aggregates results from multiple countries', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ id: '1', price: 100000, property_type: 'apartment', transaction_type: 'sale' }),
      makeRow({ id: '2', price: 200000, property_type: 'house', transaction_type: 'sale' }),
    ], 'czech'));
    results.set('germany', makeQueryResult([
      makeRow({ id: '3', price: 300000, property_type: 'apartment', transaction_type: 'rent' }),
    ], 'germany'));

    const { results: props, aggregations, total } = aggregateResults(results, ['czech', 'germany']);

    expect(total).toBe(3);
    expect(props).toHaveLength(3);
    expect(aggregations.by_country).toEqual({ czech: 2, germany: 1 });
    expect(aggregations.by_property_type).toEqual({ apartment: 2, house: 1 });
    expect(aggregations.by_transaction_type).toEqual({ sale: 2, rent: 1 });
  });

  it('calculates correct price range', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ price: 100000 }),
      makeRow({ price: 500000 }),
    ], 'czech'));

    const { aggregations } = aggregateResults(results, ['czech']);

    expect(aggregations.price_range.min).toBe(100000);
    expect(aggregations.price_range.max).toBe(500000);
    expect(aggregations.price_range.avg).toBe(300000);
  });

  it('handles rows without price', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ price: undefined }),
      makeRow({ price: 200000 }),
    ], 'czech'));

    const { aggregations } = aggregateResults(results, ['czech']);

    expect(aggregations.price_range.min).toBe(200000);
    expect(aggregations.price_range.max).toBe(200000);
    expect(aggregations.price_range.avg).toBe(200000);
  });

  it('handles empty results', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([], 'czech'));

    const { results: props, aggregations, total } = aggregateResults(results, ['czech']);

    expect(total).toBe(0);
    expect(props).toHaveLength(0);
    expect(aggregations.price_range.min).toBe(0);
    expect(aggregations.price_range.max).toBe(0);
    expect(aggregations.price_range.avg).toBe(0);
  });

  it('skips countries with errors', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([makeRow()], 'czech'));
    results.set('germany', makeErrorResult('germany', 'connection failed'));

    const { total } = aggregateResults(results, ['czech', 'germany']);

    expect(total).toBe(1);
  });

  it('skips countries with no result object', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', { country: 'czech' }); // no result, no error

    const { total } = aggregateResults(results, ['czech']);

    expect(total).toBe(0);
  });

  it('handles missing property_type and transaction_type', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ property_type: undefined, transaction_type: undefined }),
    ], 'czech'));

    const { aggregations } = aggregateResults(results, ['czech']);

    expect(aggregations.by_property_type).toEqual({ unknown: 1 });
    expect(aggregations.by_transaction_type).toEqual({ unknown: 1 });
  });
});

describe('sortResults', () => {
  const results: PropertyResult[] = [
    makeRow({ id: '1', price: 300000, created_at: '2024-03-01' }) as PropertyResult,
    makeRow({ id: '2', price: 100000, created_at: '2024-01-01' }) as PropertyResult,
    makeRow({ id: '3', price: 200000, created_at: '2024-02-01' }) as PropertyResult,
  ];

  it('sorts by price ascending', () => {
    const sorted = sortResults([...results], 'price', 'asc');
    expect(sorted[0].price).toBe(100000);
    expect(sorted[1].price).toBe(200000);
    expect(sorted[2].price).toBe(300000);
  });

  it('sorts by price descending', () => {
    const sorted = sortResults([...results], 'price', 'desc');
    expect(sorted[0].price).toBe(300000);
    expect(sorted[1].price).toBe(200000);
    expect(sorted[2].price).toBe(100000);
  });

  it('sorts by created_at descending by default', () => {
    const sorted = sortResults([...results]);
    expect(sorted[0].created_at).toBe('2024-03-01');
    expect(sorted[2].created_at).toBe('2024-01-01');
  });

  it('sorts string fields using localeCompare', () => {
    const cities: PropertyResult[] = [
      makeRow({ city: 'Prague' }) as PropertyResult,
      makeRow({ city: 'Berlin' }) as PropertyResult,
      makeRow({ city: 'Vienna' }) as PropertyResult,
    ];
    const sorted = sortResults([...cities], 'city', 'asc');
    expect(sorted[0].city).toBe('Berlin');
    expect(sorted[1].city).toBe('Prague');
    expect(sorted[2].city).toBe('Vienna');
  });

  it('places null/undefined values at end', () => {
    const items: PropertyResult[] = [
      makeRow({ id: '1', price: undefined }) as PropertyResult,
      makeRow({ id: '2', price: 100000 }) as PropertyResult,
      makeRow({ id: '3', price: undefined }) as PropertyResult,
    ];
    const sorted = sortResults([...items], 'price', 'asc');
    expect(sorted[0].price).toBe(100000);
  });
});

describe('paginateResults', () => {
  const items: PropertyResult[] = Array.from({ length: 10 }, (_, i) =>
    makeRow({ id: String(i), price: i * 100000 }) as PropertyResult
  );

  it('returns correct page with limit and offset', () => {
    const page = paginateResults(items, 3, 0);
    expect(page).toHaveLength(3);
    expect(page[0].id).toBe('0');
  });

  it('handles offset correctly', () => {
    const page = paginateResults(items, 3, 5);
    expect(page).toHaveLength(3);
    expect(page[0].id).toBe('5');
  });

  it('handles offset beyond results', () => {
    const page = paginateResults(items, 3, 100);
    expect(page).toHaveLength(0);
  });

  it('handles limit larger than remaining items', () => {
    const page = paginateResults(items, 20, 8);
    expect(page).toHaveLength(2);
  });
});

describe('mergeAndRankResults', () => {
  it('merges, sorts, and paginates results from multiple countries', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ id: '1', price: 300000, created_at: '2024-03-01' }),
      makeRow({ id: '2', price: 100000, created_at: '2024-01-01' }),
    ], 'czech'));
    results.set('germany', makeQueryResult([
      makeRow({ id: '3', price: 200000, created_at: '2024-02-01' }),
    ], 'germany'));

    const response = mergeAndRankResults(
      results,
      ['czech', 'germany'],
      'price',
      'asc',
      2,
      0
    );

    expect(response.total).toBe(3);
    expect(response.results).toHaveLength(2); // limit=2
    expect(response.results[0].price).toBe(100000);
    expect(response.results[1].price).toBe(200000);
    expect(response.countries_queried).toEqual(['czech', 'germany']);
    expect(response.aggregations).toBeDefined();
    expect(response.query_time_ms).toBeGreaterThanOrEqual(0);
  });

  it('uses default sort (created_at desc) and pagination', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ id: '1', created_at: '2024-01-01' }),
      makeRow({ id: '2', created_at: '2024-03-01' }),
    ], 'czech'));

    const response = mergeAndRankResults(results, ['czech']);

    // Default sort: created_at DESC
    expect(response.results[0].created_at).toBe('2024-03-01');
  });

  it('handles empty results', () => {
    const results = new Map<string, CountryQueryResult>();
    const response = mergeAndRankResults(results, []);

    expect(response.total).toBe(0);
    expect(response.results).toHaveLength(0);
  });

  it('returns pagination metadata', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ id: '1', price: 100000, created_at: '2024-01-01' }),
      makeRow({ id: '2', price: 200000, created_at: '2024-02-01' }),
      makeRow({ id: '3', price: 300000, created_at: '2024-03-01' }),
    ], 'czech'));

    const response = mergeAndRankResults(
      results,
      ['czech'],
      'price',
      'asc',
      2,
      0,
      10,  // grandTotal from COUNT query
      1    // page
    );

    expect(response.pagination).toBeDefined();
    expect(response.pagination.page).toBe(1);
    expect(response.pagination.limit).toBe(2);
    expect(response.pagination.total).toBe(10);
    expect(response.pagination.totalPages).toBe(5);
    expect(response.pagination.hasNext).toBe(true);
    expect(response.pagination.hasPrev).toBe(false);
    expect(response.total).toBe(10);
  });

  it('returns correct pagination for last page', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ id: '1', price: 100000, created_at: '2024-01-01' }),
    ], 'czech'));

    const response = mergeAndRankResults(
      results,
      ['czech'],
      'price',
      'asc',
      2,
      8,
      10,  // grandTotal
      5    // page 5 of 5
    );

    expect(response.pagination.page).toBe(5);
    expect(response.pagination.hasNext).toBe(false);
    expect(response.pagination.hasPrev).toBe(true);
    expect(response.pagination.totalPages).toBe(5);
  });

  it('falls back to in-memory total when grandTotal not provided', () => {
    const results = new Map<string, CountryQueryResult>();
    results.set('czech', makeQueryResult([
      makeRow({ id: '1' }),
      makeRow({ id: '2' }),
    ], 'czech'));

    const response = mergeAndRankResults(results, ['czech'], 'created_at', 'desc', 20, 0);

    expect(response.pagination.total).toBe(2);
    expect(response.pagination.page).toBe(1);
    expect(response.pagination.totalPages).toBe(1);
    expect(response.pagination.hasNext).toBe(false);
    expect(response.pagination.hasPrev).toBe(false);
  });
});

describe('calculateStatistics', () => {
  it('calculates correct statistics', () => {
    const aggregations: SearchAggregations = {
      by_country: { czech: 10, germany: 5, uk: 0 },
      by_property_type: { apartment: 8, house: 5, studio: 2 },
      by_transaction_type: { sale: 12, rent: 3 },
      price_range: { min: 50000, max: 1000000, avg: 300000 },
      total_results: 15,
    };

    const stats = calculateStatistics(aggregations);

    expect(stats.total_properties).toBe(15);
    expect(stats.countries_with_results).toBe(2); // czech and germany have > 0
    expect(stats.avg_price).toBe(300000);
    expect(stats.price_range.min).toBe(50000);
    expect(stats.price_range.max).toBe(1000000);
    expect(stats.most_common_type).toBe('apartment');
    expect(stats.most_common_transaction).toBe('sale');
  });

  it('handles empty aggregations', () => {
    const aggregations: SearchAggregations = {
      by_country: {},
      by_property_type: {},
      by_transaction_type: {},
      price_range: { min: 0, max: 0, avg: 0 },
      total_results: 0,
    };

    const stats = calculateStatistics(aggregations);

    expect(stats.total_properties).toBe(0);
    expect(stats.countries_with_results).toBe(0);
    expect(stats.most_common_type).toBe('unknown');
    expect(stats.most_common_transaction).toBe('unknown');
  });
});
