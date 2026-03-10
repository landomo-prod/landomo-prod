import { HousePropertyTierI } from '@landomo/core';
import { FundaDetailData } from '../types/rawTypes';

export function transformToHouse(raw: FundaDetailData): HousePropertyTierI {
  return {
    property_category: 'house',
    title: raw.address || 'Unknown',
    price: raw.price || 0,
    currency: 'EUR',
    transaction_type: raw.transactionType,
    location: {
      address: raw.address,
      city: raw.city,
      postal_code: raw.postcode,
      region: raw.province,
      country: 'NL',
      coordinates: raw.latitude && raw.longitude ? {
        lat: raw.latitude,
        lng: raw.longitude,
      } : undefined,
    },
    bedrooms: raw.bedrooms ?? (raw.rooms ? Math.max(raw.rooms - 1, 0) : 0),
    bathrooms: raw.bathrooms,
    sqm_living: raw.livingArea ?? 0,
    sqm_plot: raw.plotArea ?? 0,
    rooms: raw.rooms,
    has_garden: raw.hasGarden,
    has_garage: raw.hasGarage,
    has_parking: raw.hasParking,
    has_basement: raw.hasBasement,
    energy_class: raw.energyLabel,
    year_built: raw.yearBuilt,
    description: raw.description,
    images: raw.images,
    features: raw.features,
    agent: raw.agentName ? { name: raw.agentName } : undefined,
    source_url: raw.url,
    source_platform: 'funda',
    portal_id: `funda-${raw.id}`,
    status: 'active',
  };
}
