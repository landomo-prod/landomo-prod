/**
 * Type-safe parser for SReality items array
 *
 * Benefits:
 * - Single O(n) pass through items array (vs multiple O(n) searches)
 * - Type-safe field access with autocomplete
 * - Consistent value extraction logic
 * - Easier to test and maintain
 *
 * Usage:
 * ```typescript
 * import { SRealityItemsParser, FIELD_NAMES } from './utils/itemsParser';
 *
 * const parser = new SRealityItemsParser(listing.items || []);
 * const sqm = parser.getArea(FIELD_NAMES.LIVING_AREA);
 * const hasElevator = parser.getBoolean(FIELD_NAMES.ELEVATOR);
 * ```
 */

import { FIELD_NAMES, FieldName, SRealityItemField } from '../types/srealityApiTypes';
import { parseArea, isPositiveValue } from './srealityHelpers';

// Re-export for convenience
export { FIELD_NAMES };

/**
 * Strip Czech diacritics from a string.
 * The SReality API inconsistently returns field names with or without diacritics.
 */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Type-safe parser for SReality items array
 * Provides efficient single-pass parsing with type-safe accessors
 */
export class SRealityItemsParser {
  private itemsMap: Map<string, SRealityItemField>;

  /**
   * Create parser from items array
   * @param items Array of item fields from SReality API
   */
  constructor(items: Array<{ name: string; value: any; unit?: string; type?: string }>) {
    // Build map in single O(n) pass
    // Store both the original name AND the diacritics-stripped version as keys.
    // The SReality API sometimes returns field names without diacritics
    // (e.g. "Rok postaveni" instead of "Rok postavení"), so lookups with
    // either variant must succeed.
    this.itemsMap = new Map();
    for (const item of items) {
      const typed = item as SRealityItemField;
      this.itemsMap.set(item.name, typed);
      const stripped = stripDiacritics(item.name);
      if (stripped !== item.name) {
        this.itemsMap.set(stripped, typed);
      }
    }
  }

  /**
   * Check if a field exists
   * @param field Field name (from FIELD_NAMES)
   * @returns true if field exists
   */
  has(field: FieldName): boolean {
    return this.itemsMap.has(field) || this.itemsMap.has(stripDiacritics(field));
  }

  /**
   * Get raw item object
   * @param field Field name (from FIELD_NAMES)
   * @returns Raw item or undefined
   */
  getRaw(field: FieldName): SRealityItemField | undefined {
    return this.itemsMap.get(field) ?? this.itemsMap.get(stripDiacritics(field));
  }

  /**
   * Get string value from field
   * @param field Field name (from FIELD_NAMES)
   * @returns String value or undefined
   *
   * Example:
   * ```typescript
   * const disposition = parser.getString(FIELD_NAMES.DISPOSITION);
   * // "2+kk"
   * ```
   */
  getString(field: FieldName): string | undefined {
    const item = this.itemsMap.get(field) ?? this.itemsMap.get(stripDiacritics(field));
    if (!item) return undefined;

    return this.extractStringValue(item.value);
  }

