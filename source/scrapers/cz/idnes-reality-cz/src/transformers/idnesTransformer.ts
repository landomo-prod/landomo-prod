import { StandardProperty } from '@landomo/core';
import { IdnesListing } from '../types/idnesTypes';
import { transformIdnesApartment } from './apartments/idnesApartmentTransformer';
import { transformIdnesHouse } from './houses/idnesHouseTransformer';
import { transformIdnesLand } from './land/idnesLandTransformer';
import { transformIdnesCommercial } from './commercial/idnesCommercialTransformer';

/**
 * Main Idnes transformer with category detection
 * Routes to category-specific transformer based on listing type
 */
export function transformIdnesToStandard(listing: IdnesListing): StandardProperty & Record<string, any> {
  const category = detectPropertyCategory(listing.propertyType, listing.title);

  switch (category) {
    case 'apartment':
      return transformIdnesApartment(listing) as any;
    case 'house':
      return transformIdnesHouse(listing) as any;
    case 'land':
      return transformIdnesLand(listing) as any;
    case 'commercial':
      return transformIdnesCommercial(listing) as any;
    default:
      throw new Error(`Unsupported category: ${category}`);
  }
}

/**
 * Detect property category for routing to category-specific tables
 */
function detectPropertyCategory(propertyType?: string, title?: string): 'apartment' | 'house' | 'land' | 'commercial' {
  const searchText = `${propertyType || ''} ${title || ''}`.toLowerCase();

  // Land detection
  if (searchText.includes('land') || searchText.includes('pozemek') || searchText.includes('parcela')) {
    return 'land';
  }

  // Commercial detection
  if (searchText.includes('commercial') || searchText.includes('komercni') || searchText.includes('komerční') ||
      searchText.includes('kancelář') || searchText.includes('kancelar') || searchText.includes('obchod') ||
      searchText.includes('sklad') || searchText.includes('prodejna') || searchText.includes('hala')) {
    return 'commercial';
  }

  // House detection (includes recreation/chata/chalupa)
  if (searchText.includes('house') || searchText.includes('dům') || searchText.includes('dum') ||
      searchText.includes('rodinný') || searchText.includes('rodinny') || /\brd\b/.test(searchText) ||
      searchText.includes('recreation') || searchText.includes('other') ||
      searchText.includes('chata') || searchText.includes('chalupa') || searchText.includes('rekreační')) {
    return 'house';
  }

  // Apartment detection (default for most Czech listings)
  if (searchText.includes('apartment') || searchText.includes('byt') || searchText.includes('flat') ||
      /\d\+(?:kk|1)/.test(searchText)) {
    return 'apartment';
  }

  // Default to apartment (most common in Czech Republic)
  return 'apartment';
}
