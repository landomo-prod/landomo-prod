import { HousePropertyTierI } from '@landomo/core';

export function transformHouseToStandard(raw: any): HousePropertyTierI & Record<string, any> {
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
    property_category: 'house',
    title: loc.text?.title || `House in ${address.locality || 'Switzerland'}`,
    price,
    currency: prices.currency || 'CHF',
    property_type: 'house',
    transaction_type: isRent ? 'rent' : 'sale',
    source_url: `https://www.homegate.ch/en/${isRent ? 'rent' : 'buy'}/${raw.id}`,
    source_platform: 'homegate-ch',
    status: 'active',

    bedrooms: chars.numberOfRooms ? Math.max(1, chars.numberOfRooms - 1) : undefined,
    sqm_living: chars.livingSpace || 0,
    sqm_plot: chars.lotSize || 0,
    has_garden: false,
    has_garage: chars.hasGarage ?? false,
    has_parking: chars.hasParking ?? false,
    has_basement: false,

    location: {
      address: address.street,
      city: address.locality || 'Unknown',
      region: address.region,
      country: 'Switzerland',
      postal_code: address.postalCode,
      coordinates: address.geoCoordinates?.latitude && address.geoCoordinates?.longitude ? {
        lat: address.geoCoordinates.latitude,
        lon: address.geoCoordinates.longitude,
      } : undefined,
    },

    details: {
      bedrooms: chars.numberOfRooms ? Math.max(1, chars.numberOfRooms - 1) : undefined,
      bathrooms: chars.numberOfBathrooms,
      sqm: chars.livingSpace,
      rooms: chars.numberOfRooms,
      year_built: chars.yearBuilt,
      renovation_year: chars.yearLastRenovated,
    },

    price_per_sqm: price && chars.livingSpace ? Math.round(price / chars.livingSpace) : undefined,

    media: {
      images: (loc.attachments || [])
        .filter((a: any) => a.type === 'IMAGE')
        .map((a: any, i: number) => ({ url: a.url || a.file || '', order: i, is_main: i === 0 })),
      total_images: images.length,
    },
    images,
    description: loc.text?.description,

    amenities: {
      has_parking: chars.hasParking,
      has_garage: chars.hasGarage,
      has_elevator: chars.hasElevator,
    },

    condition: chars.isNewBuilding ? 'new' : undefined,
    published_date: l.meta?.createdAt,

    country_specific: {
      is_minergie: chars.isMinergieCertified,
      lot_size: chars.lotSize,
      year_built: chars.yearBuilt,
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
