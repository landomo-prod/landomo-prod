import { CommercialPropertyTierI } from '@landomo/core';
import { HabitacliaListingRaw } from '../../types/habitacliaTypes';
import {
  normalizeEnergyRating,
  normalizePropertyType,
  normalizeTransactionType,
  parseSpanishFeatures,
} from '../../../../shared/spanish-value-mappings';

export function transformCommercial(listing: HabitacliaListingRaw): CommercialPropertyTierI {
  const features = parseSpanishFeatures(listing.features || []);
  const transType = normalizeTransactionType(listing.transactionType === 'venta' ? 'venta' : 'alquiler');
  const subtype = normalizePropertyType(listing.title?.split(' ')[0] || '');

  return {
    property_category: 'commercial',
    title: listing.title || `Commercial ${listing.id}`,
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: (transType === 'sale' ? 'sale' : 'rent') as 'sale' | 'rent',

    location: {
      address: listing.location.address || undefined,
      city: listing.location.city || '',
      region: listing.location.province || undefined,
      country: 'ES',
      coordinates: (listing.location.lat && listing.location.lng) ? { lat: listing.location.lat, lon: listing.location.lng } : undefined,    },

    property_subtype: mapCommercialSubtype(subtype, listing.propertyType),
    sqm_total: listing.sqm || 0,

    has_elevator: listing.hasElevator ?? features.elevator ?? false,
    has_parking: listing.hasParking ?? features.parking ?? false,
    has_bathrooms: listing.bathrooms ? listing.bathrooms > 0 : false,
    bathroom_count: listing.bathrooms || undefined,

    energy_class: listing.energyCertificate ? normalizeEnergyRating(listing.energyCertificate) || undefined : undefined,

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
    },
  };
}

function mapCommercialSubtype(normalized: string | null, searchType: string): CommercialPropertyTierI['property_subtype'] {
  if (searchType === 'oficinas') return 'office';
  if (searchType === 'naves') return 'warehouse';
  if (!normalized) return 'retail';
  const map: Record<string, CommercialPropertyTierI['property_subtype']> = {
    'shop': 'retail', 'commercial': 'retail', 'warehouse': 'warehouse',
    'industrial': 'industrial', 'office': 'office', 'hotel': 'hotel',
  };
  return map[normalized] || 'retail';
}
