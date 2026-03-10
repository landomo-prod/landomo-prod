import { EdcListingRaw, EdcPropertyCategory, ESTATE_TYPE_CATEGORY_MAP } from '../types/edcTypes';

/**
 * Detect property category from an EDC listing.
 *
 * Strategy:
 * 1. Exact match on estateTypeName (primary key)
 * 2. Partial match on estateTypeName for combined types like 'Rækkehus/Villa'
 * 3. For Rent division: default to 'apartment' for residential types
 * 4. Fallback to 'apartment'
 */
export function detectCategory(listing: EdcListingRaw): EdcPropertyCategory {
  const typeName = listing.estateTypeName || '';

  // Exact match
  if (ESTATE_TYPE_CATEGORY_MAP[typeName]) {
    return ESTATE_TYPE_CATEGORY_MAP[typeName];
  }

  // Partial/combined match (e.g. 'Rækkehus/Villa', 'Ejerlejlighed/Rækkehus/Villalejlighed')
  for (const [key, category] of Object.entries(ESTATE_TYPE_CATEGORY_MAP)) {
    if (typeName.includes(key)) {
      return category;
    }
  }

  // Commercial division fallback
  if (listing.caseTypeGroup === 'Business') {
    return 'commercial';
  }

  // Rental apartments are commonly 'Lejlighed' — default to apartment for unknown rental types
  if (listing.caseClassification === 'Rent') {
    return 'apartment';
  }

  return 'apartment';
}
