import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { BezRealitkyListingItem } from '../types/bezrealitkyTypes';
import { detectCategory, PropertyCategory } from '../utils/categoryDetector';
import { transformBezrealitkyApartment } from './apartments/apartmentTransformer';
import { transformBezrealitkyHouse } from './houses/houseTransformer';
import { transformBezrealitkyLand } from './land/landTransformer';
import { transformBezrealitkyCommercial } from './commercial/commercialTransformer';

/**
 * Main Transformer Entry Point
 *
 * Routes to category-specific transformers based on estateType
 */
export function transformBezRealitkyToStandard(
  listing: BezRealitkyListingItem
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
  const category = detectCategory(listing);

  let result: ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;

  switch (category) {
    case 'apartment':
      result = transformBezrealitkyApartment(listing);
      break;

    case 'house':
      result = transformBezrealitkyHouse(listing);
      break;

    case 'land':
      result = transformBezrealitkyLand(listing);
      break;

    case 'commercial':
      // Commercial properties (GARAZ, KANCELAR, NEBYTOVY_PROSTOR) → commercial partition
      result = transformBezrealitkyCommercial(listing);
      break;

    case 'recreational':
      // Recreational (cottages, cabins) are buildings with land → house partition
      result = transformBezrealitkyHouse(listing);
      break;

    default:
      throw new Error(`Unknown category: ${category}`);
  }

  return result;
}

// Re-export category detector for testing
export { detectCategory, PropertyCategory };
