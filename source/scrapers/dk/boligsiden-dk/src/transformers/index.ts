import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { BoligsidenCase } from '../types/boligsidenTypes';
import { detectCategory, PropertyCategory } from '../utils/categoryDetector';
import { transformBoligsidenApartment } from './apartments/apartmentTransformer';
import { transformBoligsidenHouse } from './houses/houseTransformer';
import { transformBoligsidenLand } from './land/landTransformer';
import { transformBoligsidenCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main Transformer Entry Point
 *
 * Routes to category-specific transformers based on Boligsiden addressType.
 *
 * Mapping:
 * - condo          → apartment (ApartmentPropertyTierI)
 * - villa          → house (HousePropertyTierI)
 * - terraced house → house (HousePropertyTierI)
 * - holiday house  → house (HousePropertyTierI)
 * - cattle farm    → house (HousePropertyTierI)
 * - farm           → house (HousePropertyTierI)
 * - hobby farm     → house (HousePropertyTierI)
 * - full year plot → land (LandPropertyTierI)
 * - holiday plot   → land (LandPropertyTierI)
 */
export function transformBoligsidenToStandard(listing: BoligsidenCase): TransformedProperty {
  const category: PropertyCategory = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformBoligsidenApartment(listing);

    case 'house':
      return transformBoligsidenHouse(listing);

    case 'land':
      return transformBoligsidenLand(listing);

    case 'commercial':
      return transformBoligsidenCommercial(listing);

    default:
      // TypeScript exhaustiveness check - should never reach here
      throw new Error(`Unknown category: ${category}`);
  }
}

export { detectCategory, PropertyCategory };
