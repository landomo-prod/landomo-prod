/**
 * Query Builder
 *
 * Builds optimized SQL queries for property search with proper indexing.
 */

import { SearchRequest, SearchSort } from '../types/search';
import { QueryBuilder as IQueryBuilder } from '../countries/base/CountryModule';

export class QueryBuilder implements IQueryBuilder {
  sql: string = '';
  params: any[] = [];
  paramIndex: number = 1;
  whereClauses: string[] = [];
  selectFields: string[] = [];

  constructor() {
    // Initialize with default select fields
    this.selectFields = [
      'id',
      'portal',
      'portal_id',
      'title',
      'price',
      'currency',
      'property_type',
      'transaction_type',
      'city',
      'region',
      'country',
      'district',
      'neighbourhood',
      'municipality',
      'bedrooms',
      'bathrooms',
      'COALESCE(apt_sqm, house_sqm_living, comm_floor_area, land_area_plot_sqm) AS sqm',
      'COALESCE(apt_floor, comm_floor_number) AS floor',
      'latitude',
      'longitude',
      'images',
      'description',
      'created_at',
      'updated_at',
      'status',
      // Category & universal fields
      'property_category',
      'condition',
      'COALESCE(apt_energy_class, house_energy_class, comm_energy_class) AS energy_class',
      'heating_type',
      'furnished',
      'construction_type',
      'renovation_year',
      'available_from',
      'deposit',
      'is_commission',
      'commission_note',
      'parking_spaces',
      'price_per_sqm',
      'source_url',
      'source_platform',
      // Country-specific fields
      'czech_disposition',
      'czech_ownership',
      'uk_tenure',
      'uk_council_tax_band',
      'uk_epc_rating',
      'uk_leasehold_years_remaining',
      'usa_mls_number',
      'australia_land_size_sqm',
      // Portal metadata
      'portal_metadata',
      'portal_features',
      // Amenities (COALESCE universal + category-specific columns)
      'COALESCE(has_parking, apt_has_parking, house_has_parking, comm_has_parking) AS has_parking',
      'COALESCE(has_garden, house_has_garden) AS has_garden',
      'has_pool',
      'COALESCE(has_balcony, apt_has_balcony, house_has_balcony) AS has_balcony',
      'COALESCE(has_terrace, apt_has_terrace, house_has_terrace) AS has_terrace',
      'COALESCE(has_elevator, apt_has_elevator, comm_has_elevator) AS has_elevator',
      'COALESCE(has_garage, apt_has_garage, house_has_garage) AS has_garage',
      'COALESCE(has_basement, apt_has_basement, house_has_basement) AS has_basement',
      'year_built',
      // Agent info
      'agent_name',
      'agent_phone',
      'agent_email'
    ];

    // Always filter active properties
    this.whereClauses.push("status = 'active'");

    // Exclude duplicates: only show canonical properties (not linked as duplicates)
    this.whereClauses.push("(canonical_property_id IS NULL OR id = canonical_property_id)");
  }

  addWhere(clause: string, ...params: any[]): QueryBuilder {
    this.whereClauses.push(clause);
    this.params.push(...params);
    return this;
  }

  addSelect(field: string): QueryBuilder {
    if (!this.selectFields.includes(field)) {
      this.selectFields.push(field);
    }
    return this;
  }

  clone(): QueryBuilder {
    const cloned = new QueryBuilder();
    cloned.sql = this.sql;
    cloned.params = [...this.params];
    cloned.paramIndex = this.paramIndex;
    cloned.whereClauses = [...this.whereClauses];
    cloned.selectFields = [...this.selectFields];
    return cloned;
  }

