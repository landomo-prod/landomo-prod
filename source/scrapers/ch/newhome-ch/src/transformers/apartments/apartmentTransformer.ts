import { ApartmentPropertyTierI } from '@landomo/core';
import { NewhomeListing } from '../../types/newhomeTypes';

export function transformApartment(listing: NewhomeListing): ApartmentPropertyTierI {
  const id = listing.id ?? listing.objectId ?? listing.externalId;
  const rooms = listing.numberOfRooms ?? listing.rooms ?? 0;
  const bedrooms = rooms > 0 ? Math.max(1, Math.floor(rooms) - 1) : 0;
  const sqm = listing.livingSpace ?? listing.usableSpace ?? 0;
  const price = listing.price ?? listing.priceFrom ?? 0;
  const offerType = (listing.offerType || listing.transactionType || 'buy').toLowerCase();

  const features = new Set([...(listing.features || []), ...(listing.amenities || [])].map(f => f.toLowerCase()));

  return {
    property_category: 'apartment' as const,

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
    bathrooms: undefined,
    sqm,
    floor: listing.floor,
    total_floors: listing.numberOfFloors,
    rooms,

    has_elevator: listing.hasElevator ?? features.has('elevator') ?? false,
    has_balcony: listing.hasBalcony ?? features.has('balcony') ?? false,
    has_parking: listing.hasParking ?? features.has('parking') ?? false,
    has_basement: false,

    year_built: listing.yearBuilt,
    condition: listing.isNewConstruction ? 'new' : undefined,
    furnished: listing.isFurnished ? 'furnished' : undefined,
    published_date: undefined,

    description: listing.description,

    images: extractImages(listing),
    media: extractImages(listing).length > 0 ? {
      images: extractImages(listing),
      total_images: extractImages(listing).length,
    } : undefined,

    features: Array.from(features),

    country_specific: {
      canton: listing.canton,
      zip_code: listing.zipCode?.toString(),
      is_new_construction: listing.isNewConstruction,
    },

    portal_metadata: {
      'newhome-ch': {
        id,
        propertyType: listing.propertyType,
        objectType: listing.objectType,
        offerType: listing.offerType,
        provider: listing.provider,
        externalId: listing.externalId,
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
