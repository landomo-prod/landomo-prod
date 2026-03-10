import { LandPropertyTierI } from '@landomo/core';

export function transformLandToStandard(raw: any): LandPropertyTierI & Record<string, any> {
  const l = raw.listing || raw;
  const chars = l.characteristics || {};
  const prices = l.prices || {};
  const address = l.address || {};
  const loc = l.localization?.de || l.localization?.en || l.localization?.fr || {};
  const price = prices.buy?.price || 0;

  const images = (loc.attachments || [])
    .filter((a: any) => a.type === 'IMAGE')
    .map((a: any) => a.url || a.file || '')
    .filter(Boolean);

  return {
    property_category: 'land',
    title: loc.text?.title || `Land in ${address.locality || 'Switzerland'}`,
    price,
    currency: prices.currency || 'CHF',
    property_type: 'land',
    transaction_type: 'sale',
    source_url: `https://www.homegate.ch/en/buy/${raw.id}`,
    source_platform: 'homegate-ch',
    status: 'active',

    area_plot_sqm: chars.lotSize || chars.totalFloorSpace || 0,

    location: {
      address: address.street,
      city: address.locality || 'Unknown',
      country: 'Switzerland',
      postal_code: address.postalCode,
      coordinates: address.geoCoordinates?.latitude && address.geoCoordinates?.longitude ? {
        lat: address.geoCoordinates.latitude,
        lon: address.geoCoordinates.longitude,
      } : undefined,
    },

    details: {
      sqm: chars.lotSize || chars.totalFloorSpace,
    },

    price_per_sqm: price && chars.lotSize ? Math.round(price / chars.lotSize) : undefined,

    media: {
      images: (loc.attachments || [])
        .filter((a: any) => a.type === 'IMAGE')
        .map((a: any, i: number) => ({ url: a.url || a.file || '', order: i, is_main: i === 0 })),
      total_images: images.length,
    },
    images,
    description: loc.text?.description,

    published_date: l.meta?.createdAt,

    country_specific: {},

    portal_metadata: {
      'homegate-ch': {
        listing_id: raw.id,
        offer_type: l.offerType,
        updated_at: l.meta?.updatedAt,
      },
    },
  } as any;
}
