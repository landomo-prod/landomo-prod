/**
 * German-Specific Property Type Guards and Constants
 *
 * Note: GermanSpecificFields interface is defined in property.ts
 * This file provides type guards, validation constants, and helper types.
 */

/**
 * Type guard to check if property has German-specific fields
 */
export function isGermanProperty(property: any): boolean {
  return property?.location?.country === 'Germany' ||
         property?.source_platform?.includes('-de');
}

/**
 * German property condition types
 */
export const GERMAN_CONDITION_TYPES = [
  'new',
  'excellent',
  'very_good',
  'good',
  'after_renovation',
  'before_renovation',
  'requires_renovation',
  'project',
  'under_construction',
  'newly_renovated'
] as const;

/**
 * German ownership types
 */
export const GERMAN_OWNERSHIP_TYPES = [
  'eigentum',
  'erbbaurecht',
  'mietkauf',
  'genossenschaft',
  'wohnungseigentum',
  'other'
] as const;

/**
 * German heating types
 */
export const GERMAN_HEATING_TYPES = [
  'central_heating',
  'individual_heating',
  'electric_heating',
  'gas_heating',
  'hot_water',
  'water_heating',
  'heat_pump',
  'district_heating',
  'oil_heating',
  'floor_heating',
  'other',
  'none',
  'unknown'
] as const;

export type GermanConditionType = typeof GERMAN_CONDITION_TYPES[number];
export type GermanOwnershipType = typeof GERMAN_OWNERSHIP_TYPES[number];
export type GermanHeatingType = typeof GERMAN_HEATING_TYPES[number];
