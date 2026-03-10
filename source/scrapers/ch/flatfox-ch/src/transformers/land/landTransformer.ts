import { LandPropertyTierI } from '@landomo/core';
import { FlatfoxListing } from '../../types/flatfoxTypes';

export function transformLand(listing: FlatfoxListing): LandPropertyTierI {
  return {
    property_category: 'land' as const,

    title: listing.public_title || listing.short_title || 'Unknown',
    price: listing.price_display || 0,
    currency: 'CHF',
    transaction_type: listing.offer_type === 'RENT' ? 'rent' : 'sale',

    location: {
      city: listing.city || 'Unknown',
      country: 'ch',
      coordinates: (listing.latitude && listing.longitude) ? {
        lat: listing.latitude,
        lon: listing.longitude,
      } : undefined,
    },

    area_plot_sqm: listing.livingspace || 0,

    published_date: undefined,
    description: listing.description,

    images: listing.images?.map(img => img.url).filter(Boolean) || undefined,

    country_specific: {
      zip_code: listing.zipcode?.toString(),
    },

    portal_metadata: {
      'flatfox-ch': {
        pk: listing.pk,
        slug: listing.slug,
        object_category: listing.object_category,
        offer_type: listing.offer_type,
      },
    },

    source_url: listing.url ? `https://flatfox.ch${listing.url}` : `https://flatfox.ch/en/flat/${listing.slug}/`,
    source_platform: 'flatfox-ch',
    portal_id: `flatfox-ch-${listing.pk}`,
    status: 'active',
  };
}
