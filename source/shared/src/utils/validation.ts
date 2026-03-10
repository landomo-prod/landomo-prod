/**
 * Runtime Validation for StandardProperty
 *
 * Lightweight runtime checks -- NOT a full JSON-Schema validator.
 * Catches the most common scraper mistakes before data reaches ingest.
 */

import { StandardProperty } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a StandardProperty object at runtime.
 * Returns { valid: true, errors: [] } when all required fields pass checks.
 */
export function validateStandardProperty(property: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!property || typeof property !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Property must be a non-null object' }] };
  }

  // Required fields
  if (!property.title || typeof property.title !== 'string') {
    errors.push({ field: 'title', message: 'title is required and must be a string' });
  }

  if (property.price === undefined || property.price === null || typeof property.price !== 'number') {
    errors.push({ field: 'price', message: 'price is required and must be a number' });
  } else if (property.price < 0) {
    errors.push({ field: 'price', message: 'price must not be negative' });
  }

  if (!property.currency || typeof property.currency !== 'string') {
    errors.push({ field: 'currency', message: 'currency is required and must be a string' });
  }

  if (!property.property_type || typeof property.property_type !== 'string') {
    errors.push({ field: 'property_type', message: 'property_type is required and must be a string' });
  }

  if (!property.transaction_type || !['sale', 'rent'].includes(property.transaction_type)) {
    errors.push({ field: 'transaction_type', message: 'transaction_type is required and must be "sale" or "rent"' });
  }

  // Location validation
  if (!property.location || typeof property.location !== 'object') {
    errors.push({ field: 'location', message: 'location is required and must be an object' });
  } else {
    if (!property.location.city || typeof property.location.city !== 'string') {
      errors.push({ field: 'location.city', message: 'location.city is required and must be a string' });
    }
    if (!property.location.country || typeof property.location.country !== 'string') {
      errors.push({ field: 'location.country', message: 'location.country is required and must be a string' });
    }
    if (property.location.coordinates) {
      const coords = property.location.coordinates;
      if (typeof coords.lat !== 'number' || typeof coords.lon !== 'number') {
        errors.push({ field: 'location.coordinates', message: 'coordinates.lat and coordinates.lon must be numbers' });
      } else {
        if (coords.lat < -90 || coords.lat > 90) {
          errors.push({ field: 'location.coordinates.lat', message: 'latitude must be between -90 and 90' });
        }
        if (coords.lon < -180 || coords.lon > 180) {
          errors.push({ field: 'location.coordinates.lon', message: 'longitude must be between -180 and 180' });
        }
      }
    }
  }

  // Details validation (optional object, but when present fields must be sane)
  if (property.details && typeof property.details === 'object') {
    const d = property.details;
    if (d.bedrooms !== undefined && (typeof d.bedrooms !== 'number' || d.bedrooms < 0)) {
      errors.push({ field: 'details.bedrooms', message: 'bedrooms must be a non-negative number' });
    }
    if (d.bathrooms !== undefined && (typeof d.bathrooms !== 'number' || d.bathrooms < 0)) {
      errors.push({ field: 'details.bathrooms', message: 'bathrooms must be a non-negative number' });
    }
    if (d.sqm !== undefined && (typeof d.sqm !== 'number' || d.sqm < 0)) {
      errors.push({ field: 'details.sqm', message: 'sqm must be a non-negative number' });
    }
    if (d.year_built !== undefined && typeof d.year_built === 'number') {
      if (d.year_built < 1000 || d.year_built > new Date().getFullYear() + 5) {
        errors.push({ field: 'details.year_built', message: `year_built must be between 1000 and ${new Date().getFullYear() + 5}` });
      }
    }
  }

  // Status validation
  if (property.status && !['active', 'removed', 'sold', 'rented'].includes(property.status)) {
    errors.push({ field: 'status', message: 'status must be one of: active, removed, sold, rented' });
  }

  // Source URL format (loose check)
  if (property.source_url && typeof property.source_url === 'string') {
    if (!property.source_url.startsWith('http://') && !property.source_url.startsWith('https://')) {
      errors.push({ field: 'source_url', message: 'source_url must start with http:// or https://' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
