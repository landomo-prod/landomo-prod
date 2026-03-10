import { ApartmentPropertyTierI, HousePropertyTierI } from '@landomo/core';
import { VuokrauviAnnouncement } from '../types/vuokrauviTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformVuokrauviApartment } from './apartments/apartmentTransformer';
import { transformVuokrauviHouse } from './houses/houseTransformer';

export type TransformedProperty = ApartmentPropertyTierI | HousePropertyTierI;

/**
 * Transform a Vuokraovi announcement to the appropriate Landomo TierI type.
 *
 * Routes by propertySubtype:
 *   APARTMENT_HOUSE, LOFT_HOUSE, WOODEN_HOUSE, OTHER → ApartmentPropertyTierI
 *   ROW_HOUSE, SEMI_DETACHED, DETACHED_HOUSE          → HousePropertyTierI
 */
export function transformVuokrauviListing(announcement: VuokrauviAnnouncement): TransformedProperty {
  const category = detectCategory(announcement.propertySubtype);

  if (category === 'house') {
    return transformVuokrauviHouse(announcement);
  }

  return transformVuokrauviApartment(announcement);
}
