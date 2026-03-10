import { ApartmentPropertyTierI } from '@landomo/core';
import { AtHomeListingRaw } from '../types/rawTypes';

export function transformApartment(raw: AtHomeListingRaw, transactionType: string): ApartmentPropertyTierI {
  const price = raw.prices?.min || raw.prices?.max || 0;
  const sqm = raw.surfaces?.min || raw.surfaces?.max || 0;
  const bedrooms = raw.bedrooms || 0;

  return {
    property_category: 'apartment',
    title: raw.name || `Apartment in ${raw.address?.city || 'Luxembourg'}`,
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
    sqm,
    floor: raw.floor,
    total_floors: raw.total_floors,
    has_elevator: raw.has_elevator || false,
    has_balcony: raw.has_balcony || false,
    has_parking: raw.has_parking || false,
    has_basement: raw.has_basement || false,
    has_terrace: raw.has_terrace,
    parking_spaces: raw.parking_spaces,
    year_built: raw.year_built,
    energy_class: raw.energy_class,
    condition: mapCondition(raw.condition),
    heating_type: raw.heating_type,
    description: raw.description,
    features: raw.features,
    images: raw.media?.photos,
    source_url: `https://www.athome.lu/en/buy/apartment/id-${raw.id}`,
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

function mapCondition(condition?: string): ApartmentPropertyTierI['condition'] {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('new') || lower.includes('neuf')) return 'new';
  if (lower.includes('excellent')) return 'excellent';
  if (lower.includes('good') || lower.includes('bon')) return 'good';
  if (lower.includes('renov')) return 'after_renovation';
  if (lower.includes('rework') || lower.includes('refurbish')) return 'requires_renovation';
  return undefined;
}
