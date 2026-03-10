/**
 * Slovakia Country Module
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class SlovakiaModule extends CountryModule {
  config: CountryConfig = {
    code: 'slovakia',
    name: 'Slovakia',
    database: 'landomo_slovakia',
    currency: 'EUR',
    timezone: 'Europe/Bratislava',
    port: 3008
  };

  fields: CountryFieldDefinition[] = [
    {
      name: 'slovak_disposition',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Slovak room layout (similar to Czech disposition)',
      examples: ['1-izbovy', '2-izbovy', '3-izbovy', '4-izbovy']
    },
    {
      name: 'slovak_ownership',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Ownership type',
      examples: ['Osobne vlastnictvo', 'Druzstevne']
    }
  ];

  filters: Record<string, CountryFilterDefinition> = {
    disposition: {
      field: 'slovak_disposition',
      operator: 'eq',
      sqlTemplate: 'slovak_disposition = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by Slovak room layout'
    },
    ownership: {
      field: 'slovak_ownership',
      operator: 'eq',
      sqlTemplate: 'slovak_ownership = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by ownership type'
    }
  };

  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    if (filters.disposition) {
      baseQuery.whereClauses.push(`slovak_disposition = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.disposition);
    }

    if (filters.ownership) {
      baseQuery.whereClauses.push(`slovak_ownership = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.ownership);
    }

    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `${dbRow.price.toLocaleString('sk-SK')} \u20AC` : null,
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {
      dispositions: [
        { value: '1-izbovy', label: '1-izbovy (1 room)' },
        { value: '2-izbovy', label: '2-izbovy (2 rooms)' },
        { value: '3-izbovy', label: '3-izbovy (3 rooms)' },
        { value: '4-izbovy', label: '4-izbovy (4 rooms)' },
        { value: '5-izbovy', label: '5-izbovy (5 rooms)' }
      ],
      ownerships: [
        { value: 'Osobne vlastnictvo', label: 'Osobne vlastnictvo (Personal)' },
        { value: 'Druzstevne', label: 'Druzstevne (Cooperative)' }
      ]
    };
  }

  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (filters.disposition && typeof filters.disposition !== 'string') {
      errors.push('disposition must be a string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
