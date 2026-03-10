import { ApartmentPropertyTierI } from '@landomo/core';
import { EnalquilerListingRaw } from '../../types/enalquilerTypes';
import {
  normalizeCondition,
  normalizeEnergyRating,
  parseFloor,
  parseSpanishFeatures,
} from '../../../../shared/spanish-value-mappings';

export function transformApartment(listing: EnalquilerListingRaw): ApartmentPropertyTierI {
  const features = parseSpanishFeatures(listing.features || []);

  // Map enalquiler type ID to subtype
  const subtype = mapApartmentSubtype(listing.estateTypeId, listing.propertyType);

  return {
    property_category: 'apartment',
    title: listing.title || `Apartment ${listing.id}`,
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

    property_subtype: subtype,
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

    energy_class: listing.energyCertificate
      ? normalizeEnergyRating(listing.energyCertificate) || undefined
      : undefined,
    condition: mapCondition(listing.condition),
    year_built: listing.yearBuilt || undefined,
    hoa_fees: listing.communityFees || undefined,
    furnished: listing.isFurnished === true ? 'furnished' : listing.isFurnished === false ? 'not_furnished' : undefined,

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
      has_pool: listing.hasPool ?? features.pool ?? undefined,
    },
  };
}

function mapApartmentSubtype(estateTypeId: number, propertyType: string): ApartmentPropertyTierI['property_subtype'] {
  // 2=Piso, 3=Atico, 4=Duplex, 5=Loft, 6=Estudio, 7=Casa (handled in house transformer)
  const map: Record<number, ApartmentPropertyTierI['property_subtype']> = {
    2: 'standard',   // Piso
    3: 'penthouse',  // Atico
    4: 'maisonette', // Duplex
    5: 'loft',       // Loft
    6: 'studio',     // Estudio
  };
  if (propertyType === 'aticos') return 'penthouse';
  return map[estateTypeId] || 'standard';
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

