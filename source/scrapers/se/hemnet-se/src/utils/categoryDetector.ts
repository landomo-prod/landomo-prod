import { HemnetListing, HousingFormGroup } from '../types/hemnetTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from Hemnet listing.
 *
 * Hemnet uses housing form groups to classify listings:
 * - APARTMENTS group → apartment
 * - HOUSES, ROW_HOUSES, VACATION_HOMES, OTHERS, HOMESTEADS groups → house
 * - PLOTS group → land
 *
 * Swedish housing form names:
 *   Lägenhet       → apartment
 *   Villa          → house
 *   Radhus         → house (row house / townhouse)
 *   Kedjehus       → house (chain house - attached on one side)
 *   Parhus         → house (semi-detached / duplex)
 *   Fritidshus     → house (recreational cottage)
 *   Vinterbonat fritidshus → house (year-round cabin)
 *   Gård/skog      → house (farm/forest estate)
 *   Tomt           → land (building plot)
 *   Övrig          → house (other residential)
 */
export function detectCategory(listing: HemnetListing): PropertyCategory {
  const groups = listing.housingForm.groups as HousingFormGroup[];
  const name = listing.housingForm.name;

  // Check for PLOTS group first (most specific)
  if (groups.includes('PLOTS')) {
    return 'land';
  }

  // APARTMENTS group
  if (groups.includes('APARTMENTS')) {
    return 'apartment';
  }

  // All remaining groups (HOUSES, ROW_HOUSES, VACATION_HOMES, OTHERS, HOMESTEADS) → house
  if (
    groups.includes('HOUSES') ||
    groups.includes('ROW_HOUSES') ||
    groups.includes('VACATION_HOMES') ||
    groups.includes('OTHERS') ||
    groups.includes('HOMESTEADS')
  ) {
    return 'house';
  }

  // Fallback: use housing form name
  const nameLower = name.toLowerCase();
  if (nameLower.includes('lägenhet')) return 'apartment';
  if (nameLower.includes('tomt')) return 'land';

  // Default to house for unknown types
  console.warn(JSON.stringify({
    level: 'warn',
    service: 'hemnet-scraper',
    msg: 'Unknown housing form, defaulting to house',
    name,
    groups,
    id: listing.id,
  }));
  return 'house';
}

/**
 * Get property subtype from Swedish housing form name
 */
export function getPropertySubtype(listing: HemnetListing): string | undefined {
  const name = listing.housingForm.name;

  const subtypeMap: Record<string, string> = {
    'Lägenhet': 'apartment',
    'Villa': 'villa',
    'Radhus': 'townhouse',
    'Kedjehus': 'terraced',
    'Parhus': 'semi_detached',
    'Fritidshus': 'vacation_home',
    'Vinterbonat fritidshus': 'vacation_home',
    'Gård/skog': 'farm',
    'Tomt': 'building_plot',
    'Övrig': 'other',
  };

  return subtypeMap[name];
}
