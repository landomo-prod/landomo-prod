import { StandardProperty } from '@landomo/core';
import { IdealistaListing, IdealistaDetail } from '../types/idealistaTypes';
import { transformIdealistaApartment } from './apartments/apartmentTransformer';
import { transformIdealistaHouse } from './houses/houseTransformer';
import { transformIdealistaLand } from './land/landTransformer';
import { transformIdealistaCommercial } from './commercial/commercialTransformer';

export function transformIdealistaToStandard(
  listing: IdealistaListing,
  detail?: IdealistaDetail
): StandardProperty & Record<string, any> {
  switch (listing.propertyType) {
    case 'apartment':
      return transformIdealistaApartment(listing, detail) as any;
    case 'house':
      return transformIdealistaHouse(listing, detail) as any;
    case 'land':
      return transformIdealistaLand(listing, detail) as any;
    case 'commercial':
      return transformIdealistaCommercial(listing, detail) as any;
    default:
      return transformIdealistaApartment(listing, detail) as any;
  }
}
