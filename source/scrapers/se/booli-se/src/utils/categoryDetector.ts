import { BooliListingShort, PropertyCategory, BOOLI_OBJECT_TYPE_TO_CATEGORY } from '../types/booliTypes';

/**
 * Detect property category from a Booli listing's objectType field.
 *
 * Booli objectType strings (Swedish):
 *   Lägenhet / Bostadsrätt / Hyresrätt  → apartment
 *   Villa / Radhus / Kedjehus / Parhus
 *   Fritidshus / Gård / Gård/Skog       → house
 *   Tomt / Mark / Tomt/Mark             → land
 *   Lokaler                             → commercial
 */
export function detectCategory(listing: BooliListingShort): PropertyCategory {
  const rawType = listing.objectType?.trim() ?? '';

  // Direct lookup
  if (rawType in BOOLI_OBJECT_TYPE_TO_CATEGORY) {
    return BOOLI_OBJECT_TYPE_TO_CATEGORY[rawType as keyof typeof BOOLI_OBJECT_TYPE_TO_CATEGORY];
  }

  // Partial matching for edge cases / alternate spellings
  const lower = rawType.toLowerCase();

  if (lower.includes('lägenhet') || lower.includes('bostadsrätt') || lower.includes('hyresrätt')) {
    return 'apartment';
  }

  if (lower.includes('tomt') || lower.includes('mark')) {
    return 'land';
  }

  if (lower.includes('lokal')) {
    return 'commercial';
  }

  // Villa, Radhus, Kedjehus, Parhus, Fritidshus, Gård, Skog, Övrig → house
  if (
    lower.includes('villa') ||
    lower.includes('radhus') ||
    lower.includes('kedjehus') ||
    lower.includes('parhus') ||
    lower.includes('fritidshus') ||
    lower.includes('gård') ||
    lower.includes('skog') ||
    lower.includes('övrig')
  ) {
    return 'house';
  }

  // Default to apartment (most common listing type on Booli)
  console.warn(JSON.stringify({
    level: 'warn',
    service: 'booli-scraper',
    msg: 'Unknown objectType, defaulting to apartment',
    objectType: rawType,
    booliId: listing.booliId,
  }));
  return 'apartment';
}

/**
 * Get a property_subtype string from the Booli objectType for houses.
 */
export function getHouseSubtype(
  objectType: string
): 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow' {
  const lower = objectType.toLowerCase();
  if (lower.includes('radhus')) return 'townhouse';
  if (lower.includes('parhus')) return 'semi_detached';
  if (lower.includes('kedjehus')) return 'terraced';
  if (lower.includes('fritidshus')) return 'cottage';
  if (lower.includes('gård') || lower.includes('skog')) return 'farmhouse';
  return 'villa'; // Villa / Övrig
}
