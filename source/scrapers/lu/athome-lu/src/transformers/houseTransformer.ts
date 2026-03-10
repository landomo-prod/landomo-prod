import { HousePropertyTierI } from '@landomo/core';
import { AtHomeListingRaw } from '../types/rawTypes';

export function transformHouse(raw: AtHomeListingRaw, transactionType: string): HousePropertyTierI {
  const price = raw.prices?.min || raw.prices?.max || 0;
  const sqmLiving = raw.surfaces?.min || raw.surfaces?.max || 0;
  const bedrooms = raw.bedrooms || 0;

  return {
    property_category: 'house',
    title: raw.name || `House in ${raw.address?.city || 'Luxembourg'}`,
    price,
    currency: 'EUR',
    transaction_type: transactionType === 'for-rent' ? 'rent' : 'sale',
    location: {
      address: [raw.address?.street, raw.address?.zip, raw.address?.city].filter(Boolean).join(', '),
      city: raw.address?.city || '',
      postal_code: raw.address?.zip || '',
      country: 'Luxembourg',
      region: raw.address?.region || raw.address?.district || '',
      coordinates: raw.address?.pin ? { lat: raw.address.pin.lat, lon: raw.address.pin.lon } : undefined,
    },
    bedrooms,
    bathrooms: raw.bathrooms,
    sqm_living: sqmLiving,
    sqm_plot: raw.sqm_plot || 0,
    has_garden: raw.has_garden || false,
    has_garage: raw.has_garage || false,
    has_parking: raw.has_parking || false,
    has_basement: raw.has_basement || false,
    has_terrace: raw.has_terrace,
    has_pool: raw.has_pool,
    parking_spaces: raw.parking_spaces,
    year_built: raw.year_built,
    energy_class: raw.energy_class,
    condition: mapCondition(raw.condition),
    heating_type: raw.heating_type,
    description: raw.description,
    features: raw.features,
    images: raw.media?.photos,
    source_url: `https://www.athome.lu/en/buy/house/id-${raw.id}`,
    source_platform: 'athome',
    portal_id: `athome-${raw.id}`,
    status: 'active',
    portal_metadata: {
      athome_id: raw.id,
      external_reference: raw.externalReference,
      type_key: raw.typeKey,
      group: raw.group,
      is_new_build: raw.isNewBuild,
    },
    country_specific: {
      commune: raw.address?.district,
    },
  };
}

function mapCondition(condition?: string): HousePropertyTierI['condition'] {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('new') || lower.includes('neuf')) return 'new';
  if (lower.includes('excellent')) return 'excellent';
  if (lower.includes('good') || lower.includes('bon')) return 'good';
  if (lower.includes('renov')) return 'after_renovation';
  if (lower.includes('rework') || lower.includes('refurbish')) return 'requires_renovation';
  return undefined;
}
