import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { EdcListingRaw, EdcPropertyCategory } from '../types/edcTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

export function transformListing(listing: EdcListingRaw): TransformedProperty | null {
  try {
    const category: EdcPropertyCategory = detectCategory(listing);

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
        return null;
    }
  } catch (err: any) {
    console.error(JSON.stringify({
      level: 'error',
      service: 'edc-dk-scraper',
      msg: 'Transform failed',
      caseNumber: listing.caseNumber,
      estateType: listing.estateTypeName,
      err: err.message,
    }));
    return null;
  }
}
