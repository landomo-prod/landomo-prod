import { KMListing } from '../types/kiinteistomaailmaTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from a Kiinteistömaailma listing.
 *
 * Property type codes:
 *   KT = Kerrostalo (apartment block)           → apartment
 *   RT = Rivitalo (row house)                   → house
 *   PT = Paritalo (semi-detached)               → house
 *   OT = Omakotitalo (detached/single-family)   → house
 *   ET = Erillistalo (detached variant)         → house
 *   MO = Mökki/Huvila (cottage/villa)           → house
 *   TO = Tontti (land plot)                     → land
 *
 * Group codes:
 *   To = Tontti (land)                          → land
 *   Va = Vapaa-ajan (vacation)                  → house
 *   As = Asunto (apartment/house) → use type code
 *
 * Kiinteistömaailma does not carry commercial (liiketila) listings — it is a
 * residential-only agency chain. The 'commercial' category is kept for
 * completeness in case future API changes introduce it.
 */
export function detectCategory(listing: KMListing): PropertyCategory {
  // Land plots — detected by group or type code
  if (listing.group === 'To' || listing.type === 'TO') return 'land';

  // Kerrostalo → apartment
  if (listing.type === 'KT') return 'apartment';

  // Row house, semi-detached, detached, cottage → house
  if (
    listing.type === 'RT' ||
    listing.type === 'PT' ||
    listing.type === 'OT' ||
    listing.type === 'ET' ||
    listing.type === 'MO'
  ) {
    return 'house';
  }

  // Vacation properties (group Va) without explicit type → house
  if (listing.group === 'Va') return 'house';

  // isApartment flag as secondary signal
  if (listing.isApartment) return 'apartment';

  // Default fallback for unknown types
  return 'apartment';
}

/**
 * Get human-readable Finnish property type name.
 */
export function getFinnishTypeName(listing: KMListing): string {
  const typeNames: Record<string, string> = {
    KT: 'Kerrostalo',
    RT: 'Rivitalo',
    PT: 'Paritalo',
    OT: 'Omakotitalo',
    ET: 'Erillistalo',
    MO: 'Mökki/Huvila',
    TO: 'Tontti',
  };
  return typeNames[listing.type] ?? 'Asunto';
}
