import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { PisosListingRaw, PisosDetailRaw } from '../types/pisosTypes';
import {
  normalizePropertyType,
  normalizeCondition,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeFurnished,
  normalizeTransactionType,
  parseSpanishArea,
  parseFloor,
  parseSpanishFeatures,
  parseSpanishNumber,
} from '../../../shared/spanish-value-mappings';
import { detectSubtypeFromSlug } from '../utils/categoryDetection';
import { buildUrl } from '../utils/pisosHelpers';

type PropertyResult = ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;

export function transformPisosToStandard(
  listing: PisosListingRaw,
  detail: PisosDetailRaw,
  category: 'apartment' | 'house' | 'land' | 'commercial'
): PropertyResult {
  switch (category) {
    case 'apartment': return transformApartment(listing, detail);
    case 'house': return transformHouse(listing, detail);
    case 'land': return transformLand(listing, detail);
    case 'commercial': return transformCommercial(listing, detail);
  }
}

function extractFeature(features: string[], keyword: string): boolean {
  return features.some(f => f.toLowerCase().includes(keyword.toLowerCase()));
}

function extractNumberFromFeatures(features: string[], keyword: string): number | null {
  for (const f of features) {
    if (f.toLowerCase().includes(keyword.toLowerCase())) {
      const match = f.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

function getTransactionType(listing: PisosListingRaw): 'sale' | 'rent' {
  if (listing.detailUrl.includes('/comprar/') || listing.detailUrl.includes('/venta/')) return 'sale';
  if (listing.detailUrl.includes('/alquilar/') || listing.detailUrl.includes('/alquiler/')) return 'rent';
  return 'sale';
}

function buildLocation(detail: PisosDetailRaw) {
  return {
    country: 'Spain',
    country_code: 'ES',
    city: detail.location.city || '',
    district: detail.location.neighborhood || undefined,
    address: detail.location.address || undefined,
    latitude: detail.location.latitude || undefined,
    longitude: detail.location.longitude || undefined,
  };
}

function buildMedia(detail: PisosDetailRaw) {
  if (detail.images.length === 0) return undefined;
  return {
    images: detail.images.map((url, i) => ({ url, order: i })),
  };
}

function buildAgent(detail: PisosDetailRaw) {
  if (!detail.agentName && !detail.agentPhone) return undefined;
  return {
    name: detail.agentName || '',
    phone: detail.agentPhone || undefined,
  };
}

function transformApartment(listing: PisosListingRaw, detail: PisosDetailRaw): ApartmentPropertyTierI {
  const allFeatures = [...detail.features, ...detail.featuresSummary];
  const amenities = parseSpanishFeatures(allFeatures);

  // Parse floor from listing or features
  let floor: number | undefined;
  if (listing.floor) {
    floor = parseFloor(listing.floor) ?? undefined;
  }

  // Parse sqm from summary if not in listing
  let sqm = listing.sqm || 0;
  for (const f of detail.featuresSummary) {
    if (f.includes('m²') && !sqm) {
      sqm = parseSpanishNumber(f.replace(/m[²2]/, '').trim()) || 0;
    }
  }

  return {
    property_category: 'apartment',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(detail),
    property_subtype: detectSubtypeFromSlug(listing.propertyTypeSlug) as any,
    bedrooms: listing.bedrooms || 0,
    bathrooms: listing.bathrooms ?? undefined,
    sqm,
    floor,
    has_elevator: amenities.elevator || false,
    has_balcony: amenities.balcony || false,
    has_parking: amenities.parking || amenities.garage || false,
    has_basement: amenities.storage || false,
    has_terrace: amenities.terrace || undefined,
    has_garage: amenities.garage || undefined,
    condition: normalizeCondition(allFeatures.find(f => f.toLowerCase().includes('estado') || f.toLowerCase().includes('reformad'))) as any,
    heating_type: normalizeHeatingType(allFeatures.find(f => f.toLowerCase().includes('calefac'))) || undefined,
    energy_class: normalizeEnergyRating(detail.energyCertificate) || undefined,
    furnished: normalizeFurnished(allFeatures.find(f => f.toLowerCase().includes('amuebla'))) as any,
    published_date: detail.lastUpdated || undefined,
    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'pisos-com',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: {
      ibi: null,
      community_fees: null,
      energy_certificate_status: detail.energyCertificate,
      is_new_development: detail.isNewDevelopment,
    },
  };
}

function transformHouse(listing: PisosListingRaw, detail: PisosDetailRaw): HousePropertyTierI {
  const allFeatures = [...detail.features, ...detail.featuresSummary];
  const amenities = parseSpanishFeatures(allFeatures);

  const sqmLiving = listing.sqm || 0;
  const sqmPlot = extractNumberFromFeatures(allFeatures, 'parcela') || extractNumberFromFeatures(allFeatures, 'terreno') || 0;

  return {
    property_category: 'house',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(detail),
    property_subtype: detectSubtypeFromSlug(listing.propertyTypeSlug) as any,
    bedrooms: listing.bedrooms || 0,
    bathrooms: listing.bathrooms ?? undefined,
    sqm_living: sqmLiving,
    sqm_plot: sqmPlot,
    has_garden: amenities.garden || false,
    has_garage: amenities.garage || false,
    has_parking: amenities.parking || amenities.garage || false,
    has_basement: amenities.storage || false,
    has_pool: amenities.pool || amenities.communal_pool || undefined,
    has_terrace: amenities.terrace || undefined,
    has_fireplace: amenities.fireplace || undefined,
    condition: normalizeCondition(allFeatures.find(f => f.toLowerCase().includes('estado'))) as any,
    heating_type: normalizeHeatingType(allFeatures.find(f => f.toLowerCase().includes('calefac'))) || undefined,
    energy_class: normalizeEnergyRating(detail.energyCertificate) || undefined,
    furnished: normalizeFurnished(allFeatures.find(f => f.toLowerCase().includes('amuebla'))) as any,
    published_date: detail.lastUpdated || undefined,
    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'pisos-com',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: {
      energy_certificate_status: detail.energyCertificate,
      is_new_development: detail.isNewDevelopment,
    },
  };
}

function transformLand(listing: PisosListingRaw, detail: PisosDetailRaw): LandPropertyTierI {
  const allFeatures = [...detail.features, ...detail.featuresSummary];
  const plotArea = listing.sqm || extractNumberFromFeatures(allFeatures, 'm²') || 0;

  return {
    property_category: 'land',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(detail),
    area_plot_sqm: plotArea,
    published_date: detail.lastUpdated || undefined,
    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'pisos-com',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: {
      energy_certificate_status: detail.energyCertificate,
    },
  };
}

function transformCommercial(listing: PisosListingRaw, detail: PisosDetailRaw): CommercialPropertyTierI {
  const allFeatures = [...detail.features, ...detail.featuresSummary];
  const amenities = parseSpanishFeatures(allFeatures);
  const sqmTotal = listing.sqm || 0;

  const subtypeMap: Record<string, any> = {
    'local': 'retail',
    'locales': 'retail',
    'nave': 'warehouse',
    'naves': 'warehouse',
    'oficina': 'office',
    'oficinas': 'office',
    'garaje': 'retail', // closest match
    'trastero': 'warehouse',
  };

  return {
    property_category: 'commercial',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(detail),
    property_subtype: subtypeMap[listing.propertyTypeSlug] || undefined,
    sqm_total: sqmTotal,
    has_elevator: amenities.elevator || false,
    has_parking: amenities.parking || amenities.garage || false,
    has_bathrooms: listing.bathrooms != null && listing.bathrooms > 0,
    bathroom_count: listing.bathrooms ?? undefined,
    condition: normalizeCondition(allFeatures.find(f => f.toLowerCase().includes('estado'))) as any,
    heating_type: normalizeHeatingType(allFeatures.find(f => f.toLowerCase().includes('calefac'))) || undefined,
    energy_class: normalizeEnergyRating(detail.energyCertificate) || undefined,
    published_date: detail.lastUpdated || undefined,
    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'pisos-com',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: {
      energy_certificate_status: detail.energyCertificate,
      is_new_development: detail.isNewDevelopment,
    },
  };
}
