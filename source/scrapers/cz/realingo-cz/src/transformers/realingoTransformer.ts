import { StandardProperty } from '@landomo/core';
import { RealingoOffer } from '../types/realingoTypes';
import { transformRealingoApartment } from './apartments/realingoApartmentTransformer';
import { transformRealingoHouse } from './houses/realingoHouseTransformer';
import { transformRealingoLand } from './land/realingoLandTransformer';
import { transformRealingoCommercial } from './commercial/realingoCommercialTransformer';
import { transformRealingoOthers } from './others/realingoOthersTransformer';

/**
 * Main Realingo transformer with category detection
 * Routes to category-specific transformer based on listing type
 *
 * Current status:
 * - Apartments: ✅ Category-specific transformer (Tier I)
 * - Houses: ✅ Category-specific transformer (Tier I)
 * - Land: ✅ Category-specific transformer (Tier I)
 * - Commercial: ✅ Category-specific transformer (Tier I)
 * - Others: ✅ Category-specific transformer (Tier I)
 */
export function transformRealingoToStandard(offer: RealingoOffer): StandardProperty & Record<string, any> {
  // Route based on property type directly for COMMERCIAL and OTHERS
  if (offer.property === 'COMMERCIAL') {
    return transformRealingoCommercial(offer) as any;
  }

  if (offer.property === 'OTHERS') {
    return transformRealingoOthers(offer) as any;
  }

  // For FLAT, HOUSE, LAND, use category detection
  const category = detectPropertyCategory(offer.property, offer.category);

  switch (category) {
    case 'apartment':
      return transformRealingoApartment(offer) as any;

    case 'house':
      return transformRealingoHouse(offer) as any;

    case 'land':
      return transformRealingoLand(offer) as any;

    default:
      throw new Error(`Unsupported category: ${category}`);
  }
}

/**
 * Detect property category for routing to category-specific tables
 * Returns: 'apartment' | 'house' | 'land'
 */
function detectPropertyCategory(propertyType?: string, category?: string): 'apartment' | 'house' | 'land' {
  const searchText = `${propertyType || ''} ${category || ''}`.toLowerCase();

  // Land detection
  if (propertyType === 'LAND' || searchText.includes('land') || searchText.includes('pozemek')) {
    return 'land';
  }

  // House detection
  if (propertyType === 'HOUSE' || searchText.includes('house') || searchText.includes('family')) {
    return 'house';
  }

  // Apartment detection (default for most Czech listings)
  if (searchText.includes('apartment') || searchText.includes('byt') || searchText.includes('flat') ||
      searchText.includes('flat') || /\d\+(?:kk|1)/.test(searchText)) {
    return 'apartment';
  }

  // Default to apartment (most common in Czech Republic)
  return 'apartment';
}
