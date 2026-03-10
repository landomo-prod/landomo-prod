import { LandPropertyTierI } from '@landomo/core';
import { ParariusDetailData } from '../types/rawTypes';

export function transformToLand(raw: ParariusDetailData): LandPropertyTierI {
  return {
    property_category: 'land',
    title: raw.address || 'Unknown',
    price: raw.price || 0,
    currency: 'EUR',
    transaction_type: 'rent',
    location: {
      address: raw.address,
      city: raw.city,
      postal_code: raw.postalCode,
      country: 'NL',
      coordinates: raw.latitude && raw.longitude ? {
        lat: raw.latitude,
        lng: raw.longitude,
      } : undefined,
    },
    area_plot_sqm: raw.plotArea ?? raw.livingArea ?? 0,
    description: raw.description,
    images: raw.images,
    features: raw.features,
    agent: raw.agentName ? { name: raw.agentName } : undefined,
    source_url: raw.url,
    source_platform: 'pararius',
    portal_id: `pararius-${raw.id}`,
    status: 'active',
  };
}
