import { CommercialPropertyTierI } from '@landomo/core';

export function transformCommercialToStandard(raw: any): CommercialPropertyTierI & Record<string, any> {
  const l = raw.listing || raw;
  const chars = l.characteristics || {};
  const prices = l.prices || {};
  const address = l.address || {};
  const loc = l.localization?.de || l.localization?.en || l.localization?.fr || {};
  const isRent = l.offerType === 'RENT';
  const price = isRent ? (prices.rent?.gross || prices.rent?.net || 0) : (prices.buy?.price || 0);

  const images = (loc.attachments || [])
    .filter((a: any) => a.type === 'IMAGE')
    .map((a: any) => a.url || a.file || '')
    .filter(Boolean);

  return {
    property_category: 'commercial',
    title: loc.text?.title || `Commercial in ${address.locality || 'Switzerland'}`,
    price,
    currency: prices.currency || 'CHF',
    property_type: 'commercial',
    transaction_type: isRent ? 'rent' : 'sale',
    source_url: `https://www.homegate.ch/en/${isRent ? 'rent' : 'buy'}/${raw.id}`,
    source_platform: 'homegate-ch',
    status: 'active',

    sqm_total: chars.livingSpace || chars.totalFloorSpace || 0,
    has_elevator: chars.hasElevator ?? false,
    has_parking: chars.hasParking ?? false,
    bathrooms: chars.numberOfBathrooms,

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
      bathrooms: chars.numberOfBathrooms,
      sqm: chars.livingSpace || chars.totalFloorSpace,
      floor: chars.floor,
      year_built: chars.yearBuilt,
    },

    media: {
      images: (loc.attachments || [])
        .filter((a: any) => a.type === 'IMAGE')
        .map((a: any, i: number) => ({ url: a.url || a.file || '', order: i, is_main: i === 0 })),
      total_images: images.length,
    },
    images,
    description: loc.text?.description,

    published_date: l.meta?.createdAt,

    country_specific: {
      is_minergie: chars.isMinergieCertified,
    },

    portal_metadata: {
      'homegate-ch': {
        listing_id: raw.id,
        offer_type: l.offerType,
        categories: l.categories,
        updated_at: l.meta?.updatedAt,
      },
    },
  } as any;
}
