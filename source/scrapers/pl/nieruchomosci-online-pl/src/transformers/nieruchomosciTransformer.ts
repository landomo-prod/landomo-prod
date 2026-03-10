import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { RawDetailData } from '../scrapers/detailScraper';

type TransformedProperty = ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI;

export function transformToTierI(raw: RawDetailData): TransformedProperty {
  switch (raw.propertyCategory) {
    case 'apartment':
      return transformApartment(raw);
    case 'house':
      return transformHouse(raw);
    case 'land':
      return transformLand(raw);
    case 'commercial':
      return transformCommercial(raw);
    default:
      throw new Error(`Unknown category: ${raw.propertyCategory}`);
  }
}

function buildLocation(raw: RawDetailData) {
  return {
    city: raw.location.city || 'Unknown',
    district: raw.location.district || undefined,
    street: raw.location.street || undefined,
    region: raw.location.voivodeship || undefined,
    country: 'Poland',
    country_code: 'PL',
    latitude: raw.location.lat || undefined,
    longitude: raw.location.lng || undefined,
  };
}

function hasFeature(features: string[], ...keywords: string[]): boolean {
  return features.some(f => {
    const lower = f.toLowerCase();
    return keywords.some(k => lower.includes(k));
  });
}

function lookupAttr(raw: RawDetailData, ...keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(raw.rawAttributes)) {
      if (k.includes(key)) return v;
    }
  }
  return null;
}

function parseCondition(raw: RawDetailData): ApartmentPropertyTierI['condition'] {
  const val = lookupAttr(raw, 'stan', 'condition', 'standard');
  if (!val) return undefined;
  const lower = val.toLowerCase();
  if (lower.includes('nowy') || lower.includes('deweloper')) return 'new';
  if (lower.includes('bardzo dobry') || lower.includes('wysoki')) return 'excellent';
  if (lower.includes('dobry')) return 'good';
  if (lower.includes('po remoncie') || lower.includes('odnowion')) return 'after_renovation';
  if (lower.includes('do remontu') || lower.includes('do odnowienia')) return 'requires_renovation';
  return undefined;
}

function parseHeatingType(raw: RawDetailData): string | undefined {
  const val = lookupAttr(raw, 'ogrzewanie', 'heating');
  return val || undefined;
}

function parseConstructionType(raw: RawDetailData): 'panel' | 'brick' | 'concrete' | 'mixed' | undefined {
  const val = lookupAttr(raw, 'materiał', 'budynek', 'construction', 'technologia');
  if (!val) return undefined;
  const lower = val.toLowerCase();
  if (lower.includes('wielka płyta') || lower.includes('panel')) return 'panel';
  if (lower.includes('cegł') || lower.includes('brick')) return 'brick';
  if (lower.includes('beton') || lower.includes('żelbet')) return 'concrete';
  if (lower.includes('mieszany') || lower.includes('inne')) return 'mixed';
  return undefined;
}

