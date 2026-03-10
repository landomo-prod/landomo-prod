import { HousePropertyTierI } from '@landomo/core';
import { RawRealoListing } from '../types/rawTypes';

export function transformHouse(raw: RawRealoListing): HousePropertyTierI {
  return {
    property_category: 'house',
    title: raw.title || `House - ${raw.address?.city || 'Belgium'}`,
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
    bedrooms: raw.bedrooms ?? (raw.rooms ? Math.max(raw.rooms - 1, 0) : 0),
    bathrooms: raw.bathrooms,
    sqm_living: raw.living_surface || raw.surface || 0,
    sqm_plot: raw.plot_surface || 0,
    rooms: raw.rooms,
    has_garden: raw.has_garden ?? false,
    garden_area: raw.garden_surface,
    has_garage: raw.has_garage ?? false,
    has_parking: raw.has_parking ?? false,
    has_basement: raw.has_basement ?? false,
    has_terrace: raw.has_terrace,
    has_balcony: raw.has_balcony,
    year_built: raw.year_built,
    energy_class: raw.energy_class,
    heating_type: raw.heating_type,
    condition: mapCondition(raw.condition),
    furnished: raw.furnished ? 'furnished' : undefined,
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

function mapCondition(condition?: string): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('nieuw') || lower.includes('new') || lower.includes('neuf')) return 'new';
  if (lower.includes('excellent') || lower.includes('uitstekend')) return 'excellent';
  if (lower.includes('goed') || lower.includes('good') || lower.includes('bon')) return 'good';
  if (lower.includes('gerenoveerd') || lower.includes('renovat')) return 'after_renovation';
  if (lower.includes('te renoveren') || lower.includes('to renovate')) return 'requires_renovation';
  return undefined;
}
