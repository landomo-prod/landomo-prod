import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { OikotieCard } from '../types/toriTypes';
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
 * Route an Oikotie card to the correct category transformer and return a
 * fully-populated TierI property object.
 */
export function transformCard(card: OikotieCard): TransformedProperty {
  const category = detectCategory(card);

  switch (category) {
    case 'apartment':
      return transformApartment(card);
    case 'house':
      return transformHouse(card);
    case 'land':
      return transformLand(card);
    case 'commercial':
      return transformCommercial(card);
  }
}
