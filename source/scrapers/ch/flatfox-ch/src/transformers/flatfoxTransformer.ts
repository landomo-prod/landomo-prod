import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { FlatfoxListing } from '../types/flatfoxTypes';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';

function detectCategory(listing: FlatfoxListing): 'apartment' | 'house' | 'land' | 'commercial' {
  const category = (listing.object_category || '').toUpperCase();
  const type = (listing.object_type || '').toUpperCase();

  if (category === 'COMMERCIAL' || type.includes('OFFICE') || type.includes('SHOP') || type.includes('STORAGE')) {
    return 'commercial';
  }

  if (category === 'HOUSE' || type === 'HOUSE' || type === 'VILLA' || type === 'CHALET' || type === 'TERRACE_HOUSE') {
    return 'house';
  }

  if (category === 'LAND' || type === 'LAND' || type === 'PLOT') {
    return 'land';
  }

  // APARTMENT, SHARED, PARKING -> apartment (default)
  return 'apartment';
}

export function transformFlatfoxToStandard(
  listing: FlatfoxListing
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
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
