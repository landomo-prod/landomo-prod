import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { FotocasaListing } from '../types/fotocasaTypes';
import { detectCategory } from '../utils/categoryDetection';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';

type TransformedProperty = ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;

/**
 * Main Fotocasa transformer with category detection
 * Routes to category-specific transformer based on listing type
 */
export function transformFotocasaToStandard(listing: FotocasaListing): TransformedProperty {
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
