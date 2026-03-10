import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { RealityListing } from '../types/realityTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformRealityApartment } from './apartments/apartmentTransformer';
import { transformRealityHouse } from './houses/houseTransformer';
import { transformRealityLand } from './land/landTransformer';
import { transformRealityCommercial } from './commercial/commercialTransformer';

/**
 * Transform Reality.sk listing to category-specific StandardProperty
 *
 * Routes to appropriate transformer based on detected category:
 * - byty → apartmentTransformer
 * - domy → houseTransformer
 * - pozemky → landTransformer
 * - kancelarie → commercialTransformer
 */
export function transformRealityToStandard(
  listing: RealityListing
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformRealityApartment(listing);
    case 'house':
      return transformRealityHouse(listing);
    case 'land':
      return transformRealityLand(listing);
    case 'commercial':
      return transformRealityCommercial(listing);
  }
}
