/**
 * USA Country Module
 *
 * Handles USA-specific fields and filters.
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class USAModule extends CountryModule {
  config: CountryConfig = {
    code: 'usa',
    name: 'United States',
    database: 'landomo_usa',
    currency: 'USD',
    timezone: 'America/New_York',
    port: 3003
  };

  fields: CountryFieldDefinition[] = [
    {
      name: 'usa_mls_number',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: true,
      description: 'MLS listing number',
      examples: ['12345678', 'MLS-987654']
    },
    {
      name: 'usa_hoa_fee',
      type: 'number',
      indexed: false,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'HOA fee (monthly)',
      examples: [0, 150, 300]
    }
  ];

  filters: Record<string, CountryFilterDefinition> = {
    mls_number: {
      field: 'usa_mls_number',
      operator: 'eq',
      sqlTemplate: 'usa_mls_number = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by MLS number'
    },
    hoa_fee_max: {
      field: 'usa_hoa_fee',
      operator: 'lte',
      sqlTemplate: 'usa_hoa_fee <= $param',
      validateValue: (value: number) => typeof value === 'number' && value >= 0,
      description: 'Maximum HOA fee'
    }
  };

  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    if (filters.mls_number) {
      baseQuery.whereClauses.push(`usa_mls_number = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.mls_number);
    }

    if (filters.hoa_fee_max !== undefined && this.filters.hoa_fee_max.validateValue(filters.hoa_fee_max)) {
      baseQuery.whereClauses.push(`usa_hoa_fee <= $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.hoa_fee_max);
    }

    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `$${dbRow.price.toLocaleString('en-US')} USD` : null,
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {};
  }

  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (filters.hoa_fee_max !== undefined && !this.filters.hoa_fee_max.validateValue(filters.hoa_fee_max)) {
      errors.push(`Invalid hoa_fee_max: ${filters.hoa_fee_max}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Override: Format distance in miles (USA uses miles)
   */
  formatDistance(distance_km: number): string {
    const distance_miles = distance_km * 0.621371;
    return `${distance_miles.toFixed(2)} miles`;
  }
}
