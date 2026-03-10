import { HousePropertyTierI } from '@landomo/core';
import { EnalquilerListingRaw } from '../../types/enalquilerTypes';
import {
  normalizeCondition,
  normalizeEnergyRating,
  parseSpanishFeatures,
} from '../../../../shared/spanish-value-mappings';

export function transformHouse(listing: EnalquilerListingRaw): HousePropertyTierI {
  const features = parseSpanishFeatures(listing.features || []);

  return {
    property_category: 'house',
    title: listing.title || `House ${listing.id}`,
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: 'rent',

    location: {
      address: listing.location.address || undefined,
      city: listing.location.city || '',
      region: listing.location.province || undefined,
      country: 'ES',
      coordinates: (listing.location.lat && listing.location.lng)
        ? { lat: listing.location.lat, lon: listing.location.lng }
        : undefined,
    },

    property_subtype: 'detached',
    bedrooms: listing.rooms ? Math.max(listing.rooms - 1, 0) : 0,
    bathrooms: listing.bathrooms || undefined,
    sqm_living: listing.sqm || 0,
    sqm_plot: listing.plotSize || 0,

    has_garden: listing.hasGarden ?? features.garden ?? false,
    has_garage: listing.hasGarage ?? features.garage ?? false,
    has_parking: listing.hasParking ?? features.parking ?? false,
    has_basement: listing.hasBasement ?? features.storage ?? false,
    has_pool: listing.hasPool ?? features.pool ?? false,
    has_terrace: listing.hasTerrace ?? features.terrace ?? false,
    has_balcony: listing.hasBalcony ?? features.balcony ?? false,

    energy_class: listing.energyCertificate
      ? normalizeEnergyRating(listing.energyCertificate) || undefined
      : undefined,
    condition: mapCondition(listing.condition),
    year_built: listing.yearBuilt || undefined,

    description: listing.description || undefined,
    images: listing.images.length > 0 ? listing.images : undefined,
    features: listing.features.length > 0 ? listing.features : undefined,

    agent: listing.agencyName ? {
      name: listing.agencyName,
      phone: listing.agencyPhone || undefined,
    } : undefined,

    source_url: listing.url,
    source_platform: 'enalquiler',
    portal_id: `enalquiler-${listing.id}`,
    status: 'active',

    country_specific: {
      portal_property_type: listing.propertyType,
      estate_type_id: listing.estateTypeId,
      has_air_conditioning: listing.hasAirConditioning ?? features.air_conditioning ?? undefined,
    },
  };
}

function mapCondition(raw: string | null | undefined): HousePropertyTierI['condition'] {
  if (!raw) return undefined;
  const mapped = normalizeCondition(raw);
  const conditionMap: Record<string, HousePropertyTierI['condition']> = {
    'new_build': 'new', 'brand_new': 'new', 'good': 'good', 'very_good': 'excellent',
    'excellent': 'excellent', 'renovated': 'after_renovation', 'fully_renovated': 'after_renovation',
    'needs_renovation': 'requires_renovation', 'like_new': 'excellent', 'move_in_ready': 'good',
  };
  return mapped ? conditionMap[mapped] || undefined : undefined;
}
