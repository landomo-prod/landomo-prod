import { CommercialPropertyTierI } from '@landomo/core';
import { AtHomeListingRaw } from '../types/rawTypes';

export function transformCommercial(raw: AtHomeListingRaw, transactionType: string): CommercialPropertyTierI {
  const price = raw.prices?.min || raw.prices?.max || 0;
  const sqmTotal = raw.surfaces?.min || raw.surfaces?.max || 0;

  return {
    property_category: 'commercial',
    title: raw.name || `Commercial property in ${raw.address?.city || 'Luxembourg'}`,
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
    sqm_total: sqmTotal,
    has_elevator: raw.has_elevator || false,
    has_parking: raw.has_parking || false,
    has_bathrooms: raw.bathrooms != null && raw.bathrooms > 0,
    bathroom_count: raw.bathrooms,
    parking_spaces: raw.parking_spaces,
    year_built: raw.year_built,
    energy_class: raw.energy_class,
    condition: mapCondition(raw.condition),
    heating_type: raw.heating_type,
    description: raw.description,
    features: raw.features,
    images: raw.media?.photos,
    source_url: `https://www.athome.lu/en/buy/commercial/id-${raw.id}`,
    source_platform: 'athome',
    portal_id: `athome-${raw.id}`,
    status: 'active',
    portal_metadata: {
      athome_id: raw.id,
      external_reference: raw.externalReference,
      type_key: raw.typeKey,
      group: raw.group,
    },
    country_specific: {
      commune: raw.address?.district,
    },
  };
}

function mapCondition(condition?: string): CommercialPropertyTierI['condition'] {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('new') || lower.includes('neuf')) return 'new';
  if (lower.includes('excellent')) return 'excellent';
  if (lower.includes('good') || lower.includes('bon')) return 'good';
  if (lower.includes('fair')) return 'fair';
  if (lower.includes('renov') || lower.includes('rework')) return 'requires_renovation';
  return undefined;
}
