import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI } from '@landomo/core';
import { BytyListing } from '../types/bytyTypes';
import { detectCategory, PropertyCategory } from '../utils/categoryDetector';
import { transformBytyApartment } from './apartments/apartmentTransformer';
import { transformBytyHouse } from './houses/houseTransformer';
import { transformBytyLand } from './land/landTransformer';

/**
 * Main Transformer Entry Point
 *
 * Routes to category-specific transformers based on propertyType
 */
export function transformBytyToStandard(
  listing: BytyListing
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformBytyApartment(listing);

    case 'house':
      return transformBytyHouse(listing);

    case 'land':
      return transformBytyLand(listing);

    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

// Re-export category detector for testing
export { detectCategory, PropertyCategory };