  build(sort?: SearchSort, limit: number = 20, offset: number = 0): { sql: string; params: any[] } {
    const selectClause = this.selectFields.join(', ');
    const whereClause = this.whereClauses.length > 0
      ? `WHERE ${this.whereClauses.join(' AND ')}`
      : '';

    const orderBy = sort
      ? `ORDER BY ${this.sanitizeSortField(sort.field)} ${sort.order.toUpperCase()}`
      : 'ORDER BY created_at DESC';

    // Data-only query — no COUNT(*) OVER() to avoid full-table scan.
    // COUNT is fetched separately via buildCount() and run in parallel.
    this.sql = `
      SELECT ${selectClause}
      FROM properties
      ${whereClause}
      ${orderBy}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return {
      sql: this.sql,
      params: this.params
    };
  }

  buildCount(cap: number = 10000): { sql: string; params: any[] } {
    const whereClause = this.whereClauses.length > 0
      ? `WHERE ${this.whereClauses.join(' AND ')}`
      : '';
    // Capped count: scans at most `cap` rows, making broad queries fast.
    // Returns exact count for small result sets, capped count for large ones.
    return {
      sql: `SELECT COUNT(*) AS _total_count FROM (SELECT 1 FROM properties ${whereClause} LIMIT ${cap}) AS _subq`,
      params: this.params
    };
  }

  private sanitizeSortField(field: string): string {
    // Whitelist of allowed sort fields — some map to COALESCE expressions
    // because data lives in category-prefixed columns, not universal ones.
    const fieldMap: Record<string, string> = {
      'price': 'price',
      'created_at': 'created_at',
      'updated_at': 'updated_at',
      'sqm': 'COALESCE(apt_sqm, house_sqm_living, comm_floor_area, land_area_plot_sqm)',
      'bedrooms': 'bedrooms',
      'bathrooms': 'bathrooms',
      'city': 'city',
      'uk_council_tax_band': 'uk_council_tax_band',
      'uk_epc_rating': 'uk_epc_rating',
      'uk_leasehold_years_remaining': 'uk_leasehold_years_remaining',
      'usa_hoa_fees_monthly': 'usa_hoa_fees_monthly',
      'australia_land_size_sqm': 'australia_land_size_sqm',
      'floor': 'COALESCE(apt_floor, comm_floor_number)',
    };

    return fieldMap[field] || 'created_at';
  }
}

/**
 * Build search query from request
 */
export function buildSearchQuery(request: SearchRequest): QueryBuilder {
  const query = new QueryBuilder();
  const filters = request.filters;

  // Category filter (partition pruning)
  if (filters.property_category) {
    query.whereClauses.push(`property_category = $${query.paramIndex++}`);
    query.params.push(filters.property_category);
  }

  // Global filters (use indexed columns)
  if (filters.property_type) {
    query.whereClauses.push(`property_type = $${query.paramIndex++}`);
    query.params.push(filters.property_type);
  }

  if (filters.transaction_type) {
    query.whereClauses.push(`transaction_type = $${query.paramIndex++}`);
    query.params.push(filters.transaction_type);
  }

  if (filters.city) {
    query.whereClauses.push(`city = $${query.paramIndex++}`);
    query.params.push(filters.city);
  }

  if (filters.region) {
    query.whereClauses.push(`region = $${query.paramIndex++}`);
    query.params.push(filters.region);
  }

  if (filters.country) {
    query.whereClauses.push(`country = $${query.paramIndex++}`);
    query.params.push(filters.country);
  }

  // Price filters
  if (filters.price_min !== undefined) {
    query.whereClauses.push(`price >= $${query.paramIndex++}`);
    query.params.push(filters.price_min);
  }

  if (filters.price_max !== undefined) {
    query.whereClauses.push(`price <= $${query.paramIndex++}`);
    query.params.push(filters.price_max);
  }

  // Bedroom filters — data lives in category-prefixed columns (generic bedrooms column is empty)
  if (filters.bedrooms !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_bedrooms = ${val} OR house_bedrooms = ${val})`);
    query.params.push(filters.bedrooms);
  }

  if (filters.bedrooms_min !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_bedrooms >= ${val} OR house_bedrooms >= ${val})`);
    query.params.push(filters.bedrooms_min);
  }

  if (filters.bedrooms_max !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_bedrooms <= ${val} OR house_bedrooms <= ${val})`);
    query.params.push(filters.bedrooms_max);
  }

  // Bathroom filter — data lives in category-prefixed columns
  if (filters.bathrooms_min !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_bathrooms >= ${val} OR house_bathrooms >= ${val})`);
    query.params.push(filters.bathrooms_min);
  }

  // Square meter filters — data lives in category-prefixed columns
  if (filters.sqm_min !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_sqm >= ${val} OR house_sqm_living >= ${val} OR house_sqm_total >= ${val})`);
    query.params.push(filters.sqm_min);
  }

  if (filters.sqm_max !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_sqm <= ${val} OR house_sqm_living <= ${val} OR house_sqm_total <= ${val})`);
    query.params.push(filters.sqm_max);
  }

  // Amenity filters — OR across category-prefixed columns since data is in apt_*/house_*/comm_*
  // The generic has_* columns exist but are never populated; real data is in apt_has_*, house_has_*, etc.
  if (filters.has_parking !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_has_parking = ${val} OR house_has_parking = ${val} OR comm_has_parking = ${val})`);
    query.params.push(filters.has_parking);
  }

  if (filters.has_garden !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(house_has_garden = ${val})`);
    query.params.push(filters.has_garden);
  }

  if (filters.has_pool !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`has_pool = ${val}`);
    query.params.push(filters.has_pool);
  }

  if (filters.has_balcony !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_has_balcony = ${val} OR house_has_balcony = ${val})`);
    query.params.push(filters.has_balcony);
  }

  if (filters.has_terrace !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_has_terrace = ${val} OR house_has_terrace = ${val})`);
    query.params.push(filters.has_terrace);
  }

  if (filters.has_elevator !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_has_elevator = ${val} OR comm_has_elevator = ${val})`);
    query.params.push(filters.has_elevator);
  }

  if (filters.has_garage !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_has_garage = ${val} OR house_has_garage = ${val})`);
    query.params.push(filters.has_garage);
  }

  // Portal filter
  if (filters.portal) {
    query.whereClauses.push(`portal = $${query.paramIndex++}`);
    query.params.push(filters.portal);
  }

  // Portal features (uses GIN index)
  if (filters.portal_features && filters.portal_features.length > 0) {
    query.whereClauses.push(`portal_features @> $${query.paramIndex++}`);
    query.params.push(filters.portal_features);
  }

  // District filter
  if (filters.district) {
    query.whereClauses.push(`district = $${query.paramIndex++}`);
    query.params.push(filters.district);
  }

  // Neighbourhood filter
  if (filters.neighbourhood) {
    query.whereClauses.push(`neighbourhood = $${query.paramIndex++}`);
    query.params.push(filters.neighbourhood);
  }

  // Municipality filter
  if (filters.municipality) {
    query.whereClauses.push(`municipality = $${query.paramIndex++}`);
    query.params.push(filters.municipality);
  }

  // Boundary polygon filter (geometry resolved before query building)
  if (filters._boundary_geojson) {
    query.whereClauses.push(`ST_Contains(ST_GeomFromGeoJSON($${query.paramIndex++}), geom_point)`);
    query.params.push(filters._boundary_geojson);
  }

  // Energy class filter — supports comma-separated multi-select (e.g. "A,B,C")
  if (filters.energy_class) {
    const classes = String(filters.energy_class).split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (classes.length === 1) {
      const val = `$${query.paramIndex++}`;
      query.whereClauses.push(`(UPPER(apt_energy_class) = ${val} OR UPPER(house_energy_class) = ${val} OR UPPER(comm_energy_class) = ${val})`);
      query.params.push(classes[0]);
    } else if (classes.length > 1) {
      const val = `$${query.paramIndex++}::text[]`;
      query.whereClauses.push(`(UPPER(apt_energy_class) = ANY(${val}) OR UPPER(house_energy_class) = ANY(${val}) OR UPPER(comm_energy_class) = ANY(${val}))`);
      query.params.push(classes);
    }
  }

  // Floor filters — data lives in category-prefixed columns
  if (filters.floor_min !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`COALESCE(apt_floor, comm_floor_number) >= ${val}`);
    query.params.push(filters.floor_min);
  }

  if (filters.floor_max !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`COALESCE(apt_floor, comm_floor_number) <= ${val}`);
    query.params.push(filters.floor_max);
  }

  // Furnished filter
  if (filters.furnished) {
    query.whereClauses.push(`furnished = $${query.paramIndex++}`);
    query.params.push(filters.furnished);
  }

  // Construction type filter
  if (filters.construction_type) {
    query.whereClauses.push(`construction_type = $${query.paramIndex++}`);
    query.params.push(filters.construction_type);
  }

  // Plot size filters — house/land category columns
  if (filters.sqm_plot_min !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(house_sqm_plot >= ${val} OR land_area_plot_sqm >= ${val})`);
    query.params.push(filters.sqm_plot_min);
  }

  if (filters.sqm_plot_max !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(house_sqm_plot <= ${val} OR land_area_plot_sqm <= ${val})`);
    query.params.push(filters.sqm_plot_max);
  }

  // Year built filters
  if (filters.year_built_min !== undefined) {
    query.whereClauses.push(`year_built >= $${query.paramIndex++}`);
    query.params.push(filters.year_built_min);
  }

  if (filters.year_built_max !== undefined) {
    query.whereClauses.push(`year_built <= $${query.paramIndex++}`);
    query.params.push(filters.year_built_max);
  }

  // Basement filter — data lives in category-prefixed columns
  if (filters.has_basement !== undefined) {
    const val = `$${query.paramIndex++}`;
    query.whereClauses.push(`(apt_has_basement = ${val} OR house_has_basement = ${val})`);
    query.params.push(filters.has_basement);
  }

  // Bounding box filter (map viewport sync)
  if (
    filters.bounds_north !== undefined &&
    filters.bounds_south !== undefined &&
    filters.bounds_east !== undefined &&
    filters.bounds_west !== undefined
  ) {
    query.whereClauses.push(`latitude IS NOT NULL AND longitude IS NOT NULL`);
    query.whereClauses.push(`latitude BETWEEN $${query.paramIndex} AND $${query.paramIndex + 1}`);
    query.params.push(filters.bounds_south, filters.bounds_north);
    query.paramIndex += 2;
    query.whereClauses.push(`longitude BETWEEN $${query.paramIndex} AND $${query.paramIndex + 1}`);
    query.params.push(filters.bounds_west, filters.bounds_east);
    query.paramIndex += 2;
  }

  // Full-text search
  if (filters.search_query) {
    query.whereClauses.push(`(
      title ILIKE $${query.paramIndex} OR
      description ILIKE $${query.paramIndex}
    )`);
    query.params.push(`%${filters.search_query}%`);
    query.paramIndex++;
  }

  return query;
}

/**
 * Build count query (for total results)
 */
export function buildCountQuery(query: Pick<IQueryBuilder, 'whereClauses' | 'params'>): { sql: string; params: any[] } {
  const whereClause = query.whereClauses.length > 0
    ? `WHERE ${query.whereClauses.join(' AND ')}`
    : '';

  return {
    sql: `SELECT COUNT(*) as total FROM properties ${whereClause}`,
    params: query.params
  };
}
