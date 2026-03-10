/**
 * Germany Country Module
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class GermanyModule extends CountryModule {
  config: CountryConfig = {
    code: 'germany',
    name: 'Germany',
    database: 'landomo_germany',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    port: 3009
  };

  fields: CountryFieldDefinition[] = [
    {
      name: 'german_ownership',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Ownership type (Eigentum, Miete)',
      examples: ['Eigentum', 'Miete']
    },
    {
      name: 'german_hausgeld',
      type: 'number',
      indexed: true,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'Monthly Hausgeld (maintenance fee)',
      examples: [150, 250, 400]
    },
    {
      name: 'german_courtage',
      type: 'number',
      indexed: false,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Broker commission (Courtage)',
      examples: [3.57, 5.95, 7.14]
    },
    {
      name: 'german_kfw_standard',
      type: 'string',
      indexed: false,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'KfW energy efficiency standard',
      examples: ['KfW 40', 'KfW 55', 'KfW 70']
    },
    {
      name: 'german_is_denkmalschutz',
      type: 'boolean',
      indexed: false,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Listed/heritage-protected building'
    }
  ];

  filters: Record<string, CountryFilterDefinition> = {
    ownership: {
      field: 'german_ownership',
      operator: 'eq',
      sqlTemplate: 'german_ownership = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by ownership type'
    },
    hausgeld_max: {
      field: 'german_hausgeld',
      operator: 'lte',
      sqlTemplate: 'german_hausgeld <= $param',
      validateValue: (value: number) => typeof value === 'number' && value >= 0,
      description: 'Filter by maximum Hausgeld'
    },
    kfw_standard: {
      field: 'german_kfw_standard',
      operator: 'eq',
      sqlTemplate: 'german_kfw_standard = $param',
      validateValue: (value: string) => typeof value === 'string' && value.length > 0,
      description: 'Filter by KfW standard'
    },
    denkmalschutz: {
      field: 'german_is_denkmalschutz',
      operator: 'eq',
      sqlTemplate: 'german_is_denkmalschutz = $param',
      validateValue: (value: boolean) => typeof value === 'boolean',
      description: 'Filter by heritage protection status'
    }
  };

  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    if (filters.ownership) {
      baseQuery.whereClauses.push(`german_ownership = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.ownership);
    }

    if (filters.hausgeld_max !== undefined) {
      baseQuery.whereClauses.push(`german_hausgeld <= $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.hausgeld_max);
    }

    if (filters.kfw_standard) {
      baseQuery.whereClauses.push(`german_kfw_standard = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.kfw_standard);
    }

    if (filters.denkmalschutz !== undefined) {
      baseQuery.whereClauses.push(`german_is_denkmalschutz = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.denkmalschutz);
    }

    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `${dbRow.price.toLocaleString('de-DE')} \u20AC` : null,
      hausgeld_formatted: dbRow.german_hausgeld ? `${dbRow.german_hausgeld.toLocaleString('de-DE')} \u20AC/Monat` : null,
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {
      ownerships: [
        { value: 'Eigentum', label: 'Eigentum (Ownership)' },
        { value: 'Miete', label: 'Miete (Rental)' }
      ],
      kfw_standards: [
        { value: 'KfW 40', label: 'KfW 40' },
        { value: 'KfW 55', label: 'KfW 55' },
        { value: 'KfW 70', label: 'KfW 70' }
      ]
    };
  }

  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (filters.hausgeld_max !== undefined && (typeof filters.hausgeld_max !== 'number' || filters.hausgeld_max < 0)) {
      errors.push('hausgeld_max must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
