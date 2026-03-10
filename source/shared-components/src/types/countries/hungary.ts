/**
 * Hungarian-Specific Property Type Guards and Constants
 *
 * Note: HungarianSpecificFields interface is defined in property.ts
 * This file provides type guards, validation constants, and helper types.
 */

import { StandardProperty } from '../property';

/**
 * Hungary-specific property extensions (indexed DB columns)
 */
export interface HungarianPropertyExtensions {
  hungarian_room_count?: string;
  hungarian_ownership?: string;
}

/**
 * Combined Hungarian property type
 */
export type HungarianProperty = StandardProperty & HungarianPropertyExtensions;

/**
 * Type guard to check if property has Hungarian-specific fields
 */
export function isHungarianProperty(property: any): boolean {
  return property?.location?.country === 'Hungary' ||
         property?.source_platform?.includes('-hu');
}

/**
 * Hungarian room count types
 */
export const HUNGARIAN_ROOM_COUNT_TYPES = [
  '1',
  '1+1',
  '1+2',
  '2',
  '2+1',
  '2+2',
  '3',
  '3+1',
  '3+2',
  '4',
  '4+1',
  '5',
  '5+',
  '6+',
] as const;

export type HungarianRoomCountType = typeof HUNGARIAN_ROOM_COUNT_TYPES[number];

/**
 * Hungarian ownership types
 */
export const HUNGARIAN_OWNERSHIP_TYPES = [
  'freehold',
  'cooperative',
  'municipal',
  'state',
  'condominium',
  'shared_ownership',
  'usufruct',
  'other',
] as const;

export type HungarianOwnershipType = typeof HUNGARIAN_OWNERSHIP_TYPES[number];

/**
 * Hungarian condition types
 */
export const HUNGARIAN_CONDITION_TYPES = [
  'new',
  'new_build',
  'like_new',
  'renovated',
  'fully_renovated',
  'partially_renovated',
  'good',
  'average',
  'acceptable',
  'needs_renovation',
  'poor',
  'under_construction',
  'move_in_ready',
] as const;

export type HungarianConditionType = typeof HUNGARIAN_CONDITION_TYPES[number];

/**
 * Hungarian heating types
 */
export const HUNGARIAN_HEATING_TYPES = [
  'central',
  'district',
  'individual',
  'gas',
  'gas_circo',
  'gas_convector',
  'gas_boiler',
  'electric',
  'floor_heating',
  'heat_pump',
  'mixed',
  'solid_fuel',
  'wood',
  'oil',
  'fireplace',
  'stove',
  'solar',
  'none',
] as const;

export type HungarianHeatingType = typeof HUNGARIAN_HEATING_TYPES[number];

/**
 * Hungarian comfort level types
 */
export const HUNGARIAN_COMFORT_LEVELS = [
  'luxury',
  'double_comfort',
  'full_comfort',
  'comfort',
  'half_comfort',
  'no_comfort',
] as const;

export type HungarianComfortLevel = typeof HUNGARIAN_COMFORT_LEVELS[number];
