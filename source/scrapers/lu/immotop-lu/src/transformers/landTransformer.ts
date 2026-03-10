import { LandPropertyTierI } from '@landomo/core';
import { ImmotopListingRaw } from '../types/rawTypes';

export function transformLand(raw: ImmotopListingRaw, transactionType: string): LandPropertyTierI {
  return {
    property_category: 'land',
    title: raw.title || `Land in ${raw.address?.city || 'Luxembourg'}`,
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
    area_plot_sqm: raw.plotSize || raw.surface || 0,
    description: raw.description,
    features: raw.features,
    images: raw.images,
    source_url: raw.url || `https://www.immotop.lu/en/property/${raw.id}`,
    source_platform: 'immotop',
    portal_id: `immotop-${raw.id}`,
    status: 'active',
  };
}
