/**
 * Shared filter clause builder for property queries
 *
 * Used by cluster-queries.ts and advanced-queries.ts
 */

export interface PropertyFilters {
  propertyCategory?: string[];
  propertyType?: string;
  transactionType?: string;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  sqmMin?: number;
  sqmMax?: number;
  hasParking?: boolean;
  hasElevator?: boolean;
  hasGarden?: boolean;
}

/**
 * Build filter WHERE clauses dynamically
 */
export function buildFilterClauses(
  filters: PropertyFilters | undefined,
  startIndex: number = 1
): { sql: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  let paramIndex = startIndex;

  if (!filters) {
    return { sql: '', params: [] };
  }

  // Category filter (for partition pruning)
  if (filters.propertyCategory && filters.propertyCategory.length > 0) {
    clauses.push(`property_category = ANY($${paramIndex++})`);
    params.push(filters.propertyCategory.map((c) => c.toLowerCase()));
  }

  // Property type (sub-category: office, warehouse, building_plot, etc.)
  if (filters.propertyType) {
    clauses.push(`property_type = $${paramIndex++}`);
    params.push(filters.propertyType.toLowerCase());
  }

  // Price filters
  if (filters.priceMin !== undefined) {
    clauses.push(`price >= $${paramIndex++}`);
    params.push(filters.priceMin);
  }
  if (filters.priceMax !== undefined) {
    clauses.push(`price <= $${paramIndex++}`);
    params.push(filters.priceMax);
  }

  // Transaction type
  if (filters.transactionType) {
    clauses.push(`transaction_type = $${paramIndex++}`);
    params.push(filters.transactionType.toLowerCase());
  }

  // Category-specific filters
  if (filters.bedroomsMin !== undefined) {
    clauses.push(`(
      (property_category = 'apartment' AND apt_bedrooms >= $${paramIndex}) OR
      (property_category = 'house' AND house_bedrooms >= $${paramIndex})
    )`);
    params.push(filters.bedroomsMin);
    paramIndex++;
  }

  if (filters.bedroomsMax !== undefined) {
    clauses.push(`(
      (property_category = 'apartment' AND apt_bedrooms <= $${paramIndex}) OR
      (property_category = 'house' AND house_bedrooms <= $${paramIndex})
    )`);
    params.push(filters.bedroomsMax);
    paramIndex++;
  }

  if (filters.sqmMin !== undefined) {
    clauses.push(`(
      (property_category = 'apartment' AND apt_sqm >= $${paramIndex}) OR
      (property_category = 'house' AND house_sqm_living >= $${paramIndex}) OR
      (property_category = 'land' AND land_area_plot_sqm >= $${paramIndex}) OR
      (property_category = 'commercial' AND comm_floor_area >= $${paramIndex})
    )`);
    params.push(filters.sqmMin);
    paramIndex++;
  }

  if (filters.sqmMax !== undefined) {
    clauses.push(`(
      (property_category = 'apartment' AND apt_sqm <= $${paramIndex}) OR
      (property_category = 'house' AND house_sqm_living <= $${paramIndex}) OR
      (property_category = 'land' AND land_area_plot_sqm <= $${paramIndex}) OR
      (property_category = 'commercial' AND comm_floor_area <= $${paramIndex})
    )`);
    params.push(filters.sqmMax);
    paramIndex++;
  }

  // Amenity filters
  if (filters.hasParking === true) {
    clauses.push(`(
      (property_category = 'apartment' AND apt_has_parking = true) OR
      (property_category = 'house' AND house_has_parking = true) OR
      (property_category = 'commercial' AND comm_has_parking = true)
    )`);
  }

  if (filters.hasElevator === true) {
    clauses.push(`(
      (property_category = 'apartment' AND apt_has_elevator = true) OR
      (property_category = 'commercial' AND comm_has_elevator = true)
    )`);
  }

  if (filters.hasGarden === true) {
    clauses.push(`(property_category = 'house' AND house_has_garden = true)`);
  }

  const sql = clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '';
  return { sql, params };
}
