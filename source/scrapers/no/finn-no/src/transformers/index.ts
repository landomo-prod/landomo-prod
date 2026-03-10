import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { FinnListing } from '../types/finnTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformFinnApartment } from './apartments/apartmentTransformer';
import { transformFinnHouse } from './houses/houseTransformer';
import { transformFinnLand } from './land/landTransformer';
import { transformFinnCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main transformer entry point.
 * Routes each finn.no listing to the correct category-specific transformer.
 *
 * @param listing - Raw listing from the finn.no search API
 * @param offerType - 'sale' or 'rent' (derived from the search key used)
 * @returns Typed TierI property object
 */
export function transformFinnListing(
  listing: FinnListing,
  offerType: 'sale' | 'rent'
): TransformedProperty {
  const category = detectCategory(listing);

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'finn-no-scraper',
      msg: 'Transforming listing',
      id: listing.ad_id,
      propType: listing.property_type_description,
      searchKey: listing.main_search_key,
      category,
    })
  );

  switch (category) {
    case 'apartment':
      return transformFinnApartment(listing, offerType);

    case 'house':
      return transformFinnHouse(listing, offerType);

    case 'land':
      return transformFinnLand(listing, offerType);

    case 'commercial':
      return transformFinnCommercial(listing, offerType);

    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

export { detectCategory };
