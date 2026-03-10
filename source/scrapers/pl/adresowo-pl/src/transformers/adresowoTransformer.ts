import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { AdresowoListingSummary } from '../scrapers/listingsScraper';
import { AdresowoDetailData } from '../scrapers/detailScraper';

type TransformedProperty = ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;

/**
 * Detect property category from the URL slug / category config.
 */
function detectCategory(categorySlug: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (categorySlug) {
    case 'mieszkania':
    case 'mieszkania-do-wynajecia':
      return 'apartment';
    case 'domy':
    case 'domy-do-wynajecia':
      return 'house';
    case 'dzialki':
      return 'land';
    case 'lokale':
    case 'lokale-do-wynajecia':
    case 'nieruchomosci-komercyjne':
    case 'nieruchomosci-komercyjne-wynajem':
      return 'commercial';
    default:
      return 'apartment';
  }
}

function detectTransactionType(categorySlug: string): 'sale' | 'rent' {
  return categorySlug.includes('wynajecia') ? 'rent' : 'sale';
}

function parseCondition(features: Record<string, string>): ApartmentPropertyTierI['condition'] | undefined {
  const val = (features['stan'] || features['stan wykończenia'] || '').toLowerCase();
  if (val.includes('nowe') || val.includes('deweloper')) return 'new';
  if (val.includes('bardzo dobry') || val.includes('idealny')) return 'excellent';
  if (val.includes('dobry')) return 'good';
  if (val.includes('po remoncie') || val.includes('odnowion')) return 'after_renovation';
  if (val.includes('do remontu') || val.includes('wymaga')) return 'requires_renovation';
  return undefined;
}

function parseBool(features: Record<string, string>, ...keys: string[]): boolean {
  for (const key of keys) {
    const val = (features[key] || '').toLowerCase();
    if (val === 'tak' || val === 'yes' || val === '1' || val === 'true') return true;
  }
  return false;
}

function parseNumber(features: Record<string, string>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const val = features[key];
    if (val) {
      const match = val.match(/([\d,\.]+)/);
      if (match) return parseFloat(match[1].replace(',', '.'));
    }
  }
  return undefined;
}

function buildLocation(summary: AdresowoListingSummary, detail?: AdresowoDetailData) {
  return {
    country: 'Poland',
    city: detail?.city || '',
    district: detail?.district || undefined,
    street: detail?.street || undefined,
    address: detail?.address || summary.location || undefined,
    latitude: detail?.latitude || undefined,
    longitude: detail?.longitude || undefined,
  };
}

function transformApartment(
  summary: AdresowoListingSummary,
  detail: AdresowoDetailData | undefined,
  transactionType: 'sale' | 'rent'
): ApartmentPropertyTierI {
  const f = detail?.features || {};
  const rooms = detail?.rooms || summary.rooms || 1;
  const bedrooms = Math.max(rooms - 1, 0);

  return {
    property_category: 'apartment',
    title: detail?.title || summary.title,
    price: detail?.price || summary.price || 0,
    currency: 'PLN',
    transaction_type: transactionType,
    location: buildLocation(summary, detail),
    bedrooms,
    rooms,
    bathrooms: parseNumber(f, 'łazienki', 'liczba łazienek'),
    sqm: detail?.area || summary.area || 0,
    floor: detail?.floor ?? summary.floor ?? undefined,
    total_floors: detail?.totalFloors ?? undefined,
    has_elevator: parseBool(f, 'winda'),
    has_balcony: parseBool(f, 'balkon'),
    has_parking: parseBool(f, 'parking', 'miejsce parkingowe', 'garaż'),
    has_basement: parseBool(f, 'piwnica', 'komórka lokatorska'),
    year_built: detail?.yearBuilt ?? undefined,
    condition: parseCondition(f),
    heating_type: f['ogrzewanie'] || undefined,
    construction_type: parseConstructionType(f),
    energy_class: f['klasa energetyczna'] || f['certyfikat energetyczny'] || undefined,
    description: detail?.description || undefined,
    images: detail?.images,
    features: Object.keys(f).length > 0 ? Object.entries(f).map(([k, v]) => `${k}: ${v}`) : undefined,
    source_url: detail?.sourceUrl || `https://www.adresowo.pl${summary.url}`,
    source_platform: 'adresowo',
    portal_id: summary.portalId,
    status: 'active',
    country_specific: {
      portal_category_slug: summary.categorySlug,
      raw_features: f,
    },
  };
}

