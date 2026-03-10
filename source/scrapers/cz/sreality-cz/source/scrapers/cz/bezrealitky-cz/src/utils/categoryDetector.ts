import { BezRealitkyListingItem } from '../types/bezrealitkyTypes';

/**
 * Category Detection for Bezrealitky Listings
 *
 * Uses explicit enum-based detection (100% accuracy)
 * NO heuristics needed - GraphQL provides explicit estateType field
 */

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial' | 'recreational';

/**
 * Detect property category from BezRealitky listing
 *
 * Bezrealitky advantage: Explicit enum values (no ambiguity)
 * - BYT → apartment
 * - DUM → house
 * - POZEMEK → land
 * - GARAZ/KANCELAR/NEBYTOVY_PROSTOR → commercial
 * - REKREACNI_OBJEKT → recreational
 */
export function detectCategory(listing: BezRealitkyListingItem): PropertyCategory {
  const estateType = listing.estateType;

  // Direct mapping (100% accuracy)
  if (estateType === 'BYT') return 'apartment';
  if (estateType === 'DUM') return 'house';
  if (estateType === 'POZEMEK') return 'land';

  if (
    estateType === 'GARAZ' ||
    estateType === 'KANCELAR' ||
    estateType === 'NEBYTOVY_PROSTOR'
  ) {
    return 'commercial';
  }

  if (estateType === 'REKREACNI_OBJEKT') return 'recreational';

  // Fallback (should never happen with GraphQL data)
  console.warn(JSON.stringify({ level: 'warn', service: 'bezrealitky-scraper', msg: 'Unknown estateType, falling back to apartment', estateType, id: listing.id }));
  return 'apartment';
}
