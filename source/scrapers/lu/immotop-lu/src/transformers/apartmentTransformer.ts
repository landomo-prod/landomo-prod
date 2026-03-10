import { ApartmentPropertyTierI } from '@landomo/core';
import { ImmotopListingRaw } from '../types/rawTypes';

export function transformApartment(raw: ImmotopListingRaw, transactionType: string): ApartmentPropertyTierI {
  return {
    property_category: 'apartment',
    title: raw.title || `Apartment in ${raw.address?.city || 'Luxembourg'}`,
    price: raw.price || 0,
    currency: 'EUR',
    transaction_type: transactionType === 'rent' ? 'rent' : 'sale',
    location: {
      address: [raw.address?.street, raw.address?.zip, raw.address?.city].filter(Boolean).join(', '),
      city: raw.address?.city || '',
      zip_code: raw.address?.zip || '',
      country: 'Luxembourg',
      region: raw.address?.region || '',
      latitude: raw.latitude,
      longitude: raw.longitude,
    },
    bedrooms: raw.bedrooms || 0,
    bathrooms: raw.bathrooms,
    sqm: raw.surface || 0,
    floor: raw.floor,
    rooms: raw.rooms,
    has_elevator: raw.hasElevator || false,
    has_balcony: raw.hasBalcony || false,
    has_parking: raw.hasParking || false,
    has_basement: raw.hasBasement || false,
    has_terrace: raw.hasTerrace,
    parking_spaces: raw.parkingSpaces,
    year_built: raw.yearBuilt,
    energy_class: raw.energyClass,
    description: raw.description,
    features: raw.features,
    images: raw.images,
    source_url: raw.url || `https://www.immotop.lu/en/property/${raw.id}`,
    source_platform: 'immotop',
    portal_id: `immotop-${raw.id}`,
    status: 'active',
  };
}
