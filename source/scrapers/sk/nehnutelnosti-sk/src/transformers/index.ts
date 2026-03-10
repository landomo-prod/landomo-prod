import { StandardProperty, ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { NehnutelnostiListing } from '../types/nehnutelnostiTypes';
import { detectCategory, PropertyCategory } from '../utils/categoryDetector';
import { transformNehnutelnostiApartment } from './apartments/apartmentTransformer';
import { transformNehnutelnostiHouse } from './houses/houseTransformer';
import { transformNehnutelnostiLand } from './land/landTransformer';
import { transformNehnutelnostiCommercial } from './commercial/commercialTransformer';

/**
 * Main Transformer Entry Point
 *
 * Routes to category-specific transformers based on property_type/category
 */
export function transformNehnutelnostiToStandard(
  listing: NehnutelnostiListing
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformNehnutelnostiApartment(listing);

    case 'house':
      return transformNehnutelnostiHouse(listing);

    case 'land':
      return transformNehnutelnostiLand(listing);

    case 'commercial':
      return transformNehnutelnostiCommercial(listing);

    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

// Re-export category detector for testing
export { detectCategory, PropertyCategory };
