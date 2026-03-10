import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { OikotieCard } from '../types/etuoviTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformOikotieApartment } from './apartments/apartmentTransformer';
import { transformOikotieHouse } from './houses/houseTransformer';
import { transformOikovieLand } from './land/landTransformer';
import { transformOikotieCommercial } from './commercial/commercialTransformer';

export type CategoryProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main transformer entry point.
 * Routes each Oikotie card to the correct category-specific transformer.
 */
export function transformOikotieToStandard(card: OikotieCard): CategoryProperty {
  const category = detectCategory(card);

  switch (category) {
    case 'apartment':
      return transformOikotieApartment(card);

    case 'house':
      return transformOikotieHouse(card);

    case 'land':
      return transformOikovieLand(card);

    case 'commercial':
      return transformOikotieCommercial(card);

    default:
      throw new Error(`Unknown category: ${category} for card ${card.cardId}`);
  }
}

export { detectCategory };
