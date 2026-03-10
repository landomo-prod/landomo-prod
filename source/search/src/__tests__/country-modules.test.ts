/**
 * Country Module Tests
 *
 * Tests for country registry functions and Czech module as a representative example.
 */

import {
  getCountryModule,
  getAllCountryCodes,
  getAllCountries,
  isValidCountry,
  getCountryModules,
  getDatabaseNames,
} from '../countries';

describe('Country Registry', () => {
  describe('getAllCountryCodes', () => {
    it('returns all registered country codes', () => {
      const codes = getAllCountryCodes();
      expect(codes).toContain('czech');
      expect(codes).toContain('uk');
      expect(codes).toContain('germany');
      expect(codes).toContain('austria');
      expect(codes).toContain('slovakia');
      expect(codes).toContain('hungary');
      expect(codes).toContain('usa');
      expect(codes).toContain('australia');
      expect(codes).toContain('france');
      expect(codes).toContain('spain');
      expect(codes).toContain('italy');
      expect(codes.length).toBe(11);
    });
  });

  describe('getAllCountries', () => {
    it('returns config for all registered countries', () => {
      const countries = getAllCountries();
      expect(countries.length).toBe(11);

      const czech = countries.find(c => c.code === 'czech');
      expect(czech).toBeDefined();
      expect(czech!.name).toBe('Czech Republic');
      expect(czech!.database).toBe('landomo_czech');
      expect(czech!.currency).toBe('CZK');
    });
  });

  describe('getCountryModule', () => {
    it('returns module for valid country code', () => {
      const mod = getCountryModule('czech');
      expect(mod).toBeDefined();
      expect(mod.config.code).toBe('czech');
    });

    it('is case-insensitive', () => {
      const mod = getCountryModule('CZECH');
      expect(mod.config.code).toBe('czech');
    });

    it('throws for invalid country code', () => {
      expect(() => getCountryModule('narnia')).toThrow('No module found for country: narnia');
    });
  });

  describe('isValidCountry', () => {
    it('returns true for registered countries', () => {
      expect(isValidCountry('czech')).toBe(true);
      expect(isValidCountry('uk')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isValidCountry('CZECH')).toBe(true);
    });

    it('returns false for invalid countries', () => {
      expect(isValidCountry('narnia')).toBe(false);
    });
  });

  describe('getCountryModules', () => {
    it('returns modules for specified codes', () => {
      const modules = getCountryModules(['czech', 'uk']);
      expect(modules).toHaveLength(2);
      expect(modules[0].config.code).toBe('czech');
      expect(modules[1].config.code).toBe('uk');
    });

    it('returns all modules for wildcard', () => {
      const modules = getCountryModules(['*']);
      expect(modules.length).toBe(11);
    });

    it('filters out invalid codes', () => {
      const modules = getCountryModules(['czech', 'narnia']);
      expect(modules).toHaveLength(1);
      expect(modules[0].config.code).toBe('czech');
    });
  });

  describe('getDatabaseNames', () => {
    it('returns database names for given codes', () => {
      const dbNames = getDatabaseNames(['czech', 'uk']);
      expect(dbNames.get('czech')).toBe('landomo_czech');
      expect(dbNames.get('uk')).toBe('landomo_uk');
    });
  });
});

