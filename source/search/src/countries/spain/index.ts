/**
 * Spain Country Module
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class SpainModule extends CountryModule {
  config: CountryConfig = {
    code: 'spain',
    name: 'Spain',
    database: 'landomo_spain',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
    port: 3006
  };

  fields: CountryFieldDefinition[] = [];
  filters: Record<string, CountryFilterDefinition> = {};

  enhanceQuery(baseQuery: QueryBuilder, _filters: Record<string, any>): QueryBuilder {
    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      price_formatted: dbRow.price ? `${dbRow.price.toLocaleString('es-ES')} €` : null,
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