function transformApartment(raw: RawDetailData): ApartmentPropertyTierI {
  const rooms = raw.rooms || 1;
  const bedrooms = Math.max(0, rooms - 1);

  return {
    property_category: 'apartment',
    title: raw.title,
    price: raw.price || 0,
    currency: raw.currency,
    transaction_type: raw.transactionType,
    location: buildLocation(raw),
    bedrooms,
    bathrooms: parseIntFromAttrs(raw, 'łazienk', 'bathroom') || undefined,
    sqm: raw.area || 0,
    rooms,
    floor: raw.floor || undefined,
    total_floors: raw.totalFloors || undefined,
    has_elevator: hasFeature(raw.features, 'winda', 'elevator', 'lift'),
    has_balcony: hasFeature(raw.features, 'balkon', 'balcony'),
    has_parking: hasFeature(raw.features, 'parking', 'garaż', 'miejsce postojowe'),
    has_basement: hasFeature(raw.features, 'piwnica', 'piwniczka', 'basement', 'cellar'),
    has_terrace: hasFeature(raw.features, 'taras', 'terrace') || undefined,
    has_loggia: hasFeature(raw.features, 'loggia', 'logia') || undefined,
    has_garage: hasFeature(raw.features, 'garaż', 'garage') || undefined,
    year_built: raw.yearBuilt || undefined,
    condition: parseCondition(raw),
    heating_type: parseHeatingType(raw),
    construction_type: parseConstructionType(raw),
    energy_class: lookupAttr(raw, 'energia', 'energy', 'certyfikat') || undefined,
    description: raw.description || undefined,
    features: raw.features.length > 0 ? raw.features : undefined,
    images: raw.images.length > 0 ? raw.images : undefined,
    agent: raw.agent.name ? {
      name: raw.agent.name,
      phone: raw.agent.phone || undefined,
      agency: raw.agent.agency || undefined,
    } : undefined,
    source_url: raw.sourceUrl,
    source_platform: 'nieruchomosci-online',
    portal_id: `nieruchomosci-online-${raw.id}`,
    status: 'active',
    portal_metadata: {
      price_per_sqm: raw.pricePerSqm,
      raw_attributes: raw.rawAttributes,
    },
    country_specific: {
      voivodeship: raw.location.voivodeship,
    },
  };
}

function transformHouse(raw: RawDetailData): HousePropertyTierI {
  const rooms = raw.rooms || 1;
  const bedrooms = Math.max(0, rooms - 1);
  const plotArea = parseNumFromAttrs(raw, 'działka', 'plot', 'grunt', 'teren');

  return {
    property_category: 'house',
    title: raw.title,
    price: raw.price || 0,
    currency: raw.currency,
    transaction_type: raw.transactionType,
    location: buildLocation(raw),
    bedrooms,
    bathrooms: parseIntFromAttrs(raw, 'łazienk', 'bathroom') || undefined,
    sqm_living: raw.area || 0,
    sqm_plot: plotArea || 0,
    rooms,
    stories: parseIntFromAttrs(raw, 'piętr', 'kondygnac', 'stories', 'floors') || undefined,
    has_garden: hasFeature(raw.features, 'ogród', 'garden', 'ogródek'),
    has_garage: hasFeature(raw.features, 'garaż', 'garage'),
    has_parking: hasFeature(raw.features, 'parking', 'miejsce postojowe'),
    has_basement: hasFeature(raw.features, 'piwnica', 'basement', 'cellar'),
    has_pool: hasFeature(raw.features, 'basen', 'pool') || undefined,
    has_terrace: hasFeature(raw.features, 'taras', 'terrace') || undefined,
    has_fireplace: hasFeature(raw.features, 'kominek', 'fireplace') || undefined,
    year_built: raw.yearBuilt || undefined,
    condition: parseCondition(raw) as HousePropertyTierI['condition'],
    heating_type: parseHeatingType(raw),
    construction_type: parseHouseConstructionType(raw),
    energy_class: lookupAttr(raw, 'energia', 'energy') || undefined,
    description: raw.description || undefined,
    features: raw.features.length > 0 ? raw.features : undefined,
    images: raw.images.length > 0 ? raw.images : undefined,
    agent: raw.agent.name ? {
      name: raw.agent.name,
      phone: raw.agent.phone || undefined,
      agency: raw.agent.agency || undefined,
    } : undefined,
    source_url: raw.sourceUrl,
    source_platform: 'nieruchomosci-online',
    portal_id: `nieruchomosci-online-${raw.id}`,
    status: 'active',
    portal_metadata: {
      price_per_sqm: raw.pricePerSqm,
      raw_attributes: raw.rawAttributes,
    },
    country_specific: {
      voivodeship: raw.location.voivodeship,
    },
  };
}