  /**
   * Get string value from multiple field candidates (fallback)
   * Tries each field in order, returns first non-undefined value
   *
   * @param fields Array of field names to try
   * @returns String value or undefined
   *
   * Example:
   * ```typescript
   * const sqm = parser.getStringOr([
   *   FIELD_NAMES.LIVING_AREA,
   *   FIELD_NAMES.TOTAL_AREA,
   *   FIELD_NAMES.AREA
   * ]);
   * ```
   */
  getStringOr(...fields: FieldName[]): string | undefined {
    for (const field of fields) {
      const value = this.getString(field);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  /**
   * Get numeric value from field
   * @param field Field name (from FIELD_NAMES)
   * @returns Number or undefined
   *
   * Example:
   * ```typescript
   * const floor = parser.getNumber(FIELD_NAMES.FLOOR);
   * // 3
   * ```
   */
  getNumber(field: FieldName): number | undefined {
    const item = this.itemsMap.get(field) ?? this.itemsMap.get(stripDiacritics(field));
    if (!item) return undefined;

    const value = item.value;

    // Direct number
    if (typeof value === 'number') {
      return value;
    }

    // Parse string to number
    if (typeof value === 'string') {
      const normalized = value.replace(/\s+/g, '').replace(',', '.');
      const parsed = parseFloat(normalized);
      return !isNaN(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  /**
   * Get numeric value from multiple field candidates (fallback)
   * @param fields Array of field names to try
   * @returns Number or undefined
   */
  getNumberOr(...fields: FieldName[]): number | undefined {
    for (const field of fields) {
      const value = this.getNumber(field);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  /**
   * Get boolean value from field
   * Handles Czech yes/no values and numeric indicators
   *
   * @param field Field name (from FIELD_NAMES)
   * @returns true if positive value, false otherwise (never undefined)
   *
   * Positive indicators:
   * - "Ano", "ano", "Yes", "yes", "true"
   * - Numbers > 0
   * - "connected"
   *
   * Negative indicators:
   * - "Ne", "no", "false"
   * - Numbers <= 0
   * - undefined, null, empty string
   *
   * Example:
   * ```typescript
   * const hasElevator = parser.getBoolean(FIELD_NAMES.ELEVATOR);
   * // true if "Ano", 1, "Yes", etc.
   * // false if "Ne", 0, undefined, etc.
   * ```
   */
  getBoolean(field: FieldName): boolean {
    const item = this.itemsMap.get(field) ?? this.itemsMap.get(stripDiacritics(field));
    if (!item) return false;

    return isPositiveValue(item.value);
  }

  /**
   * Get boolean value from multiple field candidates (fallback)
   * Returns true if ANY field has a positive value
   *
   * @param fields Array of field names to try
   * @returns true if any field is positive, false otherwise
   */
  getBooleanOr(...fields: FieldName[]): boolean {
    for (const field of fields) {
      if (this.getBoolean(field)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get area value (handles Czech area formats)
   * @param field Field name (from FIELD_NAMES)
   * @returns Area in square meters or undefined
   *
   * Handles formats:
   * - "150 m²" → 150
   * - "150,5 m²" → 150.5
   * - "150" → 150
   * - 150 → 150
   *
   * Example:
   * ```typescript
   * const sqm = parser.getArea(FIELD_NAMES.LIVING_AREA);
   * // 75.5
   * ```
   */
  getArea(field: FieldName): number | undefined {
    const stringValue = this.getString(field);
    if (!stringValue) return undefined;

    return parseArea(stringValue);
  }

  /**
   * Get area value from multiple field candidates (fallback)
   * @param fields Array of field names to try
   * @returns Area in square meters or undefined
   *
   * Example:
   * ```typescript
   * const sqm = parser.getAreaOr(
   *   FIELD_NAMES.LIVING_AREA,
   *   FIELD_NAMES.TOTAL_AREA,
   *   FIELD_NAMES.AREA
   * );
   * ```
   */
  getAreaOr(...fields: FieldName[]): number | undefined {
    for (const field of fields) {
      const value = this.getArea(field);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  /**
   * Get all items as a map
   * @returns Map of field name to item
   */
  getAll(): Map<string, SRealityItemField> {
    return this.itemsMap;
  }

  /**
   * Get all field names that exist
   * @returns Array of field names
   */
  getFieldNames(): string[] {
    return Array.from(this.itemsMap.keys());
  }

  /**
   * Extract string value from various formats
   * Handles string, object with value property, arrays
   */
  private extractStringValue(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;

    // Direct string
    if (typeof value === 'string') return value;

    // Number to string
    if (typeof value === 'number') return String(value);

    // Object with value property
    if (typeof value === 'object' && 'value' in value) {
      return this.extractStringValue(value.value);
    }

    // Array - take first item
    if (Array.isArray(value) && value.length > 0) {
      const firstItem = value[0];
      if (typeof firstItem === 'string') return firstItem;
      if (typeof firstItem === 'object' && 'value' in firstItem) {
        return this.extractStringValue(firstItem.value);
      }
    }

    // Fallback: convert to string
    return String(value);
  }
}
