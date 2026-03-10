/**
 * Hungary Country Module
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class HungaryModule extends CountryModule {
  config: CountryConfig = {
    code: 'hungary',
    name: 'Hungary',
    database: 'landomo_hungary',
    currency: 'HUF',
    timezone: 'Europe/Budapest',
    port: 3011
  };

  fields: CountryFieldDefinition[] = [
    {
      name: 'hungarian_room_count',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Hungarian room count descriptor',
      examples: ['1 szoba', '2 szoba', '3 szoba']
    },
    {
      name: 'hungarian_ownership',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Ownership type',
      examples: ['Tulajdon', 'Berlet']
    }
  ];

  filters: Record<string, CountryFilterDefinition> = {
    room_count: {
      field: 'hungarian_room_count',
      operator: 'eq',
      sqlTemplate: 'hungarian_room_count = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by Hungarian room count'
    },
    ownership: {
      field: 'hungarian_ownership',
      operator: 'eq',
      sqlTemplate: 'hungarian_ownership = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by ownership type'
    }
  };

  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    if (filters.room_count) {
      baseQuery.whereClauses.push(`hungarian_room_count = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.room_count);
    }

    if (filters.ownership) {
      baseQuery.whereClauses.push(`hungarian_ownership = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.ownership);
    }

    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `${dbRow.price.toLocaleString('hu-HU')} Ft` : null,
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {
      room_counts: [
        { value: '1 szoba', label: '1 szoba (1 room)' },
        { value: '2 szoba', label: '2 szoba (2 rooms)' },
        { value: '3 szoba', label: '3 szoba (3 rooms)' },
        { value: '4 szoba', label: '4 szoba (4 rooms)' },
        { value: '5 szoba', label: '5+ szoba (5+ rooms)' }
      ],
      ownerships: [
        { value: 'Tulajdon', label: 'Tulajdon (Ownership)' },
        { value: 'Berlet', label: 'Berlet (Rental)' }
      ]
    };
  }

  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (filters.room_count && typeof filters.room_count !== 'string') {
      errors.push('room_count must be a string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
