/**
 * Czech Republic Country Module
 *
 * Handles Czech-specific fields, filters, and data transformations.
 * Key features: disposition (2+kk, 3+1), ownership types (Osobní, Družstevní).
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class CzechModule extends CountryModule {
  config: CountryConfig = {
    code: 'czech',
    name: 'Czech Republic',
    database: 'landomo_cz',
    currency: 'CZK',
    timezone: 'Europe/Prague',
    port: 3004
  };

  // Define Czech-specific fields
  fields: CountryFieldDefinition[] = [
    {
      name: 'czech_disposition',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Czech room layout (e.g., 2+kk, 3+1)',
      examples: ['1+kk', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1']
    },
    {
      name: 'czech_ownership',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Ownership type',
      examples: ['Osobní', 'Družstevní', 'Státní']
    },
    {
      name: 'czech_building_type',
      type: 'string',
      indexed: false,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Building type',
      examples: ['Cihlová', 'Panelová', 'Montovaná']
    },
    {
      name: 'czech_condition',
      type: 'string',
      indexed: false,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Property condition',
      examples: ['Velmi dobrý', 'Dobrý', 'Po rekonstrukci', 'Před rekonstrukcí']
    }
  ];

  // Define Czech-specific filters
  filters: Record<string, CountryFilterDefinition> = {
    disposition: {
      field: 'czech_disposition',
      operator: 'eq',
      sqlTemplate: 'czech_disposition = $param',
      validateValue: (value: string) => {
        const validValues = ['1+kk', '1+1', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1', '5+kk', '5+1', '6+kk', '6+1'];
        return validValues.includes(value);
      },
      description: 'Filter by Czech room layout'
    },
    ownership: {
      field: 'czech_ownership',
      operator: 'eq',
      sqlTemplate: 'czech_ownership = $param',
      validateValue: (value: string) => {
        const validValues = ['personal', 'cooperative', 'state', 'private', 'collective', 'other', 'Osobní', 'Družstevní', 'Státní'];
        return validValues.includes(value);
      },
      description: 'Filter by ownership type'
    },
    building_type: {
      field: 'czech_building_type',
      operator: 'eq',
      sqlTemplate: 'czech_building_type = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by building type'
    },
    condition: {
      field: 'czech_condition',
      operator: 'eq',
      sqlTemplate: 'czech_condition = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by property condition'
    }
  };

  /**
   * Enhance query with Czech-specific logic
   */
  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    // Add Czech disposition filter if provided (supports comma-separated multi-select)
    if (filters.disposition) {
      const dispositions = String(filters.disposition).split(',').map(d => d.trim()).filter(d => this.filters.disposition.validateValue(d));
      if (dispositions.length === 1) {
        baseQuery.whereClauses.push(`czech_disposition = $${baseQuery.paramIndex++}`);
        baseQuery.params.push(dispositions[0]);
      } else if (dispositions.length > 1) {
        baseQuery.whereClauses.push(`czech_disposition = ANY($${baseQuery.paramIndex++}::text[])`);
        baseQuery.params.push(dispositions);
      }
    }

    // Add Czech ownership filter if provided (accepts English values from frontend)
    if (filters.ownership) {
      baseQuery.whereClauses.push(`czech_ownership = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.ownership);
    }

    // Add building type filter
    if (filters.building_type) {
      baseQuery.whereClauses.push(`czech_building_type = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.building_type);
    }

    // Add condition filter (queries universal 'condition' column, supports comma-separated multi-select)
    if (filters.condition) {
      const conditions = String(filters.condition).split(',').map(c => c.trim()).filter(Boolean);
      if (conditions.length === 1) {
        baseQuery.whereClauses.push(`condition = $${baseQuery.paramIndex++}`);
        baseQuery.params.push(conditions[0]);
      } else if (conditions.length > 1) {
        baseQuery.whereClauses.push(`condition = ANY($${baseQuery.paramIndex++}::text[])`);
        baseQuery.params.push(conditions);
      }
    }

    // Czech-specific: Join with portal_metadata for sreality data
    if (filters.portal === 'sreality') {
      // Note: This is handled by the portal_metadata JSONB column
      // No additional SQL needed, just note it for future use
    }

    return baseQuery;
  }

  /**
   * Transform database result for Czech-specific formatting
   */
  transformResult(dbRow: any): any {
    // PostgreSQL NUMERIC columns return strings — coerce to numbers
    const numericFields = [
      'price', 'sqm', 'floor', 'bedrooms', 'bathrooms', 'rooms', 'year_built',
      'renovation_year', 'deposit', 'parking_spaces', 'price_per_sqm',
      'apt_sqm', 'apt_floor', 'apt_total_floors', 'apt_rooms', 'apt_bedrooms', 'apt_bathrooms',
      'apt_loggia_area', 'apt_balcony_area', 'apt_terrace_area', 'apt_cellar_area', 'apt_hoa_fees',
      'house_sqm_living', 'house_sqm_total', 'house_sqm_plot', 'house_stories', 'house_rooms',
      'house_bedrooms', 'house_bathrooms', 'house_garden_area', 'house_terrace_area',
      'house_garage_count', 'house_cellar_area', 'house_year_built', 'house_balcony_area',
      'house_service_charges',
      'land_area_plot_sqm',
      'comm_floor_area', 'comm_floor_number', 'comm_total_floors', 'comm_ceiling_height',
      'comm_service_charges', 'apt_service_charges',
    ];
    const coerced: any = { ...dbRow };
    for (const field of numericFields) {
      if (coerced[field] != null && typeof coerced[field] === 'string') {
        const num = parseFloat(coerced[field]);
        if (!isNaN(num)) coerced[field] = num;
      }
    }
    // Normalize energy_class to uppercase
    if (coerced.energy_class && typeof coerced.energy_class === 'string') {
      coerced.energy_class = coerced.energy_class.toUpperCase();
    }
    return {
      ...coerced,
      // Add human-readable disposition description
      disposition_description: this.getDispositionDescription(coerced.czech_disposition),
      // Format price in Czech format (space as thousand separator)
      price_formatted: coerced.price ? this.formatCzechPrice(coerced.price) : null,
      // Add country metadata
      country: this.config.code,
      country_name: this.config.name
    };
  }

  /**
   * Get available filter values for UI
   */
  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {
      dispositions: [
        { value: '1+kk', label: '1+kk (1 room + kitchenette)', count: 1250 },
        { value: '1+1', label: '1+1 (1 room + kitchen)', count: 800 },
        { value: '2+kk', label: '2+kk (2 rooms + kitchenette)', count: 3400 },
        { value: '2+1', label: '2+1 (2 rooms + kitchen)', count: 2100 },
        { value: '3+kk', label: '3+kk (3 rooms + kitchenette)', count: 2800 },
        { value: '3+1', label: '3+1 (3 rooms + kitchen)', count: 1900 },
        { value: '4+kk', label: '4+kk (4 rooms + kitchenette)', count: 1200 },
        { value: '4+1', label: '4+1 (4 rooms + kitchen)', count: 900 }
      ],
      ownerships: [
        { value: 'Osobní', label: 'Osobní (Personal)', count: 15000 },
        { value: 'Družstevní', label: 'Družstevní (Cooperative)', count: 8000 },
        { value: 'Státní', label: 'Státní (State)', count: 500 }
      ],
      building_types: [
        { value: 'Cihlová', label: 'Cihlová (Brick)', count: 12000 },
        { value: 'Panelová', label: 'Panelová (Panel)', count: 8500 },
        { value: 'Montovaná', label: 'Montovaná (Prefab)', count: 2000 }
      ],
      conditions: [
        { value: 'Velmi dobrý', label: 'Velmi dobrý (Very good)', count: 5000 },
        { value: 'Dobrý', label: 'Dobrý (Good)', count: 8000 },
        { value: 'Po rekonstrukci', label: 'Po rekonstrukci (After renovation)', count: 6000 },
        { value: 'Před rekonstrukcí', label: 'Před rekonstrukcí (Before renovation)', count: 4000 }
      ]
    };
  }

  /**
   * Validate Czech-specific filters
   */
  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    // Disposition supports comma-separated multi-select — validate each value
    if (filters.disposition) {
      const dispositions = String(filters.disposition).split(',').map(d => d.trim());
      const invalid = dispositions.filter(d => !this.filters.disposition.validateValue(d));
      if (invalid.length > 0 && dispositions.length === invalid.length) {
        errors.push(`Invalid disposition: ${filters.disposition}. Must be one of: 1+kk, 2+kk, 2+1, etc.`);
      }
    }

    // Ownership validation is lenient — accept any non-empty string
    // (DB stores English values like 'personal', 'cooperative', 'state')

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper: Get disposition description
   */
  private getDispositionDescription(disposition: string): string {
    const descriptions: Record<string, string> = {
      '1+kk': '1 room with kitchenette',
      '1+1': '1 room with separate kitchen',
      '2+kk': '2 rooms with kitchenette',
      '2+1': '2 rooms with separate kitchen',
      '3+kk': '3 rooms with kitchenette',
      '3+1': '3 rooms with separate kitchen',
      '4+kk': '4 rooms with kitchenette',
      '4+1': '4 rooms with separate kitchen',
      '5+kk': '5 rooms with kitchenette',
      '5+1': '5 rooms with separate kitchen'
    };
    return descriptions[disposition] || disposition;
  }

  /**
   * Helper: Format price in Czech format
   */
  private formatCzechPrice(price: number): string {
    return price.toLocaleString('cs-CZ') + ' Kč';
  }
}
