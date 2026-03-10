import { ApartmentPropertyTierI, HousePropertyTierI } from '@landomo/core';
import { HybelListingDetail } from '../types/hybelTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';

export type TransformedProperty = ApartmentPropertyTierI | HousePropertyTierI;

/**
 * Route a listing detail to the correct category transformer.
 */
export function transformListing(detail: HybelListingDetail): TransformedProperty {
  const category = detectCategory(detail.housingTypeRaw);

  switch (category) {
    case 'house':
      return transformHouse(detail);
    case 'apartment':
    default:
      return transformApartment(detail);
  }
}
