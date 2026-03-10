import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { DonpisoListingRaw, DonpisoDetailRaw } from '../types/donpisoTypes';
import {
  normalizeCondition,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeFurnished,
  parseSpanishFeatures,
  parseFloor,
} from '../../../shared/spanish-value-mappings';
import {
  detectCategoryFromTitle,
  detectSubtypeFromTitle,
  detectTransactionType,
} from '../utils/categoryDetection';

type PropertyResult =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

export function transformDonpisoToStandard(
  listing: DonpisoListingRaw,
  detail: DonpisoDetailRaw,
): PropertyResult {
  const category = detectCategoryFromTitle(listing.title);

  switch (category) {
    case 'apartment':
      return transformApartment(listing, detail);
    case 'house':
      return transformHouse(listing, detail);
    case 'land':
      return transformLand(listing, detail);
    case 'commercial':
      return transformCommercial(listing, detail);
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getTransactionType(listing: DonpisoListingRaw): 'sale' | 'rent' {
  return listing.transactionType;
}

function buildLocation(listing: DonpisoListingRaw, detail: DonpisoDetailRaw) {
  return {
    country: 'Spain',
    country_code: 'ES',
    city: detail.location.city || '',
    district: detail.location.neighborhood || undefined,
    province: detail.location.province || undefined,
    address: detail.location.address || undefined,
    latitude: detail.location.latitude || undefined,
    longitude: detail.location.longitude || undefined,
  };
}

function buildMedia(detail: DonpisoDetailRaw) {
  if (detail.images.length === 0) return undefined;
  return {
    images: detail.images.map((url, i) => ({ url, order: i })),
  };
}

function buildAgent(detail: DonpisoDetailRaw) {
  if (!detail.agentName && !detail.agentPhone) return undefined;
  return {
    name: detail.agentName || 'donpiso',
    phone: detail.agentPhone || undefined,
    email: detail.agentEmail || undefined,
  };
}

function extractFeature(features: string[], keywords: string[]): boolean {
  return features.some(f =>
    keywords.some(kw => f.toLowerCase().includes(kw.toLowerCase()))
  );
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

function buildCountrySpecific(detail: DonpisoDetailRaw) {
  return {
    energy_certificate_status: detail.energyCertificate,
    is_new_development: detail.isNewDevelopment,
    construction_year: detail.constructionYear,
    agent_email: detail.agentEmail,
  };
}

// ─── Category transformers ────────────────────────────────────────────────────

function transformApartment(
  listing: DonpisoListingRaw,
  detail: DonpisoDetailRaw
): ApartmentPropertyTierI {
  const amenities = parseSpanishFeatures(detail.features);
  const allFeatures = detail.features;

  let floor: number | undefined;
  if (detail.floor) {
    const parsed = parseFloor(detail.floor);
    if (parsed !== null) floor = parsed;
  }

  const sqm = detail.sqm || 0;
  const bedrooms = detail.bedrooms || 0;

  return {
    property_category: 'apartment',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(listing, detail),
    property_subtype: detectSubtypeFromTitle(listing.title) as any,

    // Apartment-required fields
    bedrooms,
    bathrooms: detail.bathrooms ?? undefined,
    sqm,
    floor,

    // Apartment boolean amenities (required)
    has_elevator: amenities.elevator || false,
    has_balcony: amenities.balcony || false,
    has_parking: amenities.parking || amenities.garage || false,
    has_basement: amenities.storage || false,

    // Optional apartment fields
    has_terrace: amenities.terrace || undefined,
    has_garage: amenities.garage || undefined,

    // Universal Tier I fields
    condition: normalizeCondition(
      allFeatures.find(f =>
        f.toLowerCase().includes('estado') ||
        f.toLowerCase().includes('reformad') ||
        f.toLowerCase().includes('nueva')
      )
    ) as any,
    heating_type: normalizeHeatingType(
      allFeatures.find(f => f.toLowerCase().includes('calefac'))
    ) || undefined,
    energy_class: normalizeEnergyRating(detail.energyCertificate) || undefined,
    furnished: normalizeFurnished(
      allFeatures.find(f => f.toLowerCase().includes('amuebla'))
    ) as any,

    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'donpiso',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: buildCountrySpecific(detail),
  };
}

function transformHouse(
  listing: DonpisoListingRaw,
  detail: DonpisoDetailRaw
): HousePropertyTierI {
  const amenities = parseSpanishFeatures(detail.features);
  const allFeatures = detail.features;

  const sqmLiving = detail.sqm || 0;
  const sqmPlot = detail.sqmPlot ||
    extractNumberFromFeatures(allFeatures, 'parcela') ||
    extractNumberFromFeatures(allFeatures, 'terreno') ||
    0;

  return {
    property_category: 'house',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(listing, detail),
    property_subtype: detectSubtypeFromTitle(listing.title) as any,

    // House-required fields
    bedrooms: detail.bedrooms || 0,
    bathrooms: detail.bathrooms ?? undefined,
    sqm_living: sqmLiving,
    sqm_plot: sqmPlot,

    // House boolean amenities (required)
    has_garden: amenities.garden || amenities.communal_garden || false,
    has_garage: amenities.garage || false,
    has_parking: amenities.parking || amenities.garage || false,
    has_basement: amenities.storage || false,

    // Optional house fields
    has_pool: amenities.pool || amenities.communal_pool || undefined,
    has_terrace: amenities.terrace || undefined,
    has_fireplace: amenities.fireplace || undefined,

    condition: normalizeCondition(
      allFeatures.find(f => f.toLowerCase().includes('estado'))
    ) as any,
    heating_type: normalizeHeatingType(
      allFeatures.find(f => f.toLowerCase().includes('calefac'))
    ) || undefined,
    energy_class: normalizeEnergyRating(detail.energyCertificate) || undefined,
    furnished: normalizeFurnished(
      allFeatures.find(f => f.toLowerCase().includes('amuebla'))
    ) as any,

    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'donpiso',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: buildCountrySpecific(detail),
  };
}

function transformLand(
  listing: DonpisoListingRaw,
  detail: DonpisoDetailRaw
): LandPropertyTierI {
  const allFeatures = detail.features;
  const plotArea = detail.sqmPlot || detail.sqm || 0;

  return {
    property_category: 'land',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(listing, detail),

    // Land-required field
    area_plot_sqm: plotArea,

    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'donpiso',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: buildCountrySpecific(detail),
  };
}

function transformCommercial(
  listing: DonpisoListingRaw,
  detail: DonpisoDetailRaw
): CommercialPropertyTierI {
  const amenities = parseSpanishFeatures(detail.features);
  const allFeatures = detail.features;
  const sqmTotal = detail.sqm || 0;

  const subtypeMap: Record<string, any> = {
    'local': 'retail',
    'locales': 'retail',
    'local_comercial': 'retail',
    'nave': 'warehouse',
    'naves': 'warehouse',
    'oficina': 'office',
    'oficinas': 'office',
    'garaje': 'retail',
    'trastero': 'warehouse',
    'edificio': 'office',
  };

  return {
    property_category: 'commercial',
    title: detail.title || listing.title,
    price: detail.price || listing.price || 0,
    currency: 'EUR',
    transaction_type: getTransactionType(listing),
    location: buildLocation(listing, detail),
    property_subtype: subtypeMap[listing.propertyTypeSlug] || undefined,

    // Commercial-required fields
    sqm_total: sqmTotal,
    has_elevator: amenities.elevator || false,
    has_parking: amenities.parking || amenities.garage || false,
    has_bathrooms: (detail.bathrooms != null && detail.bathrooms > 0),
    bathroom_count: detail.bathrooms ?? undefined,

    condition: normalizeCondition(
      allFeatures.find(f => f.toLowerCase().includes('estado'))
    ) as any,
    heating_type: normalizeHeatingType(
      allFeatures.find(f => f.toLowerCase().includes('calefac'))
    ) || undefined,
    energy_class: normalizeEnergyRating(detail.energyCertificate) || undefined,

    description: detail.description || listing.description || undefined,
    features: allFeatures.length > 0 ? allFeatures : undefined,
    media: buildMedia(detail),
    agent: buildAgent(detail),
    images: detail.images.length > 0 ? detail.images : undefined,
    source_url: detail.sourceUrl,
    source_platform: 'donpiso',
    portal_id: listing.portalId,
    status: 'active',
    country_specific: buildCountrySpecific(detail),
  };
}
