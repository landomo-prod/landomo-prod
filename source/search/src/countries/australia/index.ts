/**
 * Australia Country Module
 *
 * Handles Australian-specific fields and filters.
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class AustraliaModule extends CountryModule {
  config: CountryConfig = {
    code: 'australia',
    name: 'Australia',
    database: 'landomo_australia',
    currency: 'AUD',
    timezone: 'Australia/Sydney',
    port: 3001
  };

  fields: CountryFieldDefinition[] = [
    // Add Australia-specific fields as needed
    {
      name: 'australia_land_size',
      type: 'number',
      indexed: true,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'Land size in square meters',
      examples: [200, 500, 1000]
    }
  ];

  filters: Record<string, CountryFilterDefinition> = {
    land_size_min: {
      field: 'australia_land_size',
      operator: 'gte',
      sqlTemplate: 'australia_land_size >= $param',
      validateValue: (value: number) => typeof value === 'number' && value > 0,
      description: 'Minimum land size in sqm'
    }
  };

  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    if (filters.land_size_min && this.filters.land_size_min.validateValue(filters.land_size_min)) {
      baseQuery.whereClauses.push(`australia_land_size >= $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.land_size_min);
    }

    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `$${dbRow.price.toLocaleString('en-AU')} AUD` : null,
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {
      // Add metadata as available
    };
  }

  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (filters.land_size_min !== undefined && !this.filters.land_size_min.validateValue(filters.land_size_min)) {
      errors.push(`Invalid land_size_min: ${filters.land_size_min}`);
    }

    return { valid: errors.length === 0, errors };
  }
}
