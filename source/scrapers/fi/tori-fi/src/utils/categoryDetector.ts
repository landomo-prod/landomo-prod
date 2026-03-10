import { OikotieCard } from '../types/toriTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';
export type TransactionType = 'sale' | 'rent';

/**
 * Determine the Landomo property category from an Oikotie card.
 *
 * cardType encodes the transaction type:
 *   100 / 103 = sale/rent residential
 *   101       = rent residential
 *   105       = commercial for sale
 *   106       = commercial for rent
 *
 * cardSubType encodes the residential property type:
 *   1  = apartment (kerrostalo)
 *   2  = rowhouse/semi-detached (rivitalo/paritalo)
 *   4  = detached house (omakotitalo)
 *   64 = semi-detached (paritalo – own title)
 *   5  = land plot (tontti) — rare on Oikotie main search, more on separate endpoint
 *   8  = commercial premises
 *
 * When cardSubType is missing or unrecognised the lot size field is used as a
 * heuristic: listings with sizeLot > 0 but no living area are classified as land.
 */
export function detectCategory(card: OikotieCard): PropertyCategory {
  // Commercial card types
  if (card.cardType === 105 || card.cardType === 106) {
    return 'commercial';
  }

  // Commercial sub-type inside residential card type (rare)
  if (card.cardSubType === 8) {
    return 'commercial';
  }

  // Land plot
  if (card.cardSubType === 5) {
    return 'land';
  }

  // Land heuristic: has a lot but no living area
  if (
    card.data.sizeLot != null &&
    card.data.sizeLot > 0 &&
    (card.data.sizeMin == null || card.data.sizeMin === 0)
  ) {
    return 'land';
  }

  // Houses: detached, rowhouse, semi-detached
  if (card.cardSubType === 2 || card.cardSubType === 4 || card.cardSubType === 64) {
    return 'house';
  }

  // Default: apartment (cardSubType=1 or unknown residential)
  return 'apartment';
}

/**
 * Determine the transaction type from the card.
 * cardType 100, 105 = sale; 101, 103, 106 = rent
 */
export function detectTransactionType(card: OikotieCard): TransactionType {
  if (card.cardType === 101 || card.cardType === 103 || card.cardType === 106) {
    return 'rent';
  }
  return 'sale';
}

/**
 * Parse a raw Oikotie price string into a numeric EUR value.
 * Examples:
 *   "198 000 €"     → 198000
 *   "32 779 €"      → 32779
 *   "872 € / kk"    → 872   (monthly rent)
 *   "1 550 € / kk"  → 1550
 */
export function parsePrice(raw: string | null): number {
  if (!raw) return 0;
  // Remove everything except digits, spaces and commas (handle "1 550,50")
  const cleaned = raw.replace(/[^\d\s,]/g, '').trim();
  // Remove spaces used as thousands separators, replace comma with dot
  const normalized = cleaned.replace(/\s+/g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : value;
}

/**
 * Parse the "size" string from Oikotie into living area m².
 * The format can be "125/162 m²" (living/gross) or "38 m²".
 * We always extract the first (living area) number.
 */
export function parseSqm(raw: string | null): number {
  if (!raw) return 0;
  const match = raw.match(/[\d,]+/);
  if (!match) return 0;
  const value = parseFloat(match[0].replace(',', '.'));
  return isNaN(value) ? 0 : value;
}
