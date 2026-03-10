import { ApartmentPropertyTierI, HousePropertyTierI, LandPropertyTierI, CommercialPropertyTierI } from '@landomo/core';
import { DanboligPropertyRaw } from '../types/danboligTypes';
import { detectCategory, PropertyCategory } from '../utils/categoryDetector';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';

export type AnyTierIProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

export interface TransformResult {
  property: AnyTierIProperty;
  category: PropertyCategory;
}

/**
 * Transform a raw danbolig.dk listing to the appropriate TierI property type.
 * Category is detected from the Danish property type string.
 */
export function transformProperty(raw: DanboligPropertyRaw): TransformResult {
  const category = detectCategory(raw.type);

  let property: AnyTierIProperty;
  switch (category) {
    case 'apartment':
      property = transformApartment(raw);
      break;
    case 'house':
      property = transformHouse(raw);
      break;
    case 'land':
      property = transformLand(raw);
      break;
    case 'commercial':
      property = transformCommercial(raw);
      break;
  }

  return { property, category };
}
