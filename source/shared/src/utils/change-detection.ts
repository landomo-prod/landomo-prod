/**
 * Change Detection Utilities
 * Detect what changed between old and new property data
 */

export interface ChangeDetectionResult {
  hasChanges: boolean;
  fields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
}

/**
 * Detect changes between old and new property data
 */
export function detectChanges(
  oldData: any,
  newData: any,
  fieldsToCheck?: string[]
): ChangeDetectionResult {
  const result: ChangeDetectionResult = {
    hasChanges: false,
    fields: [],
    oldValues: {},
    newValues: {}
  };

  if (!oldData || !newData) {
    return result;
  }

  // Default fields to check
  const defaultFields = [
    'title',
    'price',
    'description',
    'images',
    'bedrooms',
    'bathrooms',
    'sqm',
    'features',
    'status'
  ];

  const fields = fieldsToCheck || defaultFields;

  for (const field of fields) {
    const oldValue = getNestedValue(oldData, field);
    const newValue = getNestedValue(newData, field);

    if (!isEqual(oldValue, newValue)) {
      result.hasChanges = true;
      result.fields.push(field);
      result.oldValues[field] = oldValue;
      result.newValues[field] = newValue;
    }
  }

  return result;
}

/**
 * Get nested object value by dot notation (e.g., "location.city")
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj) return undefined;

  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Deep equality check
 */
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => isEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Check if a price changed significantly (more than threshold)
 */
export function isPriceChangeSignificant(
  oldPrice: number,
  newPrice: number,
  thresholdPercent: number = 5
): boolean {
  if (!oldPrice || !newPrice) return false;
  const percentChange = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
  return percentChange >= thresholdPercent;
}
