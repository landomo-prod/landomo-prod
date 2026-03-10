/**
 * Property Validator - Simplified version
 *
 * Validates StandardProperty objects before ingestion
 * Note: Non-blocking - validation failures are logged but don't stop ingestion
 */

import { StandardProperty } from '@landomo/core';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a StandardProperty object
 *
 * Simplified validator that checks only critical required fields
 * to avoid type mismatches with evolving StandardProperty interface
 */
export function validateProperty(property: StandardProperty): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!property.title || property.title.trim().length === 0) {
    errors.push('Missing or empty title');
  }

  if (property.price === undefined || property.price === null) {
    errors.push('Missing price');
  }

  if (property.price !== undefined && property.price < 0) {
    errors.push('Negative price not allowed');
  }

  if (!property.currency) {
    errors.push('Missing currency');
  }

  if (!property.property_type) {
    errors.push('Missing property_type');
  }

  // Warnings for recommended fields
  if (!property.description) {
    warnings.push('Missing description');
  }

  if (!property.location) {
    warnings.push('Missing location');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