function transformHouse(
  summary: AdresowoListingSummary,
  detail: AdresowoDetailData | undefined,
  transactionType: 'sale' | 'rent'
): HousePropertyTierI {
  const f = detail?.features || {};
  const rooms = detail?.rooms || summary.rooms || 1;

  return {
    property_category: 'house',
    title: detail?.title || summary.title,
    price: detail?.price || summary.price || 0,
    currency: 'PLN',
    transaction_type: transactionType,
    location: buildLocation(summary, detail),
    bedrooms: Math.max(rooms - 1, 0),
    rooms,
    bathrooms: parseNumber(f, 'łazienki', 'liczba łazienek'),
    sqm_living: detail?.area || summary.area || 0,
    sqm_plot: parseNumber(f, 'powierzchnia działki', 'działka') || 0,
    sqm_total: parseNumber(f, 'powierzchnia całkowita', 'pow. całkowita'),
    stories: parseNumber(f, 'piętra', 'kondygnacje', 'liczba pięter'),
    has_garden: parseBool(f, 'ogród', 'ogródek'),
    has_garage: parseBool(f, 'garaż'),
    has_parking: parseBool(f, 'parking', 'miejsce parkingowe'),
    has_basement: parseBool(f, 'piwnica'),
    has_pool: parseBool(f, 'basen'),
    has_terrace: parseBool(f, 'taras'),
    year_built: detail?.yearBuilt ?? undefined,
    condition: parseCondition(f) as HousePropertyTierI['condition'],
    heating_type: f['ogrzewanie'] || undefined,
    construction_type: parseHouseConstructionType(f),
    description: detail?.description || undefined,
    images: detail?.images,
    features: Object.keys(f).length > 0 ? Object.entries(f).map(([k, v]) => `${k}: ${v}`) : undefined,
    source_url: detail?.sourceUrl || `https://www.adresowo.pl${summary.url}`,
    source_platform: 'adresowo',
    portal_id: summary.portalId,
    status: 'active',
    country_specific: {
      portal_category_slug: summary.categorySlug,
      raw_features: f,
    },
  };
}

function transformLand(
  summary: AdresowoListingSummary,
  detail: AdresowoDetailData | undefined,
  transactionType: 'sale' | 'rent'
): LandPropertyTierI {
  const f = detail?.features || {};

  return {
    property_category: 'land',
    title: detail?.title || summary.title,
    price: detail?.price || summary.price || 0,
    currency: 'PLN',
    transaction_type: transactionType,
    location: buildLocation(summary, detail),
    area_plot_sqm: detail?.area || summary.area || 0,
    description: detail?.description || undefined,
    images: detail?.images,
    features: Object.keys(f).length > 0 ? Object.entries(f).map(([k, v]) => `${k}: ${v}`) : undefined,
    source_url: detail?.sourceUrl || `https://www.adresowo.pl${summary.url}`,
    source_platform: 'adresowo',
    portal_id: summary.portalId,
    status: 'active',
    country_specific: {
      portal_category_slug: summary.categorySlug,
      raw_features: f,
    },
  } as LandPropertyTierI;
}

function transformCommercial(
  summary: AdresowoListingSummary,
  detail: AdresowoDetailData | undefined,
  transactionType: 'sale' | 'rent'
): CommercialPropertyTierI {
  const f = detail?.features || {};

  return {
    property_category: 'commercial',
    title: detail?.title || summary.title,
    price: detail?.price || summary.price || 0,
    currency: 'PLN',
    transaction_type: transactionType,
    location: buildLocation(summary, detail),
    sqm_total: detail?.area || summary.area || 0,
    has_elevator: parseBool(f, 'winda'),
    has_parking: parseBool(f, 'parking', 'miejsce parkingowe'),
    has_bathrooms: parseNumber(f, 'łazienki', 'liczba łazienek') !== null,
    bathrooms: parseNumber(f, 'łazienki', 'liczba łazienek') ?? 0,
    description: detail?.description || undefined,
    images: detail?.images,
    features: Object.keys(f).length > 0 ? Object.entries(f).map(([k, v]) => `${k}: ${v}`) : undefined,
    source_url: detail?.sourceUrl || `https://www.adresowo.pl${summary.url}`,
    source_platform: 'adresowo',
    portal_id: summary.portalId,
    status: 'active',
    country_specific: {
      portal_category_slug: summary.categorySlug,
      raw_features: f,
    },
  } as CommercialPropertyTierI;
}

function parseConstructionType(f: Record<string, string>): ApartmentPropertyTierI['construction_type'] | undefined {
  const val = (f['rodzaj zabudowy'] || f['materiał budynku'] || f['typ budynku'] || '').toLowerCase();
  if (val.includes('panel') || val.includes('wielka płyta')) return 'panel';
  if (val.includes('cegła') || val.includes('ceglan')) return 'brick';
  if (val.includes('beton') || val.includes('żelbet')) return 'concrete';
  if (val.includes('mieszan')) return 'mixed';
  return undefined;
}

function parseHouseConstructionType(f: Record<string, string>): HousePropertyTierI['construction_type'] | undefined {
  const val = (f['materiał'] || f['rodzaj zabudowy'] || f['materiał budynku'] || '').toLowerCase();
  if (val.includes('cegła') || val.includes('ceglan')) return 'brick';
  if (val.includes('drewn') || val.includes('drew')) return 'wood';
  if (val.includes('kamie')) return 'stone';
  if (val.includes('beton') || val.includes('żelbet')) return 'concrete';
  if (val.includes('mieszan')) return 'mixed';
  return undefined;
}

/**
 * Main transformer: routes to category-specific transformer based on listing data.
 */
export function transformAdresowoProperty(
  summary: AdresowoListingSummary,
  detail: AdresowoDetailData | undefined,
  categorySlug: string
): TransformedProperty {
  const category = detectCategory(categorySlug);
  const transactionType = detectTransactionType(categorySlug);

  switch (category) {
    case 'apartment':
      return transformApartment(summary, detail, transactionType);
    case 'house':
      return transformHouse(summary, detail, transactionType);
    case 'land':
      return transformLand(summary, detail, transactionType);
    case 'commercial':
      return transformCommercial(summary, detail, transactionType);
  }
}
