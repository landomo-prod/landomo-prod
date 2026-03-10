/**
 * Austrian-Specific Property Type Guards and Constants
 *
 * Note: AustrianSpecificFields interface is defined in property.ts
 * This file provides type guards, validation constants, and helper types.
 */

/**
 * Type guard to check if property has Austrian-specific fields
 */
export function isAustrianProperty(property: any): boolean {
  return property?.location?.country === 'Austria' ||
         property?.source_platform?.includes('-at');
}

/**
 * Austrian property condition types
 */
export const AUSTRIAN_CONDITION_TYPES = [
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
 * Austrian ownership types
 */
export const AUSTRIAN_OWNERSHIP_TYPES = [
  'eigentumsrecht',
  'baurecht',
  'mietkauf',
  'erbpacht',
  'genossenschaft',
  'other'
] as const;

/**
 * Austrian heating types
 */
export const AUSTRIAN_HEATING_TYPES = [
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

export type AustrianConditionType = typeof AUSTRIAN_CONDITION_TYPES[number];
export type AustrianOwnershipType = typeof AUSTRIAN_OWNERSHIP_TYPES[number];
export type AustrianHeatingType = typeof AUSTRIAN_HEATING_TYPES[number];
