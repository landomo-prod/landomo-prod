import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { BooliListingShort, TransactionType } from '../types/booliTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformBooliApartment } from './apartments/apartmentTransformer';
import { transformBooliHouse } from './houses/houseTransformer';
import { transformBooliLand } from './land/landTransformer';
import { transformBooliCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main transformer entry point.
 *
 * Routes each Booli listing to the appropriate category-specific transformer
 * based on the objectType field.
 */
export function transformBooliListing(
  listing: BooliListingShort,
  transactionType: TransactionType
): TransformedProperty {
  const category = detectCategory(listing);

  console.log(
    JSON.stringify({
      level: 'debug',
      service: 'booli-scraper',
      msg: 'Transforming listing',
      booliId: listing.booliId,
      objectType: listing.objectType,
      category,
      transactionType,
    })
  );

  switch (category) {
    case 'apartment':
      return transformBooliApartment(listing, transactionType);

    case 'house':
      return transformBooliHouse(listing, transactionType);

    case 'land':
      return transformBooliLand(listing, transactionType);

    case 'commercial':
      return transformBooliCommercial(listing, transactionType);

    default: {
      const _exhaustive: never = category;
      throw new Error(`Unknown category: ${_exhaustive}`);
    }
  }
}

export { detectCategory };
