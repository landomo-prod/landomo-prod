import { CommercialPropertyTierI } from '@landomo/core';
import { NewhomeListing } from '../../types/newhomeTypes';

export function transformCommercial(listing: NewhomeListing): CommercialPropertyTierI {
  const id = listing.id ?? listing.objectId ?? listing.externalId;
  const sqm = listing.livingSpace ?? listing.usableSpace ?? 0;
  const price = listing.price ?? listing.priceFrom ?? 0;
  const offerType = (listing.offerType || listing.transactionType || 'buy').toLowerCase();
  const images = extractImages(listing);

  return {
    property_category: 'commercial' as const,

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

    sqm_total: sqm,
    floor: listing.floor,
    total_floors: listing.numberOfFloors,

    has_elevator: listing.hasElevator ?? false,
    has_parking: listing.hasParking ?? false,
    has_bathrooms: true,

    published_date: undefined,
    description: listing.description,

    images: images.length > 0 ? images : undefined,
    media: images.length > 0 ? { images, total_images: images.length } : undefined,

    country_specific: {
      canton: listing.canton,
      zip_code: listing.zipCode?.toString(),
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
