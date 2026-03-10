import { HousePropertyTierI } from '@landomo/core';
import { ImmotopListingRaw } from '../types/rawTypes';

export function transformHouse(raw: ImmotopListingRaw, transactionType: string): HousePropertyTierI {
  return {
    property_category: 'house',
    title: raw.title || `House in ${raw.address?.city || 'Luxembourg'}`,
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
    sqm_living: raw.surface || 0,
    sqm_plot: raw.plotSize || 0,
    rooms: raw.rooms,
    has_garden: raw.hasGarden || false,
    has_garage: raw.hasGarage || false,
    has_parking: raw.hasParking || false,
    has_basement: raw.hasBasement || false,
    has_terrace: raw.hasTerrace,
    has_pool: raw.hasPool,
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
