import { LandPropertyTierI } from '@landomo/core';
import { NewhomeListing } from '../../types/newhomeTypes';

export function transformLand(listing: NewhomeListing): LandPropertyTierI {
  const id = listing.id ?? listing.objectId ?? listing.externalId;
  const price = listing.price ?? listing.priceFrom ?? 0;
  const images = extractImages(listing);

  return {
    property_category: 'land' as const,

    title: listing.title || 'Unknown',
    price,
    currency: 'CHF',
    transaction_type: 'sale',

    location: {
      city: listing.city || 'Unknown',
      country: 'ch',
      coordinates: (listing.latitude && listing.longitude) ? {
        lat: listing.latitude,
        lon: listing.longitude,
      } : undefined,
    },

    area_plot_sqm: listing.plotArea ?? listing.livingSpace ?? 0,

    published_date: undefined,
    description: listing.description,

    images: images.length > 0 ? images : undefined,

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
