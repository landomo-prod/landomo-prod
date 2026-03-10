import { HousePropertyTierI } from '@landomo/core';
import { NewhomeListing } from '../../types/newhomeTypes';

export function transformHouse(listing: NewhomeListing): HousePropertyTierI {
  const id = listing.id ?? listing.objectId ?? listing.externalId;
  const rooms = listing.numberOfRooms ?? listing.rooms ?? 0;
  const bedrooms = rooms > 0 ? Math.max(1, Math.floor(rooms) - 1) : 0;
  const sqm_living = listing.livingSpace ?? listing.usableSpace ?? 0;
  const price = listing.price ?? listing.priceFrom ?? 0;
  const offerType = (listing.offerType || listing.transactionType || 'buy').toLowerCase();

  const images = extractImages(listing);

  return {
    property_category: 'house' as const,

    title: listing.title || 'Unknown',
    price,
    currency: 'CHF',
    transaction_type: offerType === 'rent' ? 'rent' : 'sale',

    location: {
      city: listing.city || 'Unknown',
      country: 'ch',
      coordinates: (listing.latitude && listing.longitude) ? {
        lat: listing.latitude,
        lon: listing.longitude,
      } : undefined,
    },

    bedrooms,
    sqm_living,
    sqm_plot: listing.plotArea ?? 0,
    rooms,

    has_garden: listing.hasGarden ?? false,
    has_garage: listing.hasGarage ?? false,
    has_parking: listing.hasParking ?? false,
    has_basement: false,

    year_built: listing.yearBuilt,
    condition: listing.isNewConstruction ? 'new' : undefined,
    furnished: listing.isFurnished ? 'furnished' : undefined,
    published_date: undefined,

    description: listing.description,

    images: images.length > 0 ? images : undefined,
    media: images.length > 0 ? { images, total_images: images.length } : undefined,

    country_specific: {
      canton: listing.canton,
      zip_code: listing.zipCode?.toString(),
      is_new_construction: listing.isNewConstruction,
    },

    portal_metadata: {
      'newhome-ch': {
        id,
        propertyType: listing.propertyType,
        offerType: listing.offerType,
      },
    },

    source_url: listing.url || listing.detailUrl || `https://www.newhome.ch/en/search/detail/${id}`,
    source_platform: 'newhome-ch',
    portal_id: `newhome-ch-${id}`,
    status: 'active',
  };
}

function extractImages(listing: NewhomeListing): string[] {
  if (!listing.images) return [];
  return listing.images
    .map(img => typeof img === 'string' ? img : img.url)
    .filter(Boolean) as string[];
}
