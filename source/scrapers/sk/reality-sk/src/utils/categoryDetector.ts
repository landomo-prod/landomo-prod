import { RealityListing } from '../types/realityTypes';

/**
 * Category Detection for Reality.sk Listings
 *
 * Uses propertyType field which is extracted from URL structure
 * Reality.sk URL format: /byty/predaj, /domy/predaj, /pozemky/predaj
 */

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from Reality.sk listing
 *
 * Reality.sk property types:
 * - byty → apartment
 * - domy → house
 * - pozemky → land
 * - chaty-chalupy → house (recreational properties with land)
 * - kancelarie → house (commercial, currently mapped to house for safety)
 * - garaze → house (garages, currently mapped to house for safety)
 */
export function detectCategory(listing: RealityListing): PropertyCategory {
  const propertyType = listing.propertyType?.toLowerCase() || '';

  // Direct mapping based on URL category
  if (propertyType.includes('byt')) return 'apartment';
  if (propertyType.includes('pozemk')) return 'land';

  // Commercial properties
  if (
    propertyType.includes('kancelarie') ||
    propertyType.includes('komercn') ||
    propertyType.includes('obchodn')
  ) {
    return 'commercial';
  }

  // Houses and house-like properties
  if (
    propertyType.includes('dom') ||
    propertyType.includes('chaty') ||
    propertyType.includes('chalupy') ||
    propertyType.includes('garaz')
  ) {
    return 'house';
  }

  // Fallback: default to house (most generic category)
  return 'house';
}
