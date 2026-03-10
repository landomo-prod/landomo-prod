/**
 * France Country Module
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class FranceModule extends CountryModule {
  config: CountryConfig = {
    code: 'france',
    name: 'France',
    database: 'landomo_france',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    port: 3005
  };

  fields: CountryFieldDefinition[] = [];
  filters: Record<string, CountryFilterDefinition> = {};

  enhanceQuery(baseQuery: QueryBuilder, _filters: Record<string, any>): QueryBuilder {
    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `${dbRow.price.toLocaleString('fr-FR')} €` : null,
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {};
  }

  validateFilters(_filters: Record<string, any>): ValidationResult {
    return { valid: true, errors: [] };
  }
}
