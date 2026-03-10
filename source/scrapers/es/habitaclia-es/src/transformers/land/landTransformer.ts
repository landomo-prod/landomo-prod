import { LandPropertyTierI } from '@landomo/core';
import { HabitacliaListingRaw } from '../../types/habitacliaTypes';
import {
  normalizeEnergyRating,
  normalizeTransactionType,
} from '../../../../shared/spanish-value-mappings';

export function transformLand(listing: HabitacliaListingRaw): LandPropertyTierI {
  const transType = normalizeTransactionType(listing.transactionType === 'venta' ? 'venta' : 'alquiler');

  // For land, sqm from listing is typically the plot area
  const plotArea = listing.plotSize || listing.sqm || 0;

  return {
    property_category: 'land',
    title: listing.title || `Land ${listing.id}`,
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: (transType === 'sale' ? 'sale' : 'rent') as 'sale' | 'rent',

    location: {
      address: listing.location.address || undefined,
      city: listing.location.city || '',
      region: listing.location.province || undefined,
      country: 'ES',
      coordinates: (listing.location.lat && listing.location.lng) ? { lat: listing.location.lat, lon: listing.location.lng } : undefined,    },

    area_plot_sqm: plotArea,

    description: listing.description || undefined,
    images: listing.images.length > 0 ? listing.images : undefined,
    features: listing.features.length > 0 ? listing.features : undefined,

    agent: listing.agencyName ? {
      name: listing.agencyName,
      phone: listing.agencyPhone || undefined,
    } : undefined,

    source_url: listing.url,
    source_platform: 'habitaclia',
    portal_id: `habitaclia-${listing.id}`,
    status: 'active',

    country_specific: {
      portal_property_type: listing.propertyType,
    },
  };
}
