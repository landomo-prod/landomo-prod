import { OikotieCard, CARD_TYPES, BUILDING_TYPES } from '../types/etuoviTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from Oikotie card.
 *
 * cardType mapping:
 *   100 = for-sale → subtype determines apartment vs house
 *   101 = rental   → subtype determines apartment vs house
 *   102 = holiday/cottage → house
 *   103 = rental other → commercial
 *   104 = land/plots → land
 *   105 = commercial → commercial
 *
 * cardSubType (buildingType) for sale/rental:
 *   1  (Kerrostalo)    → apartment
 *   2  (Rivitalo)      → house
 *   4  (Omakotitalo)   → house
 *   8  (Paritalo)      → house
 *   16 (Luhtitalo)     → apartment
 *   32 (Erillistalo)   → house
 *   64 (Puutalo-osake) → apartment
 *   256 (Other)        → apartment (default)
 */
export function detectCategory(card: OikotieCard): PropertyCategory {
  const { cardType, cardSubType } = card;

  // Land plots
  if (cardType === CARD_TYPES.LAND_SALE) {
    return 'land';
  }

  // Commercial
  if (cardType === CARD_TYPES.COMMERCIAL || cardType === CARD_TYPES.RENT_OTHER) {
    return 'commercial';
  }

  // Holiday/cottage → house
  if (cardType === CARD_TYPES.HOLIDAY_SALE) {
    return 'house';
  }

  // For sale or rental (cardType 100 or 101) — use building sub-type
  if (cardType === CARD_TYPES.SALE || cardType === CARD_TYPES.RENT) {
    return buildingSubTypeToCategory(cardSubType);
  }

  // Default fallback
  return 'apartment';
}

/**
 * Map building sub-type bitmask to property category.
 * Building types can be combined as bit flags.
 */
function buildingSubTypeToCategory(subType: number): PropertyCategory {
  // House building types: 2=Rivitalo, 4=Omakotitalo, 8=Paritalo, 32=Erillistalo
  const houseTypes = BUILDING_TYPES.RIVITALO | BUILDING_TYPES.OMAKOTITALO |
    BUILDING_TYPES.PARITALO | BUILDING_TYPES.ERILLISTALO;

  // Apartment building types: 1=Kerrostalo, 16=Luhtitalo, 64=Puutalo-osake, 256=Other
  const apartmentTypes = BUILDING_TYPES.KERROSTALO | BUILDING_TYPES.LUHTITALO |
    BUILDING_TYPES.PUUTALO_OSAKE | BUILDING_TYPES.OTHER;

  // Check if any house type bits are set
  if (subType & houseTypes) {
    // If it also has apartment bits, the primary/dominant type wins
    // Row house (rivitalo, paritalo) → house; apartment block → apartment
    return 'house';
  }

  // Default to apartment for kerrostalo and unknown types
  return 'apartment';
}
