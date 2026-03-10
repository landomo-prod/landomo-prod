import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { HemnetListing } from '../types/hemnetTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformHemnetApartment } from './apartments/apartmentTransformer';
import { transformHemnetHouse } from './houses/houseTransformer';
import { transformHemnetLand } from './land/landTransformer';
import { transformHemnetCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main transformer entry point.
 *
 * Routes each listing to the appropriate category-specific transformer
 * based on the Hemnet housing form group.
 */
export function transformHemnetListing(listing: HemnetListing): TransformedProperty {
  const category = detectCategory(listing);

  console.log(
    JSON.stringify({
      level: 'debug',
      service: 'hemnet-scraper',
      msg: 'Transforming listing',
      id: listing.id,
      housingForm: listing.housingForm.name,
      groups: listing.housingForm.groups,
      category,
    })
  );

  switch (category) {
    case 'apartment':
      return transformHemnetApartment(listing);

    case 'house':
      return transformHemnetHouse(listing);

    case 'land':
      return transformHemnetLand(listing);

    case 'commercial':
      return transformHemnetCommercial(listing);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = category;
      throw new Error(`Unknown category: ${_exhaustive}`);
    }
  }
}

export { detectCategory };
