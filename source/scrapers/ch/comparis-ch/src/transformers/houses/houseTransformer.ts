import { HousePropertyTierI } from '@landomo/core';
import { ComparisListing } from '../../types/comparisTypes';

export function transformHouse(listing: ComparisListing): HousePropertyTierI {
  const id = listing.id ?? listing.adId ?? listing.externalId;
  const rooms = listing.numberOfRooms ?? listing.rooms ?? 0;
  const bedrooms = rooms > 0 ? Math.max(1, Math.floor(rooms) - 1) : 0;
  const sqm_living = listing.livingSpace ?? listing.surfaceLiving ?? 0;
  const price = listing.price ?? listing.priceValue ?? 0;
  const dealType = typeof listing.dealType === 'number'
    ? (listing.dealType === 10 ? 'sale' : 'rent')
    : (listing.dealType === 'buy' ? 'sale' : 'rent');

  return {
    property_category: 'house' as const,

    title: listing.title || 'Unknown',
    price,
    currency: 'CHF',
    transaction_type: dealType as 'sale' | 'rent',

    location: {
      city: listing.city || 'Unknown',
      country: 'ch',
      coordinates: (listing.latitude && listing.longitude) ? {
        lat: listing.latitude,
        lon: listing.longitude,
      } : undefined,
    },

    bedrooms,
    bathrooms: undefined,
    sqm_living,
    sqm_plot: listing.plotArea ?? 0,
    rooms,

    has_garden: listing.hasGarden ?? false,
    has_garage: listing.hasGarage ?? false,
    has_parking: listing.hasParking ?? false,
    has_basement: false,

    year_built: listing.yearBuilt,
    condition: undefined,
    heating_type: undefined,
    energy_class: undefined,

    furnished: listing.isFurnished ? 'furnished' : undefined,
    published_date: undefined,

    description: listing.description,

    images: listing.images?.map(img => typeof img === 'string' ? img : img.url).filter(Boolean) as string[] || undefined,
    media: listing.images && listing.images.length > 0 ? {
      images: listing.images.map(img => typeof img === 'string' ? img : img.url).filter(Boolean) as string[],
      total_images: listing.images.length,
    } : undefined,

    features: listing.features || [],

    country_specific: {
      canton: listing.canton,
      zip_code: listing.zipCode?.toString(),
    },

    portal_metadata: {
      'comparis-ch': {
        id,
        propertyType: listing.propertyType,
        dealType: listing.dealType,
      },
    },

    source_url: listing.url || `https://www.comparis.ch/immobilien/detail/${id}`,
    source_platform: 'comparis-ch',
    portal_id: `comparis-ch-${id}`,
    status: 'active',
  };
}
