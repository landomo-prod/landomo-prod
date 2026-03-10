import { ApartmentPropertyTierI } from '@landomo/core';
import { RawLogicImmoListing } from '../types/rawTypes';

export function transformApartment(raw: RawLogicImmoListing): ApartmentPropertyTierI {
  return {
    property_category: 'apartment',
    title: raw.title || `Apartment - ${raw.address?.city || 'Belgium'}`,
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
    sqm: raw.surface || raw.living_surface || 0,
    floor: raw.floor,
    total_floors: raw.total_floors,
    rooms: raw.rooms,
    has_elevator: raw.has_elevator ?? false,
    has_balcony: raw.has_balcony ?? false,
    has_parking: raw.has_parking ?? false,
    has_basement: raw.has_basement ?? false,
    has_terrace: raw.has_terrace,
    has_garage: raw.has_garage,
    year_built: raw.year_built,
    construction_type: mapConstructionType(raw.construction_type),
    condition: mapCondition(raw.condition),
    heating_type: raw.heating_type,
    energy_class: raw.energy_class,
    furnished: raw.furnished ? 'furnished' : undefined,
    published_date: raw.published_at,
    description: raw.description,
    features: raw.features,
    images: raw.images,
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

function mapConstructionType(type?: string): 'panel' | 'brick' | 'concrete' | 'mixed' | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower.includes('brique') || lower.includes('brick')) return 'brick';
  if (lower.includes('béton') || lower.includes('concrete')) return 'concrete';
  if (lower.includes('mixte') || lower.includes('mixed')) return 'mixed';
  return undefined;
}

function mapCondition(condition?: string): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('neuf') || lower.includes('new')) return 'new';
  if (lower.includes('excellent') || lower.includes('parfait')) return 'excellent';
  if (lower.includes('bon') || lower.includes('good')) return 'good';
  if (lower.includes('rénov') || lower.includes('renovat')) return 'after_renovation';
  if (lower.includes('rénover') || lower.includes('to renovate')) return 'requires_renovation';
  return undefined;
}
