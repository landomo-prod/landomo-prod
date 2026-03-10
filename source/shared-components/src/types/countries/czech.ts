import { StandardProperty } from '../property';

/**
 * Czech Republic specific property extensions
 */
export interface CzechPropertyExtensions {
  // Structured columns (indexed, queryable)
  czech_disposition?: string;           // "1+kk", "2+1", "3+kk", "4+1"
  czech_ownership?: string;             // "Osobní", "Družstevní", "Státní"
}

/**
 * Complete Czech property type
 */
export type CzechProperty = StandardProperty & CzechPropertyExtensions;

/**
 * Type guard to check if property has Czech extensions
 */
export function isCzechProperty(property: StandardProperty): property is CzechProperty {
  return 'czech_disposition' in property || 'czech_ownership' in property;
}

/**
 * Disposition types (for validation)
 */
export const CZECH_DISPOSITION_TYPES = [
  '1+kk', '1+1',
  '2+kk', '2+1',
  '3+kk', '3+1',
  '4+kk', '4+1',
  '5+kk', '5+1',
  '6+kk', '6+1'
] as const;

export type CzechDisposition = typeof CZECH_DISPOSITION_TYPES[number];

/**
 * Ownership types (for validation)
 */
export const CZECH_OWNERSHIP_TYPES = [
  'Osobní',
  'Družstevní',
  'Státní'
] as const;

export type CzechOwnership = typeof CZECH_OWNERSHIP_TYPES[number];
