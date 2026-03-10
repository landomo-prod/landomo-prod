/**
 * Unit tests for bulk-operations.ts
 *
 * Tests the core UPSERT logic, terminal status protection, price history,
 * change detection, ingestion logging, and country-specific field extraction.
 */

import { Pool } from 'pg';
import { IngestionPayload } from '@landomo/core';

// Mock staleness-operations before importing bulk-operations
jest.mock('../staleness-operations', () => ({
  openInitialStatusPeriod: jest.fn().mockResolvedValue(undefined),
  reactivateProperty: jest.fn().mockResolvedValue(undefined),
}));

import { bulkInsertOrUpdateProperties, BulkInsertResult } from '../bulk-operations';
import { openInitialStatusPeriod, reactivateProperty } from '../staleness-operations';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Default data used by makePayload. */
const DEFAULT_DATA = {
  title: 'Test Property',
  price: 100000,
  currency: 'CZK',
  property_type: 'apartment',
  transaction_type: 'sale' as const,
  location: {
    address: '123 Test St',
    city: 'Prague',
    region: 'Prague',
    country: 'Czech Republic',
    postal_code: '11000',
    coordinates: { lat: 50.08, lon: 14.42 },
  },
  details: {
    bedrooms: 2,
    bathrooms: 1,
    sqm: 65,
    floor: 3,
    rooms: 3,
    year_built: 2005,
  },
  images: ['https://example.com/img1.jpg'],
  videos: [] as string[],
  features: ['balcony', 'parking'],
  description: 'A nice apartment',
  description_language: 'cs',
  agent: {
    name: 'Jan Novak',
    phone: '+420123456789',
    email: 'jan@example.com',
    agency: 'RealCzech',
    agency_logo: 'https://example.com/logo.png',
  },
  amenities: {
    has_parking: true,
    has_garden: false,
    has_balcony: true,
    has_terrace: false,
    has_pool: false,
    has_elevator: true,
    has_garage: false,
    has_basement: false,
    has_fireplace: false,
    is_furnished: false,
    is_new_construction: false,
    is_luxury: false,
  },
  energy_rating: 'B',
  price_per_sqm: 1538,
  hoa_fees: 3000,
  property_tax: 500,
  country_specific: {} as Record<string, any>,
};

/**
 * Build a minimal valid IngestionPayload for testing.
 * `dataOverrides` are shallow-merged into the default data object.
 */
function makePayload(
  overrides: { portal?: string; portal_id?: string; country?: string; raw_data?: any; data?: Record<string, any> } = {}
): IngestionPayload {
  const { data: dataOverrides, ...topOverrides } = overrides;
  const mergedData = { ...DEFAULT_DATA, ...dataOverrides };
  return {
    portal: 'test-portal',
    portal_id: 'listing-1',
    country: 'czech',
    raw_data: { original: true },
    ...topOverrides,
    data: mergedData,
  } as IngestionPayload;
}

/**
 * Create a mock Pool where pool.query resolves based on the SQL being run.
 * `queryHandler` receives (sql, params) and returns { rows }.
 */
