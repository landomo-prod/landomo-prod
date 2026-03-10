import { CommercialPropertyTierI } from '@landomo/core';
import { FlatfoxListing } from '../../types/flatfoxTypes';

export function transformCommercial(listing: FlatfoxListing): CommercialPropertyTierI {
  const attributes = new Set(listing.attributes?.map(a => a.name.toLowerCase()) || []);

  const price = listing.offer_type === 'RENT'
    ? (listing.rent_gross ?? listing.rent_net ?? listing.price_display ?? 0)
    : (listing.price_display ?? 0);

  return {
    property_category: 'commercial' as const,

    title: listing.public_title || listing.short_title || 'Unknown',
    price,
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

    sqm_total: listing.livingspace || 0,
    floor: listing.floor ?? undefined,

    has_elevator: attributes.has('lift') || attributes.has('elevator'),
    has_parking: attributes.has('garage') || attributes.has('parking'),
    has_bathrooms: true,

    published_date: undefined,
    description: listing.description,

    images: listing.images?.map(img => img.url).filter(Boolean) || undefined,
    media: listing.images && listing.images.length > 0 ? {
      images: listing.images.map(img => img.url).filter(Boolean),
      total_images: listing.images.length,
    } : undefined,

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
