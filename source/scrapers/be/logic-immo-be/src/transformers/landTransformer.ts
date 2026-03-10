import { LandPropertyTierI } from '@landomo/core';
import { RawLogicImmoListing } from '../types/rawTypes';

export function transformLand(raw: RawLogicImmoListing): LandPropertyTierI {
  return {
    property_category: 'land',
    title: raw.title || `Land - ${raw.address?.city || 'Belgium'}`,
    price: raw.price || 0,
    currency: raw.currency || 'EUR',
    transaction_type: raw.transaction_type === 'rent' ? 'rent' : 'sale',
    location: {
      address: raw.address?.street || '',
      city: raw.address?.city || '',
      postal_code: raw.address?.postal_code || '',
      region: raw.address?.province || '',
      country: 'BE',
      coordinates: raw.address?.lat && raw.address?.lng ? {
        lat: raw.address.lat,
        lng: raw.address.lng,
      } : undefined,
    },
    area_plot_sqm: raw.plot_surface || raw.surface || 0,
    description: raw.description,
    features: raw.features,
    images: raw.images,
    published_date: raw.published_at,
    source_url: raw.url || `https://www.logic-immo.be/fr/detail/${raw.id}`,
    source_platform: 'logic-immo-be',
    portal_id: `logic-immo-be-${raw.id}`,
    status: 'active',
    agent: raw.agent ? {
      name: raw.agent.name,
      phone: raw.agent.phone,
      email: raw.agent.email,
      agency_name: raw.agent.agency,
    } : undefined,
  };
}
