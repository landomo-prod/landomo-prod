import { ApartmentPropertyTierI } from '@landomo/core';
import { HabitacliaListingRaw } from '../../types/habitacliaTypes';
import {
  normalizeCondition,
  normalizeEnergyRating,
  normalizePropertyType,
  normalizeTransactionType,
  parseFloor,
  parseSpanishFeatures,
} from '../../../../shared/spanish-value-mappings';

export function transformApartment(listing: HabitacliaListingRaw): ApartmentPropertyTierI {
  const features = parseSpanishFeatures(listing.features || []);
  const transType = normalizeTransactionType(listing.transactionType === 'venta' ? 'venta' : 'alquiler');
  const subtype = normalizePropertyType(listing.title?.split(' ')[0] || '');

  return {
    property_category: 'apartment',
    title: listing.title || `Apartment ${listing.id}`,
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: (transType === 'sale' ? 'sale' : 'rent') as 'sale' | 'rent',

    location: {
      address: listing.location.address || undefined,
      city: listing.location.city || '',
      region: listing.location.province || undefined,
      country: 'ES',
      coordinates: (listing.location.lat && listing.location.lng) ? { lat: listing.location.lat, lon: listing.location.lng } : undefined,    },

    property_subtype: mapApartmentSubtype(subtype),
    bedrooms: listing.rooms ? Math.max(listing.rooms - 1, 0) : 0,
    bathrooms: listing.bathrooms || undefined,
    sqm: listing.sqm || 0,
    floor: listing.floor ? parseFloor(listing.floor) || undefined : undefined,

    has_elevator: listing.hasElevator ?? features.elevator ?? false,
    has_balcony: listing.hasBalcony ?? features.balcony ?? false,
    has_parking: listing.hasParking ?? features.parking ?? false,
    has_basement: listing.hasBasement ?? features.storage ?? false,
    has_terrace: listing.hasTerrace ?? features.terrace ?? false,
    has_garage: listing.hasGarage ?? features.garage ?? false,

    energy_class: listing.energyCertificate ? normalizeEnergyRating(listing.energyCertificate) || undefined : undefined,
    condition: mapCondition(listing.condition),
    year_built: listing.yearBuilt || undefined,
    hoa_fees: listing.communityFees || undefined,

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
      has_air_conditioning: listing.hasAirConditioning ?? features.air_conditioning ?? undefined,
      has_pool: listing.hasPool ?? features.pool ?? undefined,
    },
  };
}

function mapApartmentSubtype(normalized: string | null): ApartmentPropertyTierI['property_subtype'] {
  if (!normalized) return undefined;
  const map: Record<string, ApartmentPropertyTierI['property_subtype']> = {
    'apartment': 'standard',
    'penthouse': 'penthouse',
    'loft': 'loft',
    'studio': 'studio',
    'duplex': 'maisonette',
  };
  return map[normalized] || undefined;
}

function mapCondition(raw: string | null | undefined): ApartmentPropertyTierI['condition'] {
  if (!raw) return undefined;
  const mapped = normalizeCondition(raw);
  const conditionMap: Record<string, ApartmentPropertyTierI['condition']> = {
    'new_build': 'new',
    'brand_new': 'new',
    'good': 'good',
    'very_good': 'excellent',
    'excellent': 'excellent',
    'renovated': 'after_renovation',
    'fully_renovated': 'after_renovation',
    'partially_renovated': 'after_renovation',
    'needs_renovation': 'requires_renovation',
    'like_new': 'excellent',
    'move_in_ready': 'good',
  };
  return mapped ? conditionMap[mapped] || undefined : undefined;
}
