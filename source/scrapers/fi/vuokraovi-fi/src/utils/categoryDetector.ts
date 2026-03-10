import { VuokrauviPropertySubtype, APARTMENT_SUBTYPES, HOUSE_SUBTYPES } from '../types/vuokrauviTypes';

export type ListingCategory = 'apartment' | 'house';

/**
 * Determine the Landomo property category from a Vuokraovi propertySubtype.
 *
 * Apartment subtypes (property_category: 'apartment'):
 *   APARTMENT_HOUSE - Kerrostalo (apartment block)
 *   LOFT_HOUSE      - Luhtitalo (corridor-access house)
 *   WOODEN_HOUSE    - Puutalo-osake (wooden apartment share)
 *   OTHER           - fallback
 *
 * House subtypes (property_category: 'house'):
 *   ROW_HOUSE       - Rivitalo (row house)
 *   SEMI_DETACHED   - Paritalo (semi-detached)
 *   DETACHED_HOUSE  - Omakotitalo (detached house)
 */
export function detectCategory(subtype: VuokrauviPropertySubtype): ListingCategory {
  if ((HOUSE_SUBTYPES as string[]).includes(subtype)) {
    return 'house';
  }
  return 'apartment';
}

/**
 * Map propertySubtype to a human-readable Finnish building type label.
 */
export function getBuildingTypeLabel(subtype: VuokrauviPropertySubtype): string {
  const labels: Record<VuokrauviPropertySubtype, string> = {
    APARTMENT_HOUSE: 'Kerrostalo',
    ROW_HOUSE: 'Rivitalo',
    SEMI_DETACHED: 'Paritalo',
    DETACHED_HOUSE: 'Omakotitalo',
    LOFT_HOUSE: 'Luhtitalo',
    WOODEN_HOUSE: 'Puutalo-osake',
    OTHER: 'Muu',
  };
  return labels[subtype] || 'Muu';
}