describe('CzechModule', () => {
  const czech = getCountryModule('czech');

  describe('config', () => {
    it('has correct configuration', () => {
      expect(czech.config.code).toBe('czech');
      expect(czech.config.name).toBe('Czech Republic');
      expect(czech.config.database).toBe('landomo_czech');
      expect(czech.config.currency).toBe('CZK');
      expect(czech.config.timezone).toBe('Europe/Prague');
    });
  });

  describe('fields', () => {
    it('defines czech-specific fields', () => {
      const fieldNames = czech.fields.map(f => f.name);
      expect(fieldNames).toContain('czech_disposition');
      expect(fieldNames).toContain('czech_ownership');
      expect(fieldNames).toContain('czech_building_type');
      expect(fieldNames).toContain('czech_condition');
    });

    it('marks disposition and ownership as indexed and filterable', () => {
      const disposition = czech.fields.find(f => f.name === 'czech_disposition')!;
      expect(disposition.indexed).toBe(true);
      expect(disposition.filterable).toBe(true);

      const ownership = czech.fields.find(f => f.name === 'czech_ownership')!;
      expect(ownership.indexed).toBe(true);
      expect(ownership.filterable).toBe(true);
    });
  });

  describe('enhanceQuery', () => {
    it('adds disposition filter when valid', () => {
      const mockQuery = {
        whereClauses: ["status = 'active'"],
        params: [] as any[],
        paramIndex: 1,
        sql: '',
        addWhere: jest.fn(),
        addSelect: jest.fn(),
        clone: jest.fn(),
        build: jest.fn(),
      };

      czech.enhanceQuery(mockQuery, { disposition: '2+kk' });

      expect(mockQuery.whereClauses).toContain('czech_disposition = $1');
      expect(mockQuery.params).toContain('2+kk');
    });

    it('adds ownership filter when valid', () => {
      const mockQuery = {
        whereClauses: ["status = 'active'"],
        params: [] as any[],
        paramIndex: 1,
        sql: '',
        addWhere: jest.fn(),
        addSelect: jest.fn(),
        clone: jest.fn(),
        build: jest.fn(),
      };

      czech.enhanceQuery(mockQuery, { ownership: 'Osobní' });

      expect(mockQuery.whereClauses).toContain('czech_ownership = $1');
      expect(mockQuery.params).toContain('Osobní');
    });

    it('does not add disposition filter for invalid value', () => {
      const mockQuery = {
        whereClauses: ["status = 'active'"],
        params: [] as any[],
        paramIndex: 1,
        sql: '',
        addWhere: jest.fn(),
        addSelect: jest.fn(),
        clone: jest.fn(),
        build: jest.fn(),
      };

      czech.enhanceQuery(mockQuery, { disposition: 'invalid' });

      const hasDisposition = mockQuery.whereClauses.some(
        (c: string) => c.includes('czech_disposition')
      );
      expect(hasDisposition).toBe(false);
    });

    it('adds building_type filter', () => {
      const mockQuery = {
        whereClauses: ["status = 'active'"],
        params: [] as any[],
        paramIndex: 1,
        sql: '',
        addWhere: jest.fn(),
        addSelect: jest.fn(),
        clone: jest.fn(),
        build: jest.fn(),
      };

      czech.enhanceQuery(mockQuery, { building_type: 'Cihlová' });

      expect(mockQuery.whereClauses).toContain('czech_building_type = $1');
      expect(mockQuery.params).toContain('Cihlová');
    });
  });

  describe('transformResult', () => {
    it('adds disposition description', () => {
      const result = czech.transformResult({
        czech_disposition: '2+kk',
        price: 5000000,
      });

      expect(result.disposition_description).toBe('2 rooms with kitchenette');
    });

    it('formats price in Czech format', () => {
      const result = czech.transformResult({
        czech_disposition: '1+kk',
        price: 5000000,
      });

      expect(result.price_formatted).toBeDefined();
      expect(result.price_formatted).toContain('Kč');
    });

    it('adds country metadata', () => {
      const result = czech.transformResult({});

      expect(result.country).toBe('czech');
      expect(result.country_name).toBe('Czech Republic');
    });

    it('handles null price', () => {
      const result = czech.transformResult({ price: null });
      expect(result.price_formatted).toBeNull();
    });
  });

  describe('validateFilters', () => {
    it('returns valid for valid disposition', () => {
      const result = czech.validateFilters({ disposition: '2+kk' });
      expect(result.valid).toBe(true);
    });

    it('returns invalid for bad disposition', () => {
      const result = czech.validateFilters({ disposition: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid disposition');
    });

    it('returns valid for valid ownership', () => {
      const result = czech.validateFilters({ ownership: 'Osobní' });
      expect(result.valid).toBe(true);
    });

    it('returns invalid for bad ownership', () => {
      const result = czech.validateFilters({ ownership: 'Invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid ownership');
    });

    it('returns valid for no country-specific filters', () => {
      const result = czech.validateFilters({ price_min: 100000 });
      expect(result.valid).toBe(true);
    });
  });

  describe('getFilterableFields', () => {
    it('returns only filterable fields', () => {
      const filterable = czech.getFilterableFields();
      expect(filterable.every(f => f.filterable)).toBe(true);
      expect(filterable.length).toBeGreaterThan(0);
    });
  });

  describe('isFilterableField', () => {
    it('returns true for filterable fields', () => {
      expect(czech.isFilterableField('czech_disposition')).toBe(true);
    });

    it('returns false for non-existent fields', () => {
      expect(czech.isFilterableField('nonexistent')).toBe(false);
    });
  });
});
