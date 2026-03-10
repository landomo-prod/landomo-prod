/**
 * Unit tests for SRealityItemsParser
 */

import { SRealityItemsParser, FIELD_NAMES } from '../itemsParser';

describe('SRealityItemsParser', () => {
  describe('getString()', () => {
    it('should extract string values', () => {
      const parser = new SRealityItemsParser([
        { name: 'Dispozice', value: '2+kk' },
        { name: 'Stav objektu', value: 'Velmi dobrý' }
      ]);

      expect(parser.getString(FIELD_NAMES.DISPOSITION)).toBe('2+kk');
      expect(parser.getString(FIELD_NAMES.CONDITION)).toBe('Velmi dobrý');
    });

    it('should return undefined for missing fields', () => {
      const parser = new SRealityItemsParser([]);
      expect(parser.getString(FIELD_NAMES.DISPOSITION)).toBeUndefined();
    });

    it('should handle numeric values as strings', () => {
      const parser = new SRealityItemsParser([
        { name: 'Počet podlaží', value: 5 }
      ]);

      expect(parser.getString(FIELD_NAMES.TOTAL_FLOORS)).toBe('5');
    });

    it('should handle object with value property', () => {
      const parser = new SRealityItemsParser([
        { name: 'Dispozice', value: { value: '3+1' } }
      ]);

      expect(parser.getString(FIELD_NAMES.DISPOSITION)).toBe('3+1');
    });

    it('should handle arrays by taking first item', () => {
      const parser = new SRealityItemsParser([
        { name: 'Vytápění', value: ['Ústřední plynové'] }
      ]);

      expect(parser.getString(FIELD_NAMES.HEATING)).toBe('Ústřední plynové');
    });
  });

  describe('getStringOr()', () => {
    it('should return first available field', () => {
      const parser = new SRealityItemsParser([
        { name: 'Celková plocha', value: '75' }
      ]);

      const result = parser.getStringOr(
        FIELD_NAMES.LIVING_AREA,
        FIELD_NAMES.TOTAL_AREA,
        FIELD_NAMES.AREA
      );

      expect(result).toBe('75');
    });

    it('should return undefined if no fields found', () => {
      const parser = new SRealityItemsParser([]);

      const result = parser.getStringOr(
        FIELD_NAMES.LIVING_AREA,
        FIELD_NAMES.TOTAL_AREA
      );

      expect(result).toBeUndefined();
    });
  });

  describe('getNumber()', () => {
    it('should extract numeric values', () => {
      const parser = new SRealityItemsParser([
        { name: 'Podlaží', value: 3 }
      ]);

      expect(parser.getNumber(FIELD_NAMES.FLOOR)).toBe(3);
    });

    it('should parse string numbers', () => {
      const parser = new SRealityItemsParser([
        { name: 'Počet podlaží', value: '5' }
      ]);

      expect(parser.getNumber(FIELD_NAMES.TOTAL_FLOORS)).toBe(5);
    });

    it('should handle Czech decimal format', () => {
      const parser = new SRealityItemsParser([
        { name: 'Plocha', value: '75,5' }
      ]);

      expect(parser.getNumber(FIELD_NAMES.AREA)).toBe(75.5);
    });

    it('should return undefined for non-numeric strings', () => {
      const parser = new SRealityItemsParser([
        { name: 'Dispozice', value: '2+kk' }
      ]);

      expect(parser.getNumber(FIELD_NAMES.DISPOSITION)).toBeUndefined();
    });
  });

  describe('getBoolean()', () => {
    it('should return true for "Ano"', () => {
      const parser = new SRealityItemsParser([
        { name: 'Výtah', value: 'Ano' }
      ]);

      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(true);
    });

    it('should return true for positive numbers', () => {
      const parser = new SRealityItemsParser([
        { name: 'Balkón', value: 3 }
      ]);

      expect(parser.getBoolean(FIELD_NAMES.BALCONY)).toBe(true);
    });

    it('should return false for "Ne"', () => {
      const parser = new SRealityItemsParser([
        { name: 'Výtah', value: 'Ne' }
      ]);

      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(false);
    });

    it('should return false for missing fields', () => {
      const parser = new SRealityItemsParser([]);

      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(false);
    });

    it('should return false for zero', () => {
      const parser = new SRealityItemsParser([
        { name: 'Výtah', value: 0 }
      ]);

      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(false);
    });

    it('should handle case-insensitive "yes"', () => {
      const parser = new SRealityItemsParser([
        { name: 'Výtah', value: 'YES' }
      ]);

      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(true);
    });
  });

  describe('getBooleanOr()', () => {
    it('should return true if any field is positive', () => {
      const parser = new SRealityItemsParser([
        { name: 'Lodžie', value: 'Ano' }
      ]);

      const result = parser.getBooleanOr(
        FIELD_NAMES.BALCONY,
        FIELD_NAMES.LOGGIA,
        FIELD_NAMES.TERRACE
      );

      expect(result).toBe(true);
    });

    it('should return false if all fields are negative', () => {
      const parser = new SRealityItemsParser([
        { name: 'Balkón', value: 'Ne' },
        { name: 'Lodžie', value: 'Ne' }
      ]);

      const result = parser.getBooleanOr(
        FIELD_NAMES.BALCONY,
        FIELD_NAMES.LOGGIA,
        FIELD_NAMES.TERRACE
      );

      expect(result).toBe(false);
    });
  });

  describe('getArea()', () => {
    it('should extract area with unit', () => {
      const parser = new SRealityItemsParser([
        { name: 'Plocha', value: '75 m²' }
      ]);

      expect(parser.getArea(FIELD_NAMES.AREA)).toBe(75);
    });

    it('should handle Czech decimal format', () => {
      const parser = new SRealityItemsParser([
        { name: 'Plocha', value: '75,5 m²' }
      ]);

      expect(parser.getArea(FIELD_NAMES.AREA)).toBe(75.5);
    });

    it('should handle plain numbers', () => {
      const parser = new SRealityItemsParser([
        { name: 'Plocha', value: '75' }
      ]);

      expect(parser.getArea(FIELD_NAMES.AREA)).toBe(75);
    });

    it('should return undefined for invalid values', () => {
      const parser = new SRealityItemsParser([
        { name: 'Plocha', value: 'N/A' }
      ]);

      expect(parser.getArea(FIELD_NAMES.AREA)).toBeUndefined();
    });
  });

  describe('getAreaOr()', () => {
    it('should return first available area', () => {
      const parser = new SRealityItemsParser([
        { name: 'Celková plocha', value: '85 m²' }
      ]);

      const result = parser.getAreaOr(
        FIELD_NAMES.LIVING_AREA,
        FIELD_NAMES.TOTAL_AREA,
        FIELD_NAMES.AREA
      );

      expect(result).toBe(85);
    });

    it('should skip invalid values', () => {
      const parser = new SRealityItemsParser([
        { name: 'Užitná plocha', value: 'N/A' },
        { name: 'Plocha', value: '75 m²' }
      ]);

      const result = parser.getAreaOr(
        FIELD_NAMES.LIVING_AREA,
        FIELD_NAMES.AREA
      );

      expect(result).toBe(75);
    });
  });

  describe('has()', () => {
    it('should return true for existing fields', () => {
      const parser = new SRealityItemsParser([
        { name: 'Dispozice', value: '2+kk' }
      ]);

      expect(parser.has(FIELD_NAMES.DISPOSITION)).toBe(true);
    });

    it('should return false for missing fields', () => {
      const parser = new SRealityItemsParser([]);

      expect(parser.has(FIELD_NAMES.DISPOSITION)).toBe(false);
    });
  });

  describe('Performance - Single Pass', () => {
    it('should build map in single O(n) pass', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        name: `Field${i}`,
        value: `Value${i}`
      }));

      const startTime = performance.now();
      const parser = new SRealityItemsParser(items);
      const constructionTime = performance.now() - startTime;

      // Construction should be fast (single pass)
      expect(constructionTime).toBeLessThan(10); // < 10ms

      // Subsequent lookups should be O(1)
      const lookupStart = performance.now();
      parser.getString('Field50' as any);
      const lookupTime = performance.now() - lookupStart;

      expect(lookupTime).toBeLessThan(1); // < 1ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty items array', () => {
      const parser = new SRealityItemsParser([]);

      expect(parser.getString(FIELD_NAMES.DISPOSITION)).toBeUndefined();
      expect(parser.getNumber(FIELD_NAMES.FLOOR)).toBeUndefined();
      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(false);
      expect(parser.getArea(FIELD_NAMES.AREA)).toBeUndefined();
    });

    it('should handle null values', () => {
      const parser = new SRealityItemsParser([
        { name: 'Dispozice', value: null }
      ]);

      expect(parser.getString(FIELD_NAMES.DISPOSITION)).toBeUndefined();
    });

    it('should handle undefined values', () => {
      const parser = new SRealityItemsParser([
        { name: 'Dispozice', value: undefined }
      ]);

      expect(parser.getString(FIELD_NAMES.DISPOSITION)).toBeUndefined();
    });

    it('should handle empty strings', () => {
      const parser = new SRealityItemsParser([
        { name: 'Výtah', value: '' }
      ]);

      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(false);
    });
  });

  describe('Real-world SReality data format', () => {
    it('should handle actual SReality apartment items', () => {
      const parser = new SRealityItemsParser([
        { name: 'Užitná plocha', value: '52', unit: 'm²', type: 'number' },
        { name: 'Podlaží', value: '3. podlaží' },
        { name: 'Výtah', value: 'Ano' },
        { name: 'Balkón', value: '3', unit: 'm²' },
        { name: 'Sklep', value: 'Ano' },
        { name: 'Parkování', value: 'Na pozemku' },
        { name: 'Stav objektu', value: 'Velmi dobrý' },
        { name: 'Vlastnictví', value: 'Osobní' }
      ]);

      expect(parser.getArea(FIELD_NAMES.LIVING_AREA)).toBe(52);
      expect(parser.getString(FIELD_NAMES.FLOOR)).toBe('3. podlaží');
      expect(parser.getBoolean(FIELD_NAMES.ELEVATOR)).toBe(true);
      expect(parser.getArea(FIELD_NAMES.BALCONY)).toBe(3);
      expect(parser.getBoolean(FIELD_NAMES.CELLAR)).toBe(true);
      expect(parser.getString(FIELD_NAMES.CONDITION)).toBe('Velmi dobrý');
      expect(parser.getString(FIELD_NAMES.OWNERSHIP)).toBe('Osobní');
    });
  });
});
