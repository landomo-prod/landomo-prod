import { ApartmentPropertyTierI, HousePropertyTierI } from '@landomo/core';
import { SubitoItem, SubitoSearchConfig } from '../types/subitoTypes';
import { transformSubitoApartment } from './apartments/apartmentTransformer';
import { transformSubitoHouse } from './houses/houseTransformer';

export type TransformedProperty = ApartmentPropertyTierI | HousePropertyTierI;

/**
 * Transform a Subito.it item to the appropriate TierI type based on search config category.
 */
export function transformSubitoItem(
  item: SubitoItem,
  config: SubitoSearchConfig
): TransformedProperty {
  if (config.category === 'appartamenti') {
    return transformSubitoApartment(item, config);
  }
  // case-ville -> house
  return transformSubitoHouse(item, config);
}
