import { BoligsidenCase, ADDRESS_TYPE_CATEGORIES } from '../types/boligsidenTypes';

/**
 * Category Detection for Boligsiden Listings
 *
 * Uses the addressType field from the Boligsiden REST API.
 *
 * Boligsiden addressType → landomo category mapping:
 * - villa           → house
 * - condo           → apartment
 * - terraced house  → house (townhouse)
 * - holiday house   → house (recreational/fritidsbolig)
 * - full year plot  → land (helårsgrund)
 * - holiday plot    → land (sommerhusgrund)
 * - cattle farm     → house (kvæggård)
 * - farm            → house (landbrug)
 * - hobby farm      → house (hobbyland)
 */
export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from Boligsiden listing
 */
export function detectCategory(listing: BoligsidenCase): PropertyCategory {
  const addressType = listing.addressType?.toLowerCase() || '';

  const category = ADDRESS_TYPE_CATEGORIES[addressType];

  if (category === 'apartment') return 'apartment';
  if (category === 'house') return 'house';
  if (category === 'land') return 'land';
  if (category === 'commercial') return 'commercial';

  // Fallback based on keywords in addressType
  if (addressType.includes('condo') || addressType.includes('apartment')) return 'apartment';
  if (addressType.includes('plot') || addressType.includes('land') || addressType.includes('grund')) return 'land';
  if (addressType.includes('commercial') || addressType.includes('erhverv')) return 'commercial';

  // Default to house for unknown types (most listings are houses)
  console.warn(JSON.stringify({
    level: 'warn',
    service: 'boligsiden-scraper',
    msg: 'Unknown addressType, defaulting to house',
    addressType,
    caseID: listing.caseID,
  }));
  return 'house';
}
