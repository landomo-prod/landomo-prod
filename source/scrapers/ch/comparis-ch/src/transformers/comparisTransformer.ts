import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { ComparisListing } from '../types/comparisTypes';
import { transformApartment } from './apartments/apartmentTransformer';
import { transformHouse } from './houses/houseTransformer';
import { transformLand } from './land/landTransformer';
import { transformCommercial } from './commercial/commercialTransformer';

function detectCategory(listing: ComparisListing): 'apartment' | 'house' | 'land' | 'commercial' {
  const type = (listing.propertyType || '').toLowerCase();

  if (type.includes('apartment') || type.includes('wohnung') || type.includes('flat') || type.includes('studio') || type.includes('loft') || type.includes('attic') || type.includes('attika') || type.includes('appartement')) {
    return 'apartment';
  }
  if (type.includes('house') || type.includes('haus') || type.includes('villa') || type.includes('chalet') || type.includes('maison') || type.includes('einfamilienhaus') || type.includes('reihenhaus')) {
    return 'house';
  }
  if (type.includes('land') || type.includes('grundstück') || type.includes('terrain') || type.includes('plot') || type.includes('bauland')) {
    return 'land';
  }
  if (type.includes('commercial') || type.includes('gewerbe') || type.includes('büro') || type.includes('office') || type.includes('retail') || type.includes('laden')) {
    return 'commercial';
  }

  // Default based on available fields
  if (listing.plotArea && !listing.livingSpace) return 'land';
  return 'apartment';
}

export function transformComparisToStandard(
  listing: ComparisListing
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
  const category = detectCategory(listing);

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
      return transformApartment(listing);
  }
}
