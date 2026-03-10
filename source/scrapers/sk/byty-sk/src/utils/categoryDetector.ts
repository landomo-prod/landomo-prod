import { BytyListing } from '../types/bytyTypes';

/**
 * Category Detection for Byty.sk Listings
 *
 * Uses explicit propertyType field from scraper
 * Simple 1:1 mapping with 100% accuracy
 */

export type PropertyCategory = 'apartment' | 'house' | 'land';

/**
 * Detect property category from Byty.sk listing
 *
 * Byty.sk propertyType values:
 * - byty → apartment
 * - domy → house
 * - pozemky → land
 */
export function detectCategory(listing: BytyListing): PropertyCategory {
  const propertyType = listing.propertyType?.toLowerCase();

  // Direct mapping (100% accuracy)
  if (propertyType === 'byty') return 'apartment';
  if (propertyType === 'domy') return 'house';
  if (propertyType === 'pozemky') return 'land';

  // Fallback (should rarely happen)
  console.warn(`Unknown propertyType: ${propertyType}, defaulting to apartment`);
  return 'apartment';
}
