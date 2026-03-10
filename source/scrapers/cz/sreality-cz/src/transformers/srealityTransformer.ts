import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
  OtherPropertyTierI
} from '@landomo/core';
import { SRealityListing } from '../types/srealityTypes';
import { detectCategoryFromSreality } from '../utils/categoryDetection';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';
import { transformOther } from './other/otherTransformer';

/**
 * Main SReality transformer with category detection
 * Routes to category-specific transformer based on listing type
 *
 * Fully implemented category-specific transformers:
 * - Apartments: ✅ Category-specific transformer (Tier I)
 * - Houses: ✅ Category-specific transformer (Tier I)
 * - Land: ✅ Category-specific transformer (Tier I)
 * - Commercial: ✅ Category-specific transformer (Tier I)
 * - Other: ✅ Category-specific transformer (Tier I)
 *
 * All transformers output type-safe Tier I types compliant with
 * the category-partitioned three-tier data model.
 */
export function transformSRealityToStandard(
  listing: SRealityListing
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI | OtherPropertyTierI {
  const category = detectCategoryFromSreality(listing);

  switch (category) {
    case 'apartment':
      return transformApartment(listing);

    case 'house':
      return transformHouse(listing);

    case 'land':
      return transformLand(listing);

    case 'commercial':
      return transformCommercial(listing);

    case 'other':
      return transformOther(listing);

    default:
      // This should never happen due to detectCategoryFromSreality throwing
      throw new Error(`Unsupported category: ${category}. This indicates a bug in category detection.`);
  }
}
