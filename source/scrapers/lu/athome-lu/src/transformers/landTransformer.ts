import { LandPropertyTierI } from '@landomo/core';
import { AtHomeListingRaw } from '../types/rawTypes';

export function transformLand(raw: AtHomeListingRaw, transactionType: string): LandPropertyTierI {
  const price = raw.prices?.min || raw.prices?.max || 0;
  const areaSqm = raw.surfaces?.min || raw.surfaces?.max || raw.sqm_plot || 0;

  return {
    property_category: 'land',
    title: raw.name || `Land in ${raw.address?.city || 'Luxembourg'}`,
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
    area_plot_sqm: areaSqm,
    description: raw.description,
    features: raw.features,
    images: raw.media?.photos,
    source_url: `https://www.athome.lu/en/buy/land/id-${raw.id}`,
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
