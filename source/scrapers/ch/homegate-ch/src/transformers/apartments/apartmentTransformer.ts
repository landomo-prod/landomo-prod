import { ApartmentPropertyTierI } from '@landomo/core';

/**
 * Transform Homegate listing to ApartmentPropertyTierI
 */
export function transformToStandard(raw: any): ApartmentPropertyTierI & Record<string, any> {
  const l = raw.listing || raw;
  const chars = l.characteristics || {};
  const prices = l.prices || {};
  const address = l.address || {};
  const loc = l.localization?.de || l.localization?.en || l.localization?.fr || {};
  const isRent = l.offerType === 'RENT';
  const price = isRent ? (prices.rent?.gross || prices.rent?.net || 0) : (prices.buy?.price || 0);
  const sqm = chars.livingSpace || 0;

  const images = (loc.attachments || [])
    .filter((a: any) => a.type === 'IMAGE')
    .map((a: any, i: number) => a.url || a.file || '')
    .filter(Boolean);

  return {
    property_category: 'apartment',
    title: loc.text?.title || `Apartment in ${address.locality || 'Switzerland'}`,
    price,
    currency: prices.currency || 'CHF',
    property_type: 'apartment',
    transaction_type: isRent ? 'rent' : 'sale',
    source_url: `https://www.homegate.ch/en/${isRent ? 'rent' : 'buy'}/${raw.id}`,
    source_platform: 'homegate-ch',
    status: 'active',

    bedrooms: chars.numberOfRooms ? Math.max(1, chars.numberOfRooms - 1) : undefined,
    sqm,
    has_elevator: chars.hasElevator ?? false,
    has_balcony: chars.hasBalcony ?? false,
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
      sqm,
      floor: chars.floor,
      rooms: chars.numberOfRooms,
      year_built: chars.yearBuilt,
      renovation_year: chars.yearLastRenovated,
    },

    price_per_sqm: price && sqm ? Math.round(price / sqm) : undefined,

    media: {
      images: (loc.attachments || [])
        .filter((a: any) => a.type === 'IMAGE')
        .map((a: any, i: number) => ({
          url: a.url || a.file || '',
          order: i,
          is_main: i === 0,
        })),
      total_images: images.length,
    },
    images,
    description: loc.text?.description,

    amenities: {
      has_parking: chars.hasParking,
      has_garage: chars.hasGarage,
      has_balcony: chars.hasBalcony,
      has_elevator: chars.hasElevator,
      is_furnished: chars.isFurnished,
    },

    condition: chars.isNewBuilding ? 'new' : undefined,
    heating_type: undefined,
    furnished: chars.isFurnished ? 'furnished' : undefined,
    published_date: l.meta?.createdAt,
    deposit: undefined,

    country_specific: {
      is_minergie: chars.isMinergieCertified,
      is_new_building: chars.isNewBuilding,
      is_first_occupancy: chars.isFirstOccupancy,
      monthly_charges: isRent ? prices.rent?.charges : undefined,
      year_built: chars.yearBuilt,
      year_renovated: chars.yearLastRenovated,
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
