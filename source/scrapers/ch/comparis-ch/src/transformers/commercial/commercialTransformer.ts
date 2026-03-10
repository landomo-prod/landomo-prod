import { CommercialPropertyTierI } from '@landomo/core';
import { ComparisListing } from '../../types/comparisTypes';

export function transformCommercial(listing: ComparisListing): CommercialPropertyTierI {
  const id = listing.id ?? listing.adId ?? listing.externalId;
  const price = listing.price ?? listing.priceValue ?? 0;
  const sqm = listing.livingSpace ?? listing.surfaceLiving ?? 0;
  const dealType = typeof listing.dealType === 'number'
    ? (listing.dealType === 10 ? 'sale' : 'rent')
    : (listing.dealType === 'buy' ? 'sale' : 'rent');

  return {
    property_category: 'commercial' as const,

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

    sqm_total: sqm,
    floor: listing.floor,
    total_floors: listing.numberOfFloors,

    has_elevator: listing.hasElevator ?? false,
    has_parking: listing.hasParking ?? false,
    has_bathrooms: true,

    published_date: undefined,

    description: listing.description,

    images: listing.images?.map(img => typeof img === 'string' ? img : img.url).filter(Boolean) as string[] || undefined,
    media: listing.images && listing.images.length > 0 ? {
      images: listing.images.map(img => typeof img === 'string' ? img : img.url).filter(Boolean) as string[],
      total_images: listing.images.length,
    } : undefined,

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
