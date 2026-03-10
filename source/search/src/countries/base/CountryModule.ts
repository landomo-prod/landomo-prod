/**
 * Base Country Module
 *
 * Abstract class that defines the interface for country-specific modules.
 * Each country implements this to provide custom field definitions, filters,
 * query enhancements, and result transformations.
 */

export interface CountryConfig {
  code: string;                         // 'czech', 'uk', 'australia'
  name: string;                         // 'Czech Republic'
  database: string;                     // 'landomo_czech'
  currency: string;                     // 'CZK', 'GBP', 'AUD'
  timezone: string;                     // 'Europe/Prague'
  port?: number;                        // Optional: port offset for Docker routing
}

export interface CountryFieldDefinition {
  name: string;                         // 'czech_disposition'
  type: 'string' | 'number' | 'boolean' | 'array';
  indexed: boolean;                     // Has database index?
  filterable: boolean;                  // Can be used in WHERE clause?
  sortable: boolean;                    // Can be used in ORDER BY?
  searchable: boolean;                  // Include in full-text search?
  description: string;                  // Human-readable description
  examples?: any[];                     // Example values
}

export type FilterOperator = 'eq' | 'in' | 'gte' | 'lte' | 'gt' | 'lt' | 'like' | 'contains' | 'between';

export interface CountryFilterDefinition {
  field: string;                        // Field to filter on
  operator: FilterOperator;
  sqlTemplate: string;                  // SQL template with placeholders
  validateValue: (value: any) => boolean;
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface QueryBuilder {
  sql: string;
  params: any[];
  paramIndex: number;
  whereClauses: string[];

  addWhere(clause: string, ...params: any[]): QueryBuilder;
  addSelect(field: string): QueryBuilder;
  clone(): QueryBuilder;
  build(sort?: any, limit?: number, offset?: number): { sql: string; params: any[] };
  buildCount(cap?: number): { sql: string; params: any[] };
}

/**
 * Abstract base class for country-specific modules
 */
export abstract class CountryModule {
  abstract config: CountryConfig;
  abstract fields: CountryFieldDefinition[];
  abstract filters: Record<string, CountryFilterDefinition>;

  /**
   * Hook: Modify base query for country-specific logic
   *
   * @param baseQuery - The base query builder
   * @param filters - User-provided filters
   * @returns Modified query builder
   */
  abstract enhanceQuery(
    baseQuery: QueryBuilder,
    filters: Record<string, any>
  ): QueryBuilder;

  /**
   * Hook: Transform database result to API format
   *
   * @param dbRow - Raw database row
   * @returns Transformed result for API response
   */
  abstract transformResult(dbRow: any): any;

  /**
   * Hook: Get available filter values (for UI dropdowns)
   *
   * @returns Metadata about available filter options
   */
  abstract getFilterMetadata(): Promise<Record<string, any[]>>;

  /**
   * Hook: Validate country-specific filters
   *
   * @param filters - User-provided filters
   * @returns Validation result
   */
  abstract validateFilters(filters: Record<string, any>): ValidationResult;

  /**
   * Optional: Override for country-specific geo-logic
   *
   * @param baseGeoQuery - The base geo query builder
   * @param filters - User-provided filters
   * @returns Modified query builder
   */
  enhanceGeoQuery?(
    baseGeoQuery: QueryBuilder,
    filters: Record<string, any>
  ): QueryBuilder;

  /**
   * Optional: Custom distance units or formatting
   *
   * @param distance_km - Distance in kilometers
   * @returns Formatted distance string
   */
  formatDistance?(distance_km: number): string;

  /**
   * Get all filterable fields for this country
   */
  getFilterableFields(): CountryFieldDefinition[] {
    return this.fields.filter(f => f.filterable);
  }

  /**
   * Get all sortable fields for this country
   */
  getSortableFields(): CountryFieldDefinition[] {
    return this.fields.filter(f => f.sortable);
  }

  /**
   * Get all searchable fields for this country
   */
  getSearchableFields(): CountryFieldDefinition[] {
    return this.fields.filter(f => f.searchable);
  }

  /**
   * Check if a field exists and is filterable
   */
  isFilterableField(fieldName: string): boolean {
    return this.fields.some(f => f.name === fieldName && f.filterable);
  }

  /**
   * Default distance formatting (kilometers)
   */
  protected defaultFormatDistance(distance_km: number): string {
    return `${distance_km.toFixed(2)} km`;
  }
}
