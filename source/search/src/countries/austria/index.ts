/**
 * Austria Country Module
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class AustriaModule extends CountryModule {
  config: CountryConfig = {
    code: 'austria',
    name: 'Austria',
    database: 'landomo_austria',
    currency: 'EUR',
    timezone: 'Europe/Vienna',
    port: 3010
  };

  fields: CountryFieldDefinition[] = [
    {
      name: 'austrian_ownership',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Ownership type (Eigentum, Miete)',
      examples: ['Eigentum', 'Miete']
    },
    {
      name: 'austrian_operating_costs',
      type: 'number',
      indexed: true,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'Monthly operating costs (Betriebskosten)',
      examples: [100, 200, 350]
    },
    {
      name: 'austrian_heating_costs',
      type: 'number',
      indexed: false,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'Monthly heating costs (Heizkosten)',
      examples: [50, 100, 200]
    }
  ];

  filters: Record<string, CountryFilterDefinition> = {
    ownership: {
      field: 'austrian_ownership',
      operator: 'eq',
      sqlTemplate: 'austrian_ownership = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by ownership type'
    },
    operating_costs_max: {
      field: 'austrian_operating_costs',
      operator: 'lte',
      sqlTemplate: 'austrian_operating_costs <= $param',
      validateValue: (value: number) => typeof value === 'number' && value >= 0,
      description: 'Filter by maximum operating costs'
    },
    heating_costs_max: {
      field: 'austrian_heating_costs',
      operator: 'lte',
      sqlTemplate: 'austrian_heating_costs <= $param',
      validateValue: (value: number) => typeof value === 'number' && value >= 0,
      description: 'Filter by maximum heating costs'
    }
  };

  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    if (filters.ownership) {
      baseQuery.whereClauses.push(`austrian_ownership = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.ownership);
    }

    if (filters.operating_costs_max !== undefined) {
      baseQuery.whereClauses.push(`austrian_operating_costs <= $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.operating_costs_max);
    }

    if (filters.heating_costs_max !== undefined) {
      baseQuery.whereClauses.push(`austrian_heating_costs <= $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.heating_costs_max);
    }

    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `${dbRow.price.toLocaleString('de-AT')} \u20AC` : null,
      operating_costs_formatted: dbRow.austrian_operating_costs ? `${dbRow.austrian_operating_costs.toLocaleString('de-AT')} \u20AC/Monat` : null,
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {
      ownerships: [
        { value: 'Eigentum', label: 'Eigentum (Ownership)' },
        { value: 'Miete', label: 'Miete (Rental)' }
      ]
    };
  }

  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (filters.operating_costs_max !== undefined && (typeof filters.operating_costs_max !== 'number' || filters.operating_costs_max < 0)) {
      errors.push('operating_costs_max must be a non-negative number');
    }

    if (filters.heating_costs_max !== undefined && (typeof filters.heating_costs_max !== 'number' || filters.heating_costs_max < 0)) {
      errors.push('heating_costs_max must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
