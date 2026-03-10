import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { OikotieCard } from '../types/oikotieTypes';
import { detectCategory } from '../utils/categoryDetector';
import { transformOikotieApartment } from './apartments/apartmentTransformer';
import { transformOikotieHouse } from './houses/houseTransformer';
import { transformOikiotieLand } from './land/landTransformer';
import { transformOikotieCommercial } from './commercial/commercialTransformer';

export type TransformedProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

/**
 * Main transformer entry point.
 *
 * Routes Oikotie cards to category-specific transformers based on cardType/cardSubType:
 *
 * cardType 100/101 + cardSubType 1  → apartment (kerrostalo)
 * cardType 100/101 + cardSubType 2+ → house (rivitalo, omakotitalo, paritalo, etc.)
 * cardType 102                       → land (tontti)
 * cardType 103                       → commercial (liiketila)
 * cardType 104                       → house (loma-asunto/vacation)
 */
export function transformOikotieCard(card: OikotieCard): TransformedProperty {
  const category = detectCategory(card);

  console.log(JSON.stringify({
    level: 'info',
    service: 'oikotie-fi-scraper',
    msg: 'Transforming card',
    cardId: card.cardId,
    cardType: card.cardType,
    cardSubType: card.cardSubType,
    category,
  }));

  switch (category) {
    case 'apartment':
      return transformOikotieApartment(card);

    case 'house':
      return transformOikotieHouse(card);

    case 'land':
      return transformOikiotieLand(card);

    case 'commercial':
      return transformOikotieCommercial(card);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = category;
      throw new Error(`Unknown category: ${_exhaustive}`);
    }
  }
}

export { detectCategory };
