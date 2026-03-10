import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { KMListing } from '../types/kiinteistomaailmaTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformKMApartment } from './apartments/apartmentTransformer';
import { transformKMHouse } from './houses/houseTransformer';
import { transformKMLand } from './land/landTransformer';
import { transformKMCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main transformer entry point for Kiinteistömaailma.fi listings.
 *
 * Routes listings to category-specific transformers based on type/group codes:
 *
 *   type=KT           → apartment (Kerrostalo)
 *   type=RT/PT/OT/ET  → house (Rivitalo, Paritalo, Omakotitalo, Erillistalo)
 *   type=MO / group=Va → house (Mökki/Huvila vacation property)
 *   type=TO / group=To → land (Tontti)
 *   (fallback)        → commercial (not currently in KM listings)
 */
export function transformKMListing(listing: KMListing): TransformedProperty {
  const category = detectCategory(listing);

  switch (category) {
    case 'apartment':
      return transformKMApartment(listing);

    case 'house':
      return transformKMHouse(listing);

    case 'land':
      return transformKMLand(listing);

    case 'commercial':
      return transformKMCommercial(listing);

    default: {
      const _exhaustive: never = category;
      throw new Error(`Unknown category: ${_exhaustive}`);
    }
  }
}

export { detectCategory };
