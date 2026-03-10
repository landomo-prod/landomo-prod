import { CommercialPropertyTierI } from '@landomo/core';
import { FundaDetailData } from '../types/rawTypes';

export function transformToCommercial(raw: FundaDetailData): CommercialPropertyTierI {
  return {
    property_category: 'commercial',
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
    sqm_total: raw.livingArea ?? 0,
    has_elevator: raw.hasElevator,
    has_parking: raw.hasParking,
    has_bathrooms: raw.bathrooms ?? 0,
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
