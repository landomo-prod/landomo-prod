import { OikotieCard } from '../types/oikotieTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from Oikotie card.
 *
 * Oikotie API cardType/cardSubType mapping (from network investigation):
 *
 * cardType 100 (for sale) / 101 (rental):
 *   cardSubType 1   → Kerrostalo (apartment block)      → apartment
 *   cardSubType 2   → Rivitalo (row house)              → house
 *   cardSubType 4   → Omakotitalo (detached house)      → house
 *   cardSubType 32  → Multi-floor villa / huvila         → house
 *   cardSubType 64  → Paritalo (semi-detached)          → house
 *   cardSubType 256 → Other house type                  → house
 *
 * cardType 102 → Tontti (land plot)                     → land
 * cardType 103 → Liiketila (commercial space)           → commercial
 * cardType 104 → Loma-asunto (vacation) - treated by subtype (mostly house)
 *
 * listingType in meta:
 *   1 = freehold house (omistusasunto)
 *   3 = housing company share (kerrostalo/rivitalo)
 *   4 = rental
 */
export function detectCategory(card: OikotieCard): PropertyCategory {
  const { cardType, cardSubType } = card;

  // Land plots
  if (cardType === 102) return 'land';

  // Commercial spaces
  if (cardType === 103) return 'commercial';

  // For sale (100), rental (101), vacation (104)
  if (cardType === 100 || cardType === 101 || cardType === 104) {
    // Kerrostalo (apartment block) → apartment
    if (cardSubType === 1) return 'apartment';

    // House types: rivitalo, omakotitalo, paritalo, multi-floor, other
    if (cardSubType === 2 || cardSubType === 4 || cardSubType === 32 || cardSubType === 64 || cardSubType === 256) {
      return 'house';
    }

    // Vacation (104) with unknown subtype → treat as house
    if (cardType === 104) return 'house';

    // Unknown subtype within apartment/rental → default to apartment
    return 'apartment';
  }

  // Unknown card type fallback
  return 'apartment';
}

/**
 * Detect transaction type from card
 */
export function detectTransactionType(card: OikotieCard): 'sale' | 'rent' {
  // cardType 101 is always rental
  if (card.cardType === 101) return 'rent';
  // meta.contractType 4 = rental contract
  if (card.meta.contractType === 4) return 'rent';
  return 'sale';
}

/**
 * Get human-readable Finnish property type name
 */
export function getFinnishPropertyTypeName(card: OikotieCard): string {
  const { cardType, cardSubType } = card;

  if (cardType === 102) return 'Tontti';
  if (cardType === 103) return 'Liiketila';
  if (cardType === 104) return 'Loma-asunto';

  const subtypeNames: Record<number, string> = {
    1: 'Kerrostalo',
    2: 'Rivitalo',
    4: 'Omakotitalo',
    32: 'Huvila',
    64: 'Paritalo',
    256: 'Muu',
  };

  return subtypeNames[cardSubType] || 'Asunto';
}
