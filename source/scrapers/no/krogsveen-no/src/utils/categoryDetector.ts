import { KrogsveenEstate } from '../types/krogsveenTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Krogsveen bsrPropertyType → Landomo category mapping
 *
 * bsrPropertyType values (confirmed via GraphQL introspection + live data):
 *   "leilighet"         → apartment
 *   "rekkehus"          → house  (townhouse / terraced house)
 *   "tomannsbolig"      → house  (semi-detached / duplex)
 *   "enebolig"          → house  (detached house)
 *   "hytter/fritid"     → house  (cabin / leisure property)
 *   "gårdsbruk/småbruk" → house  (farm / smallholding)
 *   "annet"             → house  (other — safe fallback)
 *   "tomt"              → land   (plot)
 *
 * commissionType provides secondary signal:
 *   "COMMERCIAL_FOR_SALE" → commercial
 */
export function detectCategory(estate: KrogsveenEstate): PropertyCategory {
  // Commercial signal from commission type takes priority
  if (estate.commissionType === 'COMMERCIAL_FOR_SALE') {
    return 'commercial';
  }

  const propType = (estate.bsrPropertyType || '').toLowerCase().trim();

  switch (propType) {
    case 'leilighet':
      return 'apartment';

    case 'tomt':
      return 'land';

    case 'enebolig':
    case 'rekkehus':
    case 'tomannsbolig':
    case 'hytter/fritid':
    case 'gårdsbruk/småbruk':
    case 'annet':
      return 'house';

    default:
      // Fallback: check typeName for additional cues
      const typeLower = (estate.typeName || '').toLowerCase();
      if (typeLower.includes('leilighet') || typeLower.includes('hybel')) {
        return 'apartment';
      }
      if (typeLower.includes('tomt') || typeLower.includes('fritidstomt')) {
        return 'land';
      }
      if (typeLower.includes('næring')) {
        return 'commercial';
      }
      // Default: apartment (most common residential type)
      return 'apartment';
  }
}
