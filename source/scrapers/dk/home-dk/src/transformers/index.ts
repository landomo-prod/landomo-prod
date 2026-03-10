import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { HomeListingDetail } from '../types/homeTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';

export type TierIProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Transform a raw home.dk listing detail into the appropriate TierI type.
 * Returns null if the listing should be skipped (e.g. isComingSoon without data).
 */
export function transformListing(listing: HomeListingDetail): TierIProperty | null {
  // Skip listings without a valid URL or ID
  if (!listing.id || !listing.url) return null;

  // Skip external listings (aggregated from other portals)
  if (listing.type === 'salesCase' && !listing.isForSale && !listing.isRentalCase) {
    return null;
  }

  const category = detectCategory(
    listing.propertyCategory,
    listing.isBusinessCase,
    listing.isPlot,
  );

  try {
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
        return transformHouse(listing);
    }
  } catch (err: any) {
    // Return null on transform error so we skip rather than crash
    return null;
  }
}

export { transformApartment, transformHouse, transformLand, transformCommercial };
