import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
} from '@landomo/core';
import { EnalquilerListingRaw, getPropertyCategory } from '../types/enalquilerTypes';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI;

export function transformEnalquilerToStandard(listing: EnalquilerListingRaw): TransformedProperty {
  const category = getPropertyCategory(listing.estateTypeId, listing.propertyType);

  switch (category) {
    case 'house':
      return transformHouse(listing);
    case 'apartment':
    default:
      return transformApartment(listing);
  }
}
