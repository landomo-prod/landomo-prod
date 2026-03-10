import { CommercialPropertyTierI } from '@landomo/core';
import { RawRealoListing } from '../types/rawTypes';

export function transformCommercial(raw: RawRealoListing): CommercialPropertyTierI {
  return {
    property_category: 'commercial',
    title: raw.title || `Commercial - ${raw.address?.city || 'Belgium'}`,
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
    sqm_total: raw.surface || raw.living_surface || 0,
    sqm_plot: raw.plot_surface,
    floor: raw.floor,
    total_floors: raw.total_floors,
    has_elevator: raw.has_elevator ?? false,
    has_parking: raw.has_parking ?? false,
    has_bathrooms: raw.bathrooms != null ? raw.bathrooms > 0 : false,
    bathroom_count: raw.bathrooms,
    year_built: raw.year_built,
    energy_class: raw.energy_class,
    heating_type: raw.heating_type,
    published_date: raw.published_at,
    description: raw.description,
    features: raw.features,
    images: raw.images,
    source_url: raw.url || `https://www.realo.be/nl/detail/${raw.id}`,
    source_platform: 'realo-be',
    portal_id: `realo-be-${raw.id}`,
    status: 'active',
    agent: raw.agent ? {
      name: raw.agent.name,
      phone: raw.agent.phone,
      email: raw.agent.email,
      agency_name: raw.agent.agency,
    } : undefined,
  };
}
