import { StandardProperty } from '@landomo/core';
import { RealityListing } from '../types/realityTypes';
import { transformRealityApartment } from './apartments/apartmentTransformer';
import { transformRealityHouse } from './houses/houseTransformer';
import { transformRealityLand } from './land/landTransformer';
import { transformRealityCommercial } from './commercial/commercialTransformer';

/**
 * Main Reality.cz transformer with category detection
 * Routes to category-specific transformer based on API type field
 *
 * Current status:
 * - Apartments: Category-specific transformer (Tier I) ✅
 * - Houses: Category-specific transformer (Tier I) ✅
 * - Land: Category-specific transformer (Tier I) ✅
 * - Commercial: Category-specific transformer (Tier I) ✅
 */
export function transformRealityToStandard(listing: RealityListing): StandardProperty & Record<string, any> {
  const category = detectPropertyCategory(listing.api_type, listing.title);

  switch (category) {
    case 'apartment':
      return transformRealityApartment(listing) as any;

    case 'house':
      return transformRealityHouse(listing) as any;

    case 'land':
      return transformRealityLand(listing) as any;

    case 'commercial':
      return transformRealityCommercial(listing) as any;

    default:
      throw new Error(`Unsupported category: ${category}`);
  }
}

/**
 * Detect property category from API type field
 * API types: "flat", "house", "land", "commercial", etc.
 * Falls back to title-based detection if type is unknown
 */
function detectPropertyCategory(apiType?: string, title?: string): 'apartment' | 'house' | 'land' | 'commercial' {
  // Primary: use API type field (descriptive strings like "byt 2+1, 62 m², panel, osobní")
  if (apiType) {
    const t = apiType.toLowerCase();

    // Commercial keywords (check first - most specific)
    if (t.includes('kancelář') || t.includes('kancelar') || t.includes('office')) return 'commercial';
    if (t.includes('sklad') || t.includes('warehouse')) return 'commercial';
    if (t.includes('průmysl') || t.includes('industrial')) return 'commercial';
    if (t.includes('hotel') || t.includes('restaurant') || t.includes('restaurace')) return 'commercial';
    if (t.includes('obchod') || t.includes('retail')) return 'commercial';
    if (t.includes('bytový dům')) return 'commercial';

    // Apartment: "byt" or disposition pattern like "2+kk", "3+1"
    if (t.includes('byt') || /^\d\+(?:kk|\d)/.test(t)) return 'apartment';

    // House: "dům", "rodinný", "chalupa", "chata", "vila", "venkovské stavení"
    if (t.includes('dům') || t.includes('dum') || t.includes('rodinný') || t.includes('rodinny') ||
        t.includes('chalupa') || t.includes('chata') || t.includes('vila') ||
        t.includes('venkovsk') || t.includes('rekreace') || t.includes('cottage')) return 'house';

    // Land: "pozemek", "parcela" (only if not already matched as house with plot)
    if (t.includes('pozemek') || t.includes('parcela')) return 'land';
  }

  // Fallback: title-based detection
  const searchText = (title || '').toLowerCase();

  if (searchText.includes('kancelář') || searchText.includes('kancelar') ||
      searchText.includes('sklad') || searchText.includes('výrob') ||
      searchText.includes('obchod') || searchText.includes('restaurace') ||
      searchText.includes('hotel')) {
    return 'commercial';
  }
  if (searchText.includes('byt') || /\d\+(?:kk|1)/.test(searchText)) {
    return 'apartment';
  }
  if (searchText.includes('dům') || searchText.includes('dum') ||
      searchText.includes('rodinný') || searchText.includes('rodinny')) {
    return 'house';
  }
  if (searchText.includes('pozemek') || searchText.includes('parcela')) {
    return 'land';
  }

  // Default to apartment (most common in Czech Republic)
  return 'apartment';
}
