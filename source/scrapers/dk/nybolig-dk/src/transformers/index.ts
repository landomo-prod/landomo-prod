import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { NyboligCase, LandomoCategory } from '../types/nyboligTypes';
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

/**
 * Transform a raw nybolig case into the appropriate Landomo TierI type.
 * Returns null if the listing cannot be reliably categorized.
 */
export function transformListing(
  listing: NyboligCase
): { property: TransformedProperty; category: LandomoCategory } | null {
  try {
    const category = detectCategory(listing);

    let property: TransformedProperty;
    switch (category) {
      case 'apartment':
        property = transformApartment(listing);
        break;
      case 'house':
        property = transformHouse(listing);
        break;
      case 'land':
        property = transformLand(listing);
        break;
      case 'commercial':
        property = transformCommercial(listing);
        break;
      default:
        return null;
    }

    return { property, category };
  } catch (err) {
    return null;
  }
}
