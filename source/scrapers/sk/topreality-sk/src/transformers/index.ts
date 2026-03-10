/**
 * TopReality.sk Transformer Router
 *
 * Routes listings to category-specific transformers based on property type
 */

import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { TopRealityListing } from '../types/toprealityTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformApartmentToStandard } from './apartments/apartmentTransformer';
import { transformHouseToStandard } from './houses/houseTransformer';
import { transformLandToStandard } from './land/landTransformer';
import { transformCommercialToStandard } from './commercial/commercialTransformer';

/**
 * Transform TopReality.sk listing to TierI type with category routing
 *
 * Routes to specialized transformer based on detected category:
 * - apartment -> apartments/apartmentTransformer.ts
 * - house -> houses/houseTransformer.ts
 * - land -> land/landTransformer.ts
 * - commercial -> commercial/commercialTransformer.ts
 */
export function transformTopRealityToStandard(listing: TopRealityListing): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformApartmentToStandard(listing);
    case 'house':
      return transformHouseToStandard(listing);
    case 'land':
      return transformLandToStandard(listing);
    case 'commercial':
      return transformCommercialToStandard(listing);
    default:
      // Fallback to house transformer for unknown categories
      return transformHouseToStandard(listing);
  }
}

/**
 * Batch transform with category routing
 */
export function batchTransformTopReality(listings: TopRealityListing[]): Array<ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI> {
  return listings.map(transformTopRealityToStandard);
}
