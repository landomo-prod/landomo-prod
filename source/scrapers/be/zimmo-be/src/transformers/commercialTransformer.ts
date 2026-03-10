import { CommercialPropertyTierI } from '@landomo/core';

export function transformCommercial(raw: any, transactionType: string): CommercialPropertyTierI {
  const addr = raw.address || {};

  return {
    property_category: 'commercial',
    title: raw.title || `Commercial in ${addr.city || 'Belgium'}`,
    price: raw.price ?? 0,
    currency: 'EUR',
    transaction_type: transactionType === 'sale' ? 'sale' : 'rent',
    location: {
      address: [addr.street, addr.number].filter(Boolean).join(' ') || undefined,
      city: addr.city || undefined,
      zip_code: addr.postalCode || undefined,
      region: addr.province || undefined,
      country: 'BE',
      latitude: addr.latitude || undefined,
      longitude: addr.longitude || undefined,
    },
    sqm_total: raw.surface ?? 0,
    sqm_plot: raw.landSurface,
    has_elevator: raw.features?.hasLift ?? false,
    has_parking: raw.features?.hasParking ?? false,
    has_bathrooms: (raw.bathrooms ?? 0) > 0,
    bathroom_count: raw.bathrooms,
    energy_class: raw.energy?.epcScore,
    description: raw.description,
    images: raw.images,
    published_date: raw.publicationDate,
    source_url: `https://www.zimmo.be/en/property/${raw.id}`,
    source_platform: 'zimmo',
    portal_id: `zimmo-${raw.id}`,
    status: 'active',
  };
}
