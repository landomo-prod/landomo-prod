import { ApartmentPropertyTierI } from '@landomo/core';
import { FundaDetailData } from '../types/rawTypes';

export function transformToApartment(raw: FundaDetailData): ApartmentPropertyTierI {
  return {
    property_category: 'apartment',
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
    sqm: raw.livingArea ?? 0,
    floor: raw.floor,
    total_floors: raw.totalFloors,
    rooms: raw.rooms,
    has_elevator: raw.hasElevator,
    has_balcony: raw.hasBalcony,
    has_parking: raw.hasParking,
    has_basement: raw.hasBasement,
    has_garage: raw.hasGarage,
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
