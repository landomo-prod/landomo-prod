import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { HabitacliaListingRaw } from '../types/habitacliaTypes';
import { detectCategory } from '../utils/categoryDetection';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

export function transformHabitacliaToStandard(listing: HabitacliaListingRaw): TransformedProperty {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformApartment(listing);
    case 'house':
      return transformHouse(listing);
    case 'land':
      return transformLand(listing);
    case 'commercial':
      return transformCommercial(listing);
    default:
      return transformApartment(listing);
  }
}
