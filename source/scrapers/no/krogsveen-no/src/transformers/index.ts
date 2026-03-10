import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { KrogsveenEstate } from '../types/krogsveenTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformKrogsveenApartment } from './apartments/apartmentTransformer';
import { transformKrogsveenHouse } from './houses/houseTransformer';
import { transformKrogsveenLand } from './land/landTransformer';
import { transformKrogsveenCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main transformer entry point.
 * Routes each Krogsveen estate to the correct category-specific transformer
 * based on bsrPropertyType and commissionType.
 */
export function transformKrogsveenEstate(estate: KrogsveenEstate): TransformedProperty {
  const category = detectCategory(estate);

  switch (category) {
    case 'apartment':
      return transformKrogsveenApartment(estate);

    case 'house':
      return transformKrogsveenHouse(estate);

    case 'land':
      return transformKrogsveenLand(estate);

    case 'commercial':
      return transformKrogsveenCommercial(estate);

    default:
      // TypeScript exhaustiveness — should never reach here
      throw new Error(`Unknown category: ${category}`);
  }
}

export { detectCategory };
