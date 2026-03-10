import { LandPropertyTierI } from '@landomo/core';

export function transformLand(raw: any, transactionType: string): LandPropertyTierI {
  const addr = raw.address || {};

  return {
    property_category: 'land',
    title: raw.title || `Land in ${addr.city || 'Belgium'}`,
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
    area_plot_sqm: raw.landSurface ?? raw.surface ?? 0,
    description: raw.description,
    images: raw.images,
    published_date: raw.publicationDate,
    source_url: `https://www.zimmo.be/en/property/${raw.id}`,
    source_platform: 'zimmo',
    portal_id: `zimmo-${raw.id}`,
    status: 'active',
  };
}