function createMockPool(queryHandler: (sql: string, params?: any[]) => { rows: any[] }): Pool {
  const mockQuery = jest.fn().mockImplementation((sql: string, params?: any[]) => {
    return Promise.resolve(queryHandler(sql, params));
  });
  return { query: mockQuery } as unknown as Pool;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('bulkInsertOrUpdateProperties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Empty input ──────────────────────────────────────────────────────

  test('returns zeros for empty properties array', async () => {
    const pool = createMockPool(() => ({ rows: [] }));
    const result = await bulkInsertOrUpdateProperties(pool, []);

    expect(result).toEqual({ inserted: 0, updated: 0, duration: 0 });
    expect((pool.query as jest.Mock).mock.calls.length).toBe(0);
  });

  // ── New property insertion ───────────────────────────────────────────

  test('inserts a new property correctly', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      // Step 1: SELECT existing
      if (sql.includes('SELECT id, portal, portal_id')) {
        return { rows: [] };
      }
      // Step 2: INSERT ... RETURNING
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-new-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      // Step 3: ingestion_log
      if (sql.includes('INSERT INTO ingestion_log')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('calls openInitialStatusPeriod for newly inserted properties', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-new-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(openInitialStatusPeriod).toHaveBeenCalledWith(pool, 'uuid-new-1');
  });

  // ── Existing property update ─────────────────────────────────────────

  test('updates an existing property (not inserted)', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
  });

  test('does not call openInitialStatusPeriod for updated properties', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(openInitialStatusPeriod).not.toHaveBeenCalled();
  });

  // ── Terminal status protection ───────────────────────────────────────

  test('ON CONFLICT SQL preserves sold/rented status (verified via SQL shape)', async () => {
    const payload = makePayload();
    let insertSql = '';
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        insertSql = sql;
        return {
          rows: [{
            id: 'uuid-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // The CASE expression preserves terminal statuses
    expect(insertSql).toContain("WHEN properties.status IN ('sold', 'rented') THEN properties.status");
    expect(insertSql).toContain("ELSE 'active'");
  });

  // ── Price history ────────────────────────────────────────────────────

  test('records price history when price changes on an existing property', async () => {
    const payload = makePayload({ data: { price: 120000, currency: 'CZK' } });
    let priceHistoryInserted = false;
    let priceHistoryParams: unknown[] = [];

    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      if (sql.includes('INSERT INTO price_history')) {
        priceHistoryInserted = true;
        priceHistoryParams = params || [];
        return { rows: [] };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(priceHistoryInserted).toBe(true);
    // Params: propertyId, price, currency
    expect(priceHistoryParams).toContain('uuid-existing');
    expect(priceHistoryParams).toContain(120000);
    expect(priceHistoryParams).toContain('CZK');
  });

  test('does not record price history when price is unchanged', async () => {
    const payload = makePayload({ data: { price: 100000 } });
    let priceHistoryInserted = false;

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      if (sql.includes('INSERT INTO price_history')) {
        priceHistoryInserted = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(priceHistoryInserted).toBe(false);
  });

  test('does not record price history for newly inserted properties', async () => {
    const payload = makePayload();
    let priceHistoryInserted = false;

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-new',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      if (sql.includes('INSERT INTO price_history')) {
        priceHistoryInserted = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(priceHistoryInserted).toBe(false);
  });

  // ── Property changes audit ───────────────────────────────────────────

  test('records property changes for updated (not inserted) properties', async () => {
    const payload = makePayload();
    let changesInserted = false;
    let changesParams: unknown[] = [];

    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      if (sql.includes('INSERT INTO property_changes')) {
        changesInserted = true;
        changesParams = params || [];
        return { rows: [] };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(changesInserted).toBe(true);
    expect(changesParams).toContain('uuid-existing');
    expect(changesParams).toContain('test-portal');
    expect(changesParams).toContain('listing-1');
  });

  test('does not record property changes for newly inserted properties', async () => {
    const payload = makePayload();
    let changesInserted = false;

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-new',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      if (sql.includes('INSERT INTO property_changes')) {
        changesInserted = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(changesInserted).toBe(false);
  });

  // ── Ingestion log ────────────────────────────────────────────────────

  test('writes ingestion log entry for every property', async () => {
    const payload = makePayload();
    let logInserted = false;
    let logParams: unknown[] = [];

    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      if (sql.includes('INSERT INTO ingestion_log')) {
        logInserted = true;
        logParams = params || [];
        return { rows: [] };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(logInserted).toBe(true);
    expect(logParams).toContain('test-portal');
    expect(logParams).toContain('listing-1');
    // raw_data should be JSON-stringified
    expect(logParams).toContain(JSON.stringify({ original: true }));
  });

  // ── Reactivation of removed properties ───────────────────────────────

  test('calls reactivateProperty when a removed property is re-ingested', async () => {
    const payload = makePayload();

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-removed',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'removed',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-removed',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(reactivateProperty).toHaveBeenCalledWith(
      pool,
      'uuid-removed',
      'test-portal',
      'listing-1'
    );
  });

  test('does not call reactivateProperty for active properties', async () => {
    const payload = makePayload();

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-active',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-active',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(reactivateProperty).not.toHaveBeenCalled();
  });

  // ── Country-specific fields: Czech ───────────────────────────────────

  test('extracts czech_disposition from country_specific', async () => {
    const payload = makePayload({
      data: {
        country_specific: {
          czech_disposition: '3+kk',
          czech_ownership: 'personal',
        },
      },
    });

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-cz',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // czech_disposition and czech_ownership should appear in params
    expect(insertParams).toContain('3+kk');
    expect(insertParams).toContain('personal');
  });

  // ── Country-specific fields: Austrian ────────────────────────────────

  test('extracts austrian fields from data top-level', async () => {
    const payload = makePayload({
      country: 'austria',
    });
    // Directly set Austrian fields on data (as the code reads them via `(prop.data as any)`)
    (payload.data as any).austrian_ownership = 'Eigentum';
    (payload.data as any).austrian_operating_costs = 250;
    (payload.data as any).austrian_heating_costs = 80;

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-at',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(insertParams).toContain('Eigentum');
    expect(insertParams).toContain(250);
    expect(insertParams).toContain(80);
  });

  // ── Country-specific fields: German ──────────────────────────────────

  test('extracts german fields from data top-level', async () => {
    const payload = makePayload({
      country: 'germany',
    });
    (payload.data as any).german_ownership = 'Eigentum';
    (payload.data as any).german_hausgeld = 350;
    (payload.data as any).german_courtage = '3.57%';
    (payload.data as any).german_kfw_standard = 'KfW 55';
    (payload.data as any).german_is_denkmalschutz = true;

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-de',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(insertParams).toContain('Eigentum');
    expect(insertParams).toContain(350);
    expect(insertParams).toContain('3.57%');
    expect(insertParams).toContain('KfW 55');
    expect(insertParams).toContain(true);
  });

  // ── Batch processing ─────────────────────────────────────────────────

  test('processes multiple properties in a single batch', async () => {
    const payload1 = makePayload({ portal_id: 'listing-1' });
    const payload2 = makePayload({ portal_id: 'listing-2', data: { title: 'Second Property', price: 200000 } });

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [
            { id: 'uuid-1', portal: 'test-portal', portal_id: 'listing-1', inserted: true },
            { id: 'uuid-2', portal: 'test-portal', portal_id: 'listing-2', inserted: true },
          ],
        };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload1, payload2]);

    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);
  });

  test('handles mixed inserts and updates in a batch', async () => {
    const payload1 = makePayload({ portal_id: 'listing-new' });
    const payload2 = makePayload({ portal_id: 'listing-existing', data: { price: 150000 } });

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-existing',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [
            { id: 'uuid-new', portal: 'test-portal', portal_id: 'listing-new', inserted: true },
            { id: 'uuid-existing', portal: 'test-portal', portal_id: 'listing-existing', inserted: false },
          ],
        };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload1, payload2]);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
  });

  // ── Error handling: lifecycle failures don't break batch ─────────────

  test('continues when openInitialStatusPeriod fails', async () => {
    (openInitialStatusPeriod as jest.Mock).mockRejectedValueOnce(new Error('DB timeout'));

    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    // Should still return a successful result
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
  });

  test('continues when reactivateProperty fails', async () => {
    (reactivateProperty as jest.Mock).mockRejectedValueOnce(new Error('DB timeout'));

    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-removed',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'removed',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-removed',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(result.updated).toBe(1);
  });

  test('continues when ingestion_log insert fails', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      if (sql.includes('INSERT INTO ingestion_log')) {
        throw new Error('Ingestion log table missing');
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(result.inserted).toBe(1);
  });

  test('continues when price_history insert fails', async () => {
    const payload = makePayload({ data: { price: 999999 } });
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      if (sql.includes('INSERT INTO price_history')) {
        throw new Error('price_history table locked');
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(result.updated).toBe(1);
  });

  test('continues when property_changes insert fails', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      if (sql.includes('INSERT INTO property_changes')) {
        throw new Error('property_changes write failed');
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(result.updated).toBe(1);
  });

  // ── Terminal status protection (behavioral) ────────────────────────────

  test('does not overwrite sold status when upserting with active', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-sold',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'sold',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        // The CASE clause in ON CONFLICT preserves 'sold', so the DB returns status unchanged
        return {
          rows: [{
            id: 'uuid-sold',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    // Should count as an update, not an insert
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);

    // reactivateProperty should NOT be called for sold properties
    expect(reactivateProperty).not.toHaveBeenCalled();
  });

  test('does not overwrite rented status when upserting with active', async () => {
    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-rented',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: 100000,
            status: 'rented',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-rented',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      return { rows: [] };
    });

    const result = await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(result.updated).toBe(1);
    expect(reactivateProperty).not.toHaveBeenCalled();
  });

  // ── Silent failure non-fatality and metric logging ─────────────────────

  test('main upsert succeeds even when status history call throws', async () => {
    // Make openInitialStatusPeriod throw
    (openInitialStatusPeriod as jest.Mock).mockRejectedValueOnce(new Error('status history exploded'));

    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-new-silent',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    // Should NOT throw
    const result = await bulkInsertOrUpdateProperties(pool, [payload]);
    expect(result.inserted).toBe(1);
  });

  test('silent failure on lifecycle operation logs warn with metric and operation fields', async () => {
    (openInitialStatusPeriod as jest.Mock).mockRejectedValueOnce(new Error('status history exploded'));

    // Spy on dbLog.warn
    const dbLogModule = require('../../logger');
    const warnSpy = jest.spyOn(dbLogModule.dbLog, 'warn');

    const payload = makePayload();
    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-metric-check',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // Find the warn call that has metric and operation
    const metricCall = warnSpy.mock.calls.find(
      (call) => call[0] && typeof call[0] === 'object' && 'metric' in call[0] && 'operation' in call[0]
    );
    expect(metricCall).toBeDefined();
    expect(metricCall![0]).toMatchObject({
      metric: expect.stringContaining('bulk_ops'),
      operation: 'openInitialStatusPeriod',
    });

    warnSpy.mockRestore();
  });

  // ── Null / missing optional fields ───────────────────────────────────

  test('handles missing optional fields gracefully', async () => {
    const payload: IngestionPayload = {
      portal: 'minimal-portal',
      portal_id: 'min-1',
      country: 'czech',
      data: {
        title: 'Minimal Listing',
        price: 50000,
        currency: 'CZK',
        property_type: 'apartment',
        transaction_type: 'sale',
        location: {
          city: 'Brno',
        },
        details: {},
      } as any,
      raw_data: {},
    };

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-min',
            portal: 'minimal-portal',
            portal_id: 'min-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    // Should not throw
    const result = await bulkInsertOrUpdateProperties(pool, [payload]);
    expect(result.inserted).toBe(1);
  });

  // ── Coordinates ──────────────────────────────────────────────────────

  test('stores lat/lon coordinates correctly', async () => {
    const payload = makePayload({
      data: {
        location: {
          city: 'Prague',
          country: 'Czech Republic',
          coordinates: { lat: 50.0755, lon: 14.4378 },
        },
      },
    });

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-coords',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(insertParams).toContain(50.0755);
    expect(insertParams).toContain(14.4378);
  });

  // ── Amenities booleans ───────────────────────────────────────────────

  test('stores amenity boolean flags correctly', async () => {
    const payload = makePayload({
      data: {
        amenities: {
          has_parking: true,
          has_garden: false,
          has_balcony: true,
          has_terrace: false,
          has_pool: true,
          has_elevator: false,
          has_garage: true,
          has_basement: false,
          has_fireplace: true,
          is_furnished: true,
          is_new_construction: false,
          is_luxury: true,
        },
      },
    });

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-amenities',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // The extractRowParams function places amenities in order:
    // has_parking, has_garden, has_balcony, has_terrace, has_pool, has_elevator,
    // has_garage, has_basement, has_fireplace, is_furnished, is_new_construction, is_luxury
    // We verify the params contain our expected values.
    // Indices 31-42 in the row are the 12 amenity flags (0-indexed: 31 = has_parking)
    const amenitySlice = insertParams.slice(31, 43);
    expect(amenitySlice).toEqual([
      true,  // has_parking
      false, // has_garden
      true,  // has_balcony
      false, // has_terrace
      true,  // has_pool
      false, // has_elevator
      true,  // has_garage
      false, // has_basement
      true,  // has_fireplace
      true,  // is_furnished
      false, // is_new_construction
      true,  // is_luxury
    ]);
  });

  // ── Portal metadata JSONB ────────────────────────────────────────────

  test('stores portal_metadata as JSONB', async () => {
    const portalMeta = { sreality: { premium: true, topListing: false } };
    const payload = makePayload();
    (payload.data as any).portal_metadata = portalMeta;

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-meta',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(insertParams).toContain(JSON.stringify(portalMeta));
  });

  // ── Source URL fallback ──────────────────────────────────────────────

  test('uses fallback source_url when not provided', async () => {
    const payload = makePayload({
      portal_id: 'abc-123',
      data: { source_url: undefined },
    });

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-fallback',
            portal: 'test-portal',
            portal_id: 'abc-123',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // source_url is param index 2 (0-based)
    expect(insertParams[2]).toBe('http://example.com/abc-123');
  });

  // ── SQL structure ────────────────────────────────────────────────────

  test('INSERT SQL uses UNNEST for bulk SELECT and multi-row VALUES', async () => {
    const payload = makePayload();
    const queries: string[] = [];

    const pool = createMockPool((sql: string) => {
      queries.push(sql.trim());
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // First query: bulk SELECT with UNNEST
    expect(queries[0]).toContain('UNNEST');
    // Second query: INSERT ... ON CONFLICT ... RETURNING
    expect(queries[1]).toContain('ON CONFLICT (portal, portal_id)');
    expect(queries[1]).toContain('RETURNING id, portal, portal_id');
    expect(queries[1]).toContain('(xmax = 0) AS inserted');
  });

  test('generates correct number of placeholders per row', async () => {
    const payload = makePayload();
    let insertSql = '';

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        insertSql = sql;
        return {
          rows: [{
            id: 'uuid-1',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // Single row should have $1 through $77
    expect(insertSql).toContain('$1');
    expect(insertSql).toContain('$77');
    expect(insertSql).not.toContain('$78');
  });

  test('two rows generate $1-$77 and $78-$154 placeholders', async () => {
    const p1 = makePayload({ portal_id: 'a' });
    const p2 = makePayload({ portal_id: 'b' });
    let insertSql = '';

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties')) {
        insertSql = sql;
        return {
          rows: [
            { id: 'uuid-a', portal: 'test-portal', portal_id: 'a', inserted: true },
            { id: 'uuid-b', portal: 'test-portal', portal_id: 'b', inserted: true },
          ],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [p1, p2]);

    expect(insertSql).toContain('$78');
    expect(insertSql).toContain('$154');
    expect(insertSql).not.toContain('$155');
  });

  // ── Price comparison uses string coercion ────────────────────────────

  test('price comparison uses String() so numeric 100000 matches string "100000"', async () => {
    // Old price in DB is numeric, new price is also numeric but same value
    const payload = makePayload({ data: { price: 100000 } });
    let priceHistoryInserted = false;

    const pool = createMockPool((sql: string) => {
      if (sql.includes('SELECT id, portal, portal_id')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            price: '100000', // DB returns price as string
            status: 'active',
          }],
        };
      }
      if (sql.includes('INSERT INTO properties')) {
        return {
          rows: [{
            id: 'uuid-existing',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: false,
          }],
        };
      }
      if (sql.includes('INSERT INTO price_history')) {
        priceHistoryInserted = true;
        return { rows: [] };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // String('100000') === String(100000) => no price history entry
    expect(priceHistoryInserted).toBe(false);
  });

  // ── Images / features are JSON-stringified ───────────────────────────

  test('images, videos, and features are JSON-stringified in params', async () => {
    const payload = makePayload({
      data: {
        images: ['img1.jpg', 'img2.jpg'],
        videos: ['vid1.mp4'],
        features: ['pool', 'gym'],
      },
    });

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-media',
            portal: 'test-portal',
            portal_id: 'listing-1',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    expect(insertParams).toContain(JSON.stringify(['img1.jpg', 'img2.jpg']));
    expect(insertParams).toContain(JSON.stringify(['vid1.mp4']));
    expect(insertParams).toContain(JSON.stringify(['pool', 'gym']));
  });

  // ── Default amenities to false ───────────────────────────────────────

  test('defaults amenities to false when undefined', async () => {
    const payload: IngestionPayload = {
      portal: 'test-portal',
      portal_id: 'no-amenities',
      country: 'czech',
      data: {
        title: 'No Amenities',
        price: 50000,
        currency: 'CZK',
        property_type: 'apartment',
        transaction_type: 'sale',
        location: { city: 'Prague' },
        details: {},
      } as any,
      raw_data: {},
    };

    let insertParams: unknown[] = [];
    const pool = createMockPool((sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, portal, portal_id')) return { rows: [] };
      if (sql.includes('INSERT INTO properties') && sql.includes('RETURNING')) {
        insertParams = params || [];
        return {
          rows: [{
            id: 'uuid-no-am',
            portal: 'test-portal',
            portal_id: 'no-amenities',
            inserted: true,
          }],
        };
      }
      return { rows: [] };
    });

    await bulkInsertOrUpdateProperties(pool, [payload]);

    // Amenity params (indices 31-42) should all be false
    const amenitySlice = insertParams.slice(31, 43);
    expect(amenitySlice).toEqual([
      false, false, false, false, false, false,
      false, false, false, false, false, false,
    ]);
  });
});