function transformLand(raw: RawDetailData): LandPropertyTierI {
  return {
    property_category: 'land',
    title: raw.title,
    price: raw.price || 0,
    currency: raw.currency,
    transaction_type: raw.transactionType,
    location: buildLocation(raw),
    area_plot_sqm: raw.area || 0,
    has_water: hasFeature(raw.features, 'woda', 'water', 'wodociąg'),
    has_electricity: hasFeature(raw.features, 'prąd', 'elektry', 'electricity'),
    has_sewage: hasFeature(raw.features, 'kanalizacja', 'sewage', 'ściek'),
    has_gas: hasFeature(raw.features, 'gaz', 'gas'),
    has_road_access: hasFeature(raw.features, 'droga', 'road', 'dojazd', 'access'),
    description: raw.description || undefined,
    features: raw.features.length > 0 ? raw.features : undefined,
    images: raw.images.length > 0 ? raw.images : undefined,
    agent: raw.agent.name ? {
      name: raw.agent.name,
      phone: raw.agent.phone || undefined,
      agency: raw.agent.agency || undefined,
    } : undefined,
    source_url: raw.sourceUrl,
    source_platform: 'nieruchomosci-online',
    portal_id: `nieruchomosci-online-${raw.id}`,
    status: 'active',
    portal_metadata: {
      price_per_sqm: raw.pricePerSqm,
      raw_attributes: raw.rawAttributes,
    },
    country_specific: {
      voivodeship: raw.location.voivodeship,
    },
  } as LandPropertyTierI;
}

function transformCommercial(raw: RawDetailData): CommercialPropertyTierI {
  return {
    property_category: 'commercial',
    title: raw.title,
    price: raw.price || 0,
    currency: raw.currency,
    transaction_type: raw.transactionType,
    location: buildLocation(raw),
    sqm_total: raw.area || 0,
    has_elevator: hasFeature(raw.features, 'winda', 'elevator', 'lift'),
    has_parking: hasFeature(raw.features, 'parking', 'miejsce postojowe'),
    has_bathrooms: hasFeature(raw.features, 'łazienk', 'bathroom'),
    bathrooms: parseIntFromAttrs(raw, 'łazienk', 'bathroom') || undefined,
    floor: raw.floor || undefined,
    total_floors: raw.totalFloors || undefined,
    description: raw.description || undefined,
    features: raw.features.length > 0 ? raw.features : undefined,
    images: raw.images.length > 0 ? raw.images : undefined,
    agent: raw.agent.name ? {
      name: raw.agent.name,
      phone: raw.agent.phone || undefined,
      agency: raw.agent.agency || undefined,
    } : undefined,
    source_url: raw.sourceUrl,
    source_platform: 'nieruchomosci-online',
    portal_id: `nieruchomosci-online-${raw.id}`,
    status: 'active',
    portal_metadata: {
      price_per_sqm: raw.pricePerSqm,
      raw_attributes: raw.rawAttributes,
    },
    country_specific: {
      voivodeship: raw.location.voivodeship,
    },
  } as CommercialPropertyTierI;
}

function parseIntFromAttrs(raw: RawDetailData, ...keys: string[]): number | null {
  const val = lookupAttr(raw, ...keys);
  if (!val) return null;
  const match = val.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseNumFromAttrs(raw: RawDetailData, ...keys: string[]): number | null {
  const val = lookupAttr(raw, ...keys);
  if (!val) return null;
  const match = val.match(/([\d,.]+)/);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.')) || null;
}

function parseHouseConstructionType(raw: RawDetailData): 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined {
  const val = lookupAttr(raw, 'materiał', 'budynek', 'construction');
  if (!val) return undefined;
  const lower = val.toLowerCase();
  if (lower.includes('cegł') || lower.includes('brick')) return 'brick';
  if (lower.includes('drewn') || lower.includes('wood')) return 'wood';
  if (lower.includes('kamień') || lower.includes('stone')) return 'stone';
  if (lower.includes('beton') || lower.includes('żelbet')) return 'concrete';
  return 'mixed';
}
