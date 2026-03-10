import { CommercialPropertyTierI } from '@landomo/core';
import { ImmotopListingRaw } from '../types/rawTypes';

export function transformCommercial(raw: ImmotopListingRaw, transactionType: string): CommercialPropertyTierI {
  return {
    property_category: 'commercial',
    title: raw.title || `Commercial property in ${raw.address?.city || 'Luxembourg'}`,
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
    sqm_total: raw.surface || 0,
    has_elevator: raw.hasElevator || false,
    has_parking: raw.hasParking || false,
    has_bathrooms: raw.bathrooms != null && raw.bathrooms > 0,
    bathroom_count: raw.bathrooms,
    parking_spaces: raw.parkingSpaces,
    year_built: raw.yearBuilt,
    energy_class: raw.energyClass,
    description: raw.description,
    features: raw.features,
    images: raw.images,
    source_url: raw.url || `https://www.immotop.lu/en/property/${raw.id}`,
    source_platform: 'immotop',
    portal_id: `immotop-${raw.id}`,
    status: 'active',
  };
}
