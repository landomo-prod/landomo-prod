import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { BieniciListingRaw } from '../types/bieniciTypes';
import { transformApartment } from './apartmentTransformer';
import { transformHouse } from './houseTransformer';
import { transformLand } from './landTransformer';
import { transformCommercial } from './commercialTransformer';

type PropertyResult = ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;

const PROPERTY_TYPE_TO_CATEGORY: Record<string, 'apartment' | 'house' | 'land' | 'commercial'> = {
  'flat': 'apartment',
  'apartment': 'apartment',
  'house': 'house',
  'terrain': 'land',
  'land': 'land',
  'premises': 'commercial',
  'parking': 'commercial',
  'garage': 'commercial',
};

export function detectCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  return PROPERTY_TYPE_TO_CATEGORY[propertyType?.toLowerCase()] || 'apartment';
}

export function transformBieniciToStandard(
  listing: BieniciListingRaw,
  category: 'apartment' | 'house' | 'land' | 'commercial'
): PropertyResult {
  switch (category) {
    case 'apartment': return transformApartment(listing);
    case 'house': return transformHouse(listing);
    case 'land': return transformLand(listing);
    case 'commercial': return transformCommercial(listing);
  }
}
