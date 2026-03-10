/**
 * Slovak-Specific Property Type Guards and Constants
 *
 * Note: SlovakSpecificFields interface is defined in property.ts
 * This file provides type guards, validation constants, and helper types.
 */

import { StandardProperty } from '../property';

/**
 * Slovakia-specific property extensions (indexed DB columns)
 */
export interface SlovakPropertyExtensions {
  slovak_disposition?: string;
  slovak_ownership?: string;
}

/**
 * Combined Slovak property type
 */
export type SlovakProperty = StandardProperty & SlovakPropertyExtensions;

/**
 * Type guard to check if property has Slovak-specific fields
 */
export function isSlovakProperty(property: any): boolean {
  return property?.location?.country === 'Slovakia' ||
         property?.source_platform?.includes('-sk');
}

/**
 * Slovak disposition types (room layout)
 */
export const SLOVAK_DISPOSITION_TYPES = [
  '1-izbovy',
  '2-izbovy',
  '3-izbovy',
  '4-izbovy',
  '5-izbovy',
  '6-izbovy',
  'garsonka',
  'mezonet',
  'atypicky',
] as const;

export type SlovakDispositionType = typeof SLOVAK_DISPOSITION_TYPES[number];

/**
 * Slovak ownership types
 */
export const SLOVAK_OWNERSHIP_TYPES = [
  'personal',
  'cooperative',
  'state',
  'municipal',
  'other',
] as const;

export type SlovakOwnershipType = typeof SLOVAK_OWNERSHIP_TYPES[number];

/**
 * Slovak condition types
 */
export const SLOVAK_CONDITION_TYPES = [
  'new',
  'excellent',
  'very_good',
  'good',
  'after_renovation',
  'after_partial_renovation',
  'before_renovation',
  'original',
  'under_construction',
  'neglected',
] as const;

export type SlovakConditionType = typeof SLOVAK_CONDITION_TYPES[number];

/**
 * Slovak heating types
 */
export const SLOVAK_HEATING_TYPES = [
  'central_heating',
  'individual_heating',
  'electric_heating',
  'gas_heating',
  'floor_heating',
  'heat_pump',
  'district_heating',
  'solid_fuel',
  'solar',
  'other',
  'none',
] as const;

export type SlovakHeatingType = typeof SLOVAK_HEATING_TYPES[number];
