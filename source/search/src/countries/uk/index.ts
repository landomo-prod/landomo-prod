/**
 * United Kingdom Country Module
 *
 * Handles UK-specific fields, filters, and data transformations.
 * Key features: tenure (freehold/leasehold), EPC ratings, council tax bands.
 */

import {
  CountryModule,
  CountryConfig,
  CountryFieldDefinition,
  CountryFilterDefinition,
  QueryBuilder,
  ValidationResult
} from '../base/CountryModule';

export class UKModule extends CountryModule {
  config: CountryConfig = {
    code: 'uk',
    name: 'United Kingdom',
    database: 'landomo_uk',
    currency: 'GBP',
    timezone: 'Europe/London',
    port: 3002
  };

  fields: CountryFieldDefinition[] = [
    {
      name: 'uk_tenure',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: false,
      searchable: false,
      description: 'Property tenure type',
      examples: ['freehold', 'leasehold', 'shareOfFreehold']
    },
    {
      name: 'uk_council_tax_band',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'Council tax band',
      examples: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    },
    {
      name: 'uk_epc_rating',
      type: 'string',
      indexed: true,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'Energy Performance Certificate rating',
      examples: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    },
    {
      name: 'uk_leasehold_years_remaining',
      type: 'number',
      indexed: true,
      filterable: true,
      sortable: true,
      searchable: false,
      description: 'Remaining years on leasehold',
      examples: [99, 125, 999]
    }
  ];

  filters: Record<string, CountryFilterDefinition> = {
    tenure: {
      field: 'uk_tenure',
      operator: 'eq',
      sqlTemplate: 'uk_tenure = $param',
      validateValue: (value: string) => ['freehold', 'leasehold', 'shareOfFreehold'].includes(value),
      description: 'Filter by tenure type'
    },
    council_tax_band: {
      field: 'uk_council_tax_band',
      operator: 'eq',
      sqlTemplate: 'uk_council_tax_band = $param',
      validateValue: (value: string) => /^[A-H]$/.test(value),
      description: 'Filter by council tax band'
    },
    epc_rating: {
      field: 'uk_epc_rating',
      operator: 'in',
      sqlTemplate: 'uk_epc_rating = ANY($param)',
      validateValue: (values: string[] | string) => {
        if (typeof values === 'string') {
          return /^[A-G]$/.test(values);
        }
        return Array.isArray(values) && values.every(v => /^[A-G]$/.test(v));
      },
      description: 'Filter by EPC rating (can be multiple)'
    },
    epc_min_rating: {
      field: 'uk_epc_rating',
      operator: 'gte',
      sqlTemplate: 'uk_epc_rating <= $param',  // Note: A is best, G is worst
      validateValue: (value: string) => /^[A-G]$/.test(value),
      description: 'Minimum EPC rating (A is best)'
    },
    leasehold_min_years: {
      field: 'uk_leasehold_years_remaining',
      operator: 'gte',
      sqlTemplate: 'uk_leasehold_years_remaining >= $param AND uk_tenure = \'leasehold\'',
      validateValue: (value: number) => typeof value === 'number' && value > 0 && value <= 999,
      description: 'Minimum remaining years for leasehold properties'
    }
  };

