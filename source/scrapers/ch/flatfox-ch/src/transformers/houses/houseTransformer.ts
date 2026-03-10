import { HousePropertyTierI } from '@landomo/core';
import { FlatfoxListing } from '../../types/flatfoxTypes';

export function transformHouse(listing: FlatfoxListing): HousePropertyTierI {
  const rooms = listing.number_of_rooms ? parseFloat(listing.number_of_rooms) : 0;
  const bedrooms = rooms > 0 ? Math.max(1, Math.floor(rooms) - 1) : 0;
  const attributes = new Set(listing.attributes?.map(a => a.name.toLowerCase()) || []);

  const price = listing.offer_type === 'RENT'
    ? (listing.rent_gross ?? listing.rent_net ?? listing.price_display ?? 0)
    : (listing.price_display ?? 0);

  return {
    property_category: 'house' as const,

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

    bedrooms,
    sqm_living: listing.livingspace || 0,
    sqm_plot: 0,
    rooms,

    has_garden: attributes.has('garden') || attributes.has('garten') || attributes.has('balconygarden'),
    has_garage: attributes.has('garage'),
    has_parking: attributes.has('parking') || attributes.has('garage'),
    has_basement: attributes.has('cellar') || attributes.has('keller'),

    year_built: listing.year_built ?? undefined,
    furnished: listing.is_furnished ? 'furnished' : undefined,
    published_date: undefined,

    description: listing.description,

    images: listing.images?.map(img => img.url).filter(Boolean) || undefined,
    media: listing.images && listing.images.length > 0 ? {
      images: listing.images.map(img => img.url).filter(Boolean),
      total_images: listing.images.length,
    } : undefined,

    features: Array.from(attributes),

    country_specific: {
      zip_code: listing.zipcode?.toString(),
      address: listing.public_address,
      moving_date: listing.moving_date,
    },

    portal_metadata: {
      'flatfox-ch': {
        pk: listing.pk,
        slug: listing.slug,
        object_type: listing.object_type,
        object_category: listing.object_category,
        offer_type: listing.offer_type,
        status: listing.status,
        organization: listing.organization?.name,
      },
    },

    source_url: listing.url ? `https://flatfox.ch${listing.url}` : `https://flatfox.ch/en/flat/${listing.slug}/`,
    source_platform: 'flatfox-ch',
    portal_id: `flatfox-ch-${listing.pk}`,
    status: 'active',
  };
}
