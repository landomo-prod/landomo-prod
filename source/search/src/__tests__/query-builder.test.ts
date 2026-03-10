/**
 * Query Builder Tests
 *
 * Tests for SQL query construction from search requests.
 */

import { QueryBuilder, buildSearchQuery, buildCountQuery } from '../database/query-builder';
import { SearchRequest } from '../types/search';

describe('QueryBuilder', () => {
  describe('constructor', () => {
    it('initializes with default select fields', () => {
      const qb = new QueryBuilder();
      expect(qb.selectFields).toContain('id');
      expect(qb.selectFields).toContain('title');
      expect(qb.selectFields).toContain('price');
      expect(qb.selectFields).toContain('property_type');
      expect(qb.selectFields).toContain('city');
      expect(qb.selectFields).toContain('latitude');
      expect(qb.selectFields).toContain('longitude');
    });

    it('includes country-specific fields in default select', () => {
      const qb = new QueryBuilder();
      expect(qb.selectFields).toContain('czech_disposition');
      expect(qb.selectFields).toContain('uk_tenure');
      expect(qb.selectFields).toContain('usa_mls_number');
      expect(qb.selectFields).toContain('australia_land_size');
    });

    it('includes amenity fields in default select', () => {
      const qb = new QueryBuilder();
      expect(qb.selectFields).toContain('has_parking');
      expect(qb.selectFields).toContain('has_garden');
      expect(qb.selectFields).toContain('has_pool');
      expect(qb.selectFields).toContain('has_balcony');
      expect(qb.selectFields).toContain('has_terrace');
      expect(qb.selectFields).toContain('has_elevator');
      expect(qb.selectFields).toContain('has_garage');
    });

    it('always includes active status filter', () => {
      const qb = new QueryBuilder();
      expect(qb.whereClauses).toContain("status = 'active'");
    });

    it('starts with paramIndex 1', () => {
      const qb = new QueryBuilder();
      expect(qb.paramIndex).toBe(1);
    });
  });

  describe('addWhere', () => {
    it('adds a WHERE clause with params', () => {
      const qb = new QueryBuilder();
      qb.addWhere('price > $1', 100000);

      expect(qb.whereClauses).toContain('price > $1');
      expect(qb.params).toContain(100000);
    });

    it('supports chaining', () => {
      const qb = new QueryBuilder();
      const result = qb.addWhere('price > $1', 100000).addWhere('bedrooms >= $2', 2);

      expect(result).toBe(qb);
      expect(qb.whereClauses).toHaveLength(4); // 2 default + 2 added
    });
  });

  describe('addSelect', () => {
    it('adds a new select field', () => {
      const qb = new QueryBuilder();
      qb.addSelect('custom_field');
      expect(qb.selectFields).toContain('custom_field');
    });

    it('does not add duplicate select fields', () => {
      const qb = new QueryBuilder();
      const originalLength = qb.selectFields.length;
      qb.addSelect('id'); // already present
      expect(qb.selectFields.length).toBe(originalLength);
    });

    it('supports chaining', () => {
      const qb = new QueryBuilder();
      const result = qb.addSelect('field_a');
      expect(result).toBe(qb);
    });
  });

  describe('clone', () => {
    it('creates an independent copy', () => {
      const qb = new QueryBuilder();
      qb.addWhere('price > $1', 50000);

      const cloned = qb.clone();
      cloned.addWhere('bedrooms = $2', 3);

      // Original should not have the cloned clause
      expect(qb.whereClauses).not.toContain('bedrooms = $2');
      expect(cloned.whereClauses).toContain('bedrooms = $2');
    });

    it('copies params independently', () => {
      const qb = new QueryBuilder();
      qb.params.push('original');

      const cloned = qb.clone();
      cloned.params.push('cloned');

      expect(qb.params).not.toContain('cloned');
    });

    it('copies selectFields independently', () => {
      const qb = new QueryBuilder();
      const cloned = qb.clone();
      cloned.addSelect('new_field');

      expect(qb.selectFields).not.toContain('new_field');
    });
  });

  describe('build', () => {
    it('generates valid SQL with no filters (only default active status)', () => {
      const qb = new QueryBuilder();
      const { sql, params } = qb.build();

      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM properties');
      expect(sql).toContain("WHERE status = 'active'");
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(sql).toContain('LIMIT 20');
      expect(sql).toContain('OFFSET 0');
      expect(params).toEqual([]);
    });

    it('uses default sort when no sort provided', () => {
      const qb = new QueryBuilder();
      const { sql } = qb.build();
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('applies custom sort', () => {
      const qb = new QueryBuilder();
      const { sql } = qb.build({ field: 'price', order: 'asc' });
      expect(sql).toContain('ORDER BY price ASC');
    });

    it('applies custom limit and offset', () => {
      const qb = new QueryBuilder();
      const { sql } = qb.build(undefined, 50, 100);
      expect(sql).toContain('LIMIT 50');
      expect(sql).toContain('OFFSET 100');
    });

    it('sanitizes sort field to prevent SQL injection', () => {
      const qb = new QueryBuilder();
      const { sql } = qb.build({ field: 'DROP TABLE properties;--', order: 'asc' });
      // Should fallback to created_at
      expect(sql).toContain('ORDER BY created_at ASC');
      expect(sql).not.toContain('DROP TABLE');
    });

    it('allows whitelisted sort fields', () => {
      const allowedFields = ['price', 'created_at', 'updated_at', 'sqm', 'bedrooms', 'bathrooms', 'city'];
      for (const field of allowedFields) {
        const qb = new QueryBuilder();
        const { sql } = qb.build({ field, order: 'desc' });
        expect(sql).toContain(`ORDER BY ${field} DESC`);
      }
    });

    it('allows country-specific whitelisted sort fields', () => {
      const countryFields = ['uk_council_tax_band', 'uk_epc_rating', 'uk_leasehold_years_remaining', 'usa_hoa_fee', 'australia_land_size'];
      for (const field of countryFields) {
        const qb = new QueryBuilder();
        const { sql } = qb.build({ field, order: 'asc' });
        expect(sql).toContain(`ORDER BY ${field} ASC`);
      }
    });

    it('joins multiple WHERE clauses with AND', () => {
      const qb = new QueryBuilder();
      qb.whereClauses.push('price > $1');
      qb.whereClauses.push('bedrooms >= $2');
      const { sql } = qb.build();
      expect(sql).toContain("AND price > $1 AND bedrooms >= $2");
    });
  });
});

describe('buildSearchQuery', () => {
  function makeRequest(filters: Record<string, any>): SearchRequest {
    return { filters };
  }

  it('returns a QueryBuilder with default active status filter', () => {
    const qb = buildSearchQuery(makeRequest({}));
    expect(qb.whereClauses).toContain("status = 'active'");
  });

  describe('property type filter', () => {
    it('adds property_type filter', () => {
      const qb = buildSearchQuery(makeRequest({ property_type: 'apartment' }));
      expect(qb.whereClauses).toContain('property_type = $1');
      expect(qb.params).toContain('apartment');
    });
  });

  describe('transaction type filter', () => {
    it('adds transaction_type filter', () => {
      const qb = buildSearchQuery(makeRequest({ transaction_type: 'sale' }));
      expect(qb.whereClauses).toContain('transaction_type = $1');
      expect(qb.params).toContain('sale');
    });
  });

  describe('location filters', () => {
    it('adds city filter', () => {
      const qb = buildSearchQuery(makeRequest({ city: 'Prague' }));
      expect(qb.whereClauses).toContain('city = $1');
      expect(qb.params).toContain('Prague');
    });

    it('adds region filter', () => {
      const qb = buildSearchQuery(makeRequest({ region: 'Moravia' }));
      expect(qb.whereClauses).toContain('region = $1');
      expect(qb.params).toContain('Moravia');
    });

    it('adds country filter', () => {
      const qb = buildSearchQuery(makeRequest({ country: 'Czech Republic' }));
      expect(qb.whereClauses).toContain('country = $1');
      expect(qb.params).toContain('Czech Republic');
    });
  });

  describe('price range filters', () => {
    it('adds price_min filter', () => {
      const qb = buildSearchQuery(makeRequest({ price_min: 100000 }));
      expect(qb.whereClauses).toContain('price >= $1');
      expect(qb.params).toContain(100000);
    });

    it('adds price_max filter', () => {
      const qb = buildSearchQuery(makeRequest({ price_max: 500000 }));
      expect(qb.whereClauses).toContain('price <= $1');
      expect(qb.params).toContain(500000);
    });

    it('adds both price_min and price_max', () => {
      const qb = buildSearchQuery(makeRequest({ price_min: 100000, price_max: 500000 }));
      expect(qb.whereClauses).toContain('price >= $1');
      expect(qb.whereClauses).toContain('price <= $2');
      expect(qb.params).toEqual([100000, 500000]);
    });

    it('handles price_min of 0', () => {
      const qb = buildSearchQuery(makeRequest({ price_min: 0 }));
      expect(qb.whereClauses).toContain('price >= $1');
      expect(qb.params).toContain(0);
    });
  });

  describe('bedroom filters', () => {
    it('adds exact bedrooms filter', () => {
      const qb = buildSearchQuery(makeRequest({ bedrooms: 3 }));
      expect(qb.whereClauses).toContain('bedrooms = $1');
      expect(qb.params).toContain(3);
    });

    it('adds bedrooms_min filter', () => {
      const qb = buildSearchQuery(makeRequest({ bedrooms_min: 2 }));
      expect(qb.whereClauses).toContain('bedrooms >= $1');
      expect(qb.params).toContain(2);
    });

    it('adds bedrooms_max filter', () => {
      const qb = buildSearchQuery(makeRequest({ bedrooms_max: 4 }));
      expect(qb.whereClauses).toContain('bedrooms <= $1');
      expect(qb.params).toContain(4);
    });

    it('handles bedrooms of 0', () => {
      const qb = buildSearchQuery(makeRequest({ bedrooms: 0 }));
      expect(qb.whereClauses).toContain('bedrooms = $1');
      expect(qb.params).toContain(0);
    });
  });

  describe('bathroom filter', () => {
    it('adds bathrooms_min filter', () => {
      const qb = buildSearchQuery(makeRequest({ bathrooms_min: 2 }));
      expect(qb.whereClauses).toContain('bathrooms >= $1');
      expect(qb.params).toContain(2);
    });
  });

  describe('sqm filters', () => {
    it('adds sqm_min filter', () => {
      const qb = buildSearchQuery(makeRequest({ sqm_min: 50 }));
      expect(qb.whereClauses).toContain('sqm >= $1');
      expect(qb.params).toContain(50);
    });

    it('adds sqm_max filter', () => {
      const qb = buildSearchQuery(makeRequest({ sqm_max: 200 }));
      expect(qb.whereClauses).toContain('sqm <= $1');
      expect(qb.params).toContain(200);
    });
  });

  describe('amenity filters', () => {
    it('adds has_parking filter', () => {
      const qb = buildSearchQuery(makeRequest({ has_parking: true }));
      expect(qb.whereClauses).toContain('has_parking = $1');
      expect(qb.params).toContain(true);
    });

    it('adds has_garden filter', () => {
      const qb = buildSearchQuery(makeRequest({ has_garden: true }));
      expect(qb.whereClauses).toContain('has_garden = $1');
    });

    it('adds has_pool filter', () => {
      const qb = buildSearchQuery(makeRequest({ has_pool: false }));
      expect(qb.whereClauses).toContain('has_pool = $1');
      expect(qb.params).toContain(false);
    });

    it('adds has_balcony filter', () => {
      const qb = buildSearchQuery(makeRequest({ has_balcony: true }));
      expect(qb.whereClauses).toContain('has_balcony = $1');
    });

    it('adds has_terrace filter', () => {
      const qb = buildSearchQuery(makeRequest({ has_terrace: true }));
      expect(qb.whereClauses).toContain('has_terrace = $1');
    });

    it('adds has_elevator filter', () => {
      const qb = buildSearchQuery(makeRequest({ has_elevator: true }));
      expect(qb.whereClauses).toContain('has_elevator = $1');
    });

    it('adds has_garage filter', () => {
      const qb = buildSearchQuery(makeRequest({ has_garage: true }));
      expect(qb.whereClauses).toContain('has_garage = $1');
    });
  });

  describe('portal filter', () => {
    it('adds portal filter', () => {
      const qb = buildSearchQuery(makeRequest({ portal: 'sreality' }));
      expect(qb.whereClauses).toContain('portal = $1');
      expect(qb.params).toContain('sreality');
    });
  });

  describe('portal features filter', () => {
    it('adds portal_features @> filter for array', () => {
      const features = ['3d_tour', 'video'];
      const qb = buildSearchQuery(makeRequest({ portal_features: features }));
      expect(qb.whereClauses).toContain('portal_features @> $1');
      expect(qb.params[0]).toEqual(features);
    });

    it('does not add portal_features filter for empty array', () => {
      const qb = buildSearchQuery(makeRequest({ portal_features: [] }));
      const hasFeatureClause = qb.whereClauses.some(c => c.includes('portal_features'));
      expect(hasFeatureClause).toBe(false);
    });
  });

  describe('full-text search', () => {
    it('adds ILIKE filter on title and description', () => {
      const qb = buildSearchQuery(makeRequest({ search_query: 'luxury' }));
      const searchClause = qb.whereClauses.find(c => c.includes('ILIKE'));
      expect(searchClause).toBeDefined();
      expect(searchClause).toContain('title ILIKE');
      expect(searchClause).toContain('description ILIKE');
      expect(qb.params).toContain('%luxury%');
    });
  });

  describe('combined filters', () => {
    it('handles multiple filters with correct param indexing', () => {
      const qb = buildSearchQuery(makeRequest({
        property_type: 'apartment',
        city: 'Prague',
        price_min: 100000,
        price_max: 500000,
        bedrooms_min: 2,
        has_parking: true,
      }));

      expect(qb.whereClauses).toContain('property_type = $1');
      expect(qb.whereClauses).toContain('city = $2');
      expect(qb.whereClauses).toContain('price >= $3');
      expect(qb.whereClauses).toContain('price <= $4');
      expect(qb.whereClauses).toContain('bedrooms >= $5');
      expect(qb.whereClauses).toContain('has_parking = $6');
      expect(qb.params).toEqual(['apartment', 'Prague', 100000, 500000, 2, true]);
    });
  });
});

describe('buildCountQuery', () => {
  it('builds a COUNT query from a QueryBuilder', () => {
    const qb = new QueryBuilder();
    const { sql, params } = buildCountQuery(qb);

    expect(sql).toContain('SELECT COUNT(*) as total');
    expect(sql).toContain('FROM properties');
    expect(sql).toContain("WHERE status = 'active'");
    expect(params).toEqual([]);
  });

  it('preserves WHERE clauses from the query builder', () => {
    const searchQb = buildSearchQuery({
      filters: { property_type: 'house', price_min: 200000 }
    });

    const { sql, params } = buildCountQuery(searchQb);

    expect(sql).toContain('property_type = $1');
    expect(sql).toContain('price >= $2');
    expect(params).toEqual(['house', 200000]);
  });

  it('handles empty WHERE clauses if all removed', () => {
    const qb = new QueryBuilder();
    qb.whereClauses = [];
    const { sql } = buildCountQuery(qb);

    expect(sql).not.toContain('WHERE');
    expect(sql).toContain('SELECT COUNT(*) as total FROM properties');
  });
});