  enhanceQuery(baseQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    // UK-specific filters
    if (filters.tenure && this.filters.tenure.validateValue(filters.tenure)) {
      baseQuery.whereClauses.push(`uk_tenure = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.tenure);
    }

    if (filters.council_tax_band && this.filters.council_tax_band.validateValue(filters.council_tax_band)) {
      baseQuery.whereClauses.push(`uk_council_tax_band = $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.council_tax_band);
    }

    // EPC rating filter (can be array or single value)
    if (filters.epc_rating) {
      if (Array.isArray(filters.epc_rating)) {
        baseQuery.whereClauses.push(`uk_epc_rating = ANY($${baseQuery.paramIndex++})`);
        baseQuery.params.push(filters.epc_rating);
      } else {
        baseQuery.whereClauses.push(`uk_epc_rating = $${baseQuery.paramIndex++}`);
        baseQuery.params.push(filters.epc_rating);
      }
    }

    // Minimum EPC rating filter
    if (filters.epc_min_rating && this.filters.epc_min_rating.validateValue(filters.epc_min_rating)) {
      baseQuery.whereClauses.push(`uk_epc_rating <= $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.epc_min_rating);
    }

    // Special case: Leasehold properties with minimum years
    if (filters.leasehold_min_years && this.filters.leasehold_min_years.validateValue(filters.leasehold_min_years)) {
      baseQuery.whereClauses.push(`uk_tenure = 'leasehold' AND uk_leasehold_years_remaining >= $${baseQuery.paramIndex++}`);
      baseQuery.params.push(filters.leasehold_min_years);
    }

    return baseQuery;
  }

  transformResult(dbRow: any): any {
    return {
      ...dbRow,
      // Format price in UK format (comma as thousand separator)
      price_formatted: dbRow.price ? this.formatUKPrice(dbRow.price) : null,
      // Add tenure description
      tenure_description: this.getTenureDescription(dbRow.uk_tenure),
      // Add EPC badge color
      epc_badge_color: this.getEPCColor(dbRow.uk_epc_rating),
      // Add country metadata
      country: this.config.code,
      country_name: this.config.name
    };
  }

  async getFilterMetadata(): Promise<Record<string, any[]>> {
    return {
      tenures: [
        { value: 'freehold', label: 'Freehold', count: 45000, description: 'You own the property and the land' },
        { value: 'leasehold', label: 'Leasehold', count: 28000, description: 'You own the property for a fixed period' },
        { value: 'shareOfFreehold', label: 'Share of Freehold', count: 3500, description: 'You own the property and a share of the land' }
      ],
      council_tax_bands: [
        { value: 'A', label: 'Band A', count: 8000, description: 'Lowest tax band' },
        { value: 'B', label: 'Band B', count: 12000 },
        { value: 'C', label: 'Band C', count: 18000 },
        { value: 'D', label: 'Band D', count: 15000 },
        { value: 'E', label: 'Band E', count: 10000 },
        { value: 'F', label: 'Band F', count: 5000 },
        { value: 'G', label: 'Band G', count: 2500 },
        { value: 'H', label: 'Band H', count: 500, description: 'Highest tax band' }
      ],
      epc_ratings: [
        { value: 'A', label: 'A (92+ points)', count: 500, color: 'green', description: 'Very energy efficient' },
        { value: 'B', label: 'B (81-91 points)', count: 8000, color: 'lightgreen', description: 'Energy efficient' },
        { value: 'C', label: 'C (69-80 points)', count: 25000, color: 'yellow', description: 'Good' },
        { value: 'D', label: 'D (55-68 points)', count: 30000, color: 'orange', description: 'Average' },
        { value: 'E', label: 'E (39-54 points)', count: 12000, color: 'darkorange', description: 'Below average' },
        { value: 'F', label: 'F (21-38 points)', count: 3000, color: 'red', description: 'Poor' },
        { value: 'G', label: 'G (1-20 points)', count: 500, color: 'darkred', description: 'Very poor' }
      ]
    };
  }

  validateFilters(filters: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    if (filters.tenure && !this.filters.tenure.validateValue(filters.tenure)) {
      errors.push(`Invalid tenure: ${filters.tenure}. Must be one of: freehold, leasehold, shareOfFreehold`);
    }

    if (filters.council_tax_band && !this.filters.council_tax_band.validateValue(filters.council_tax_band)) {
      errors.push(`Invalid council tax band: ${filters.council_tax_band}. Must be A-H`);
    }

    if (filters.epc_rating && !this.filters.epc_rating.validateValue(filters.epc_rating)) {
      errors.push(`Invalid EPC rating: ${filters.epc_rating}. Must be A-G`);
    }

    if (filters.leasehold_min_years !== undefined) {
      if (!this.filters.leasehold_min_years.validateValue(filters.leasehold_min_years)) {
        errors.push(`Invalid leasehold_min_years: ${filters.leasehold_min_years}. Must be between 1 and 999`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Override: Format distance in miles (UK uses miles)
   */
  formatDistance(distance_km: number): string {
    const distance_miles = distance_km * 0.621371;
    return `${distance_miles.toFixed(2)} miles`;
  }

  /**
   * UK-specific geo query enhancement
   */
  enhanceGeoQuery(baseGeoQuery: QueryBuilder, filters: Record<string, any>): QueryBuilder {
    // UK: Add postcode district filtering if provided
    if (filters.postcode_district && typeof filters.postcode_district === 'string') {
      baseGeoQuery.whereClauses.push(`postal_code LIKE $${baseGeoQuery.paramIndex++}`);
      baseGeoQuery.params.push(`${filters.postcode_district}%`);
    }

    return baseGeoQuery;
  }

  private getTenureDescription(tenure: string): string {
    const descriptions: Record<string, string> = {
      freehold: 'You own the property and the land',
      leasehold: 'You own the property for a fixed period',
      shareOfFreehold: 'You own the property and a share of the land'
    };
    return descriptions[tenure] || tenure;
  }

  private getEPCColor(rating: string): string {
    const colors: Record<string, string> = {
      A: 'green',
      B: 'lightgreen',
      C: 'yellow',
      D: 'orange',
      E: 'darkorange',
      F: 'red',
      G: 'darkred'
    };
    return colors[rating] || 'gray';
  }

  private formatUKPrice(price: number): string {
    return '£' + price.toLocaleString('en-GB');
  }
}
