import { ApartmentPropertyTierI } from '@landomo/core';
import { FlatfoxListing } from '../../types/flatfoxTypes';

export function transformApartment(listing: FlatfoxListing): ApartmentPropertyTierI {
  const rooms = listing.number_of_rooms ? parseFloat(listing.number_of_rooms) : 0;
  const bedrooms = rooms > 0 ? Math.max(1, Math.floor(rooms) - 1) : 0;
  const attributes = new Set(listing.attributes?.map(a => a.name.toLowerCase()) || []);

  const price = listing.offer_type === 'RENT'
    ? (listing.rent_gross ?? listing.rent_net ?? listing.price_display ?? 0)
    : (listing.price_display ?? 0);

  return {
    property_category: 'apartment' as const,

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
    bathrooms: undefined,
    sqm: listing.livingspace || 0,
    floor: listing.floor ?? undefined,
    rooms,

    has_elevator: attributes.has('lift') || attributes.has('elevator'),
    has_balcony: attributes.has('balcony') || attributes.has('balconygarden') || attributes.has('balkon'),
    has_parking: attributes.has('garage') || attributes.has('parking'),
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
      moving_date_type: listing.moving_date_type,
      rent_net: listing.rent_net,
      rent_charges: listing.rent_charges,
    },

    portal_metadata: {
      'flatfox-ch': {
        pk: listing.pk,
        slug: listing.slug,
        object_type: listing.object_type,
        object_category: listing.object_category,
        offer_type: listing.offer_type,
        status: listing.status,
        is_temporary: listing.is_temporary,
        organization: listing.organization?.name,
        video_url: listing.video_url,
        tour_url: listing.tour_url,
      },
    },

    source_url: listing.url ? `https://flatfox.ch${listing.url}` : `https://flatfox.ch/en/flat/${listing.slug}/`,
    source_platform: 'flatfox-ch',
    portal_id: `flatfox-ch-${listing.pk}`,
    status: 'active',
  };
}
