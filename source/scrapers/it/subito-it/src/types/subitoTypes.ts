/**
 * Subito.it Hades API types
 *
 * Data is fetched from https://hades.subito.it/v1/search/items
 * which returns clean JSON without HTML parsing.
 */

export interface SubitoFeatureValue {
  value: string;
  key?: string;
}

export interface SubitoFeature {
  /** URI identifying the feature type, e.g. "/price", "/size", "/room", "/floor" */
  uri: string;
  label: string;
  type?: string;
  values: SubitoFeatureValue[];
}

export interface SubitoImageScale {
  uri: string;
  size?: string;
  /** Prefer secureUri when available */
  secureUri?: string;
}

export interface SubitoImage {
  scale: SubitoImageScale[];
  uid?: string;
}

export interface SubitoGeoPlace {
  key?: string;
  value?: string;
  /** Two-letter province code or full name */
  short_name?: string;
  friendly_name?: string;
  level?: number;
  istat?: string;
  region_id?: string;
}

export interface SubitoGeoMap {
  address?: string;
  latitude?: string;
  longitude?: string;
  zoom?: string;
}

export interface SubitoGeo {
  city?: SubitoGeoPlace;
  region?: SubitoGeoPlace;
  province?: SubitoGeoPlace;
  town?: SubitoGeoPlace;
  map?: SubitoGeoMap;
}

export interface SubitoAdType {
  key: string;
  value: string;
  weight?: number;
}

export interface SubitoAdCategory {
  key?: string;
  value?: string;
  friendly_name?: string;
  macrocategory_id?: string;
  weight?: number;
}

export interface SubitoDates {
  display?: string;
  expiration?: string;
  display_iso8601?: string;
  expiration_iso8601?: string;
}

export interface SubitoAdvertiser {
  user_id?: string;
  name?: string;
  type?: string;
}

/**
 * A single ad item as returned by the Hades search API (ads[])
 * or a detail page.
 */
export interface SubitoItem {
  /** Unique resource identifier, e.g. "id:ad:608241847:list:636897239" */
  urn: string;
  subject?: string;
  body?: string;
  type?: SubitoAdType;
  category?: SubitoAdCategory;
  features?: SubitoFeature[];
  images?: SubitoImage[];
  images_360?: SubitoImage[];
  geo?: SubitoGeo;
  advertiser?: SubitoAdvertiser;
  dates?: SubitoDates;
  urls?: {
    default?: string;
    mobile?: string;
  };
  status?: string;
}

/**
 * Top-level response from https://hades.subito.it/v1/search/items
 */
export interface SubitoHadesResponse {
  /** Total number of matching ads */
  count_all: number;
  /** Number of ads returned in this response */
  lines: number;
  /** Offset for the next page (equals start + lines) */
  start: number;
  ads: SubitoItem[];
  filters?: Record<string, unknown>;
  checknew?: string;
}

// Legacy stubs kept for compatibility with existing code paths
export interface SubitoSearchPageProps {
  items?: SubitoItem[];
  totalAds?: number;
  totalPages?: number;
  currentPage?: number;
  adsPerPage?: number;
}

export interface SubitoDetailPageProps {
  ad?: SubitoItem;
}

export interface SubitoNextData {
  props?: {
    pageProps?: SubitoSearchPageProps & SubitoDetailPageProps;
  };
  page?: string;
}

// ---- Search configuration ----

export type SubitoCategory = 'appartamenti' | 'case-ville';
export type SubitoContract = 'vendita' | 'affitto';

/** Hades API category_id values for real estate */
export const SUBITO_CATEGORY_IDS: Record<SubitoCategory, number> = {
  'appartamenti': 7,
  'case-ville': 4,
};

/** Hades API type key: s=sale, k=rent */
export const SUBITO_CONTRACT_KEYS: Record<SubitoContract, string> = {
  'vendita': 's',
  'affitto': 'k',
};

export interface SubitoSearchConfig {
  category: SubitoCategory;
  contract: SubitoContract;
  regionSlug: string;
  /** Hades API region id (from /geo/regions endpoint) */
  regionId: number;
}

/** Minimal listing used for checksum comparison (Phase 1) */
export interface SubitoMinimalListing {
  portalId: string;
  urn: string;
  subject?: string;
  price?: number;
  sqm?: number;
  city?: string;
  date?: string;
  sourceUrl: string;
  config: SubitoSearchConfig;
  /** Full item for direct ingestion when detail fetch is not needed */
  item: SubitoItem;
}

/**
 * Italian regions with their Hades API region IDs.
 * Source: https://hades.subito.it/v1/geo/regions
 */
export const SUBITO_REGIONS: Array<{ regionSlug: string; regionId: number }> = [
  { regionSlug: 'abruzzo',               regionId: 13 },
  { regionSlug: 'basilicata',            regionId: 17 },
  { regionSlug: 'calabria',              regionId: 18 },
  { regionSlug: 'campania',              regionId: 15 },
  { regionSlug: 'emilia-romagna',        regionId: 8  },
  { regionSlug: 'friuli-venezia-giulia', regionId: 7  },
  { regionSlug: 'lazio',                 regionId: 11 },
  { regionSlug: 'liguria',               regionId: 3  },
  { regionSlug: 'lombardia',             regionId: 4  },
  { regionSlug: 'marche',                regionId: 12 },
  { regionSlug: 'molise',                regionId: 14 },
  { regionSlug: 'piemonte',              regionId: 2  },
  { regionSlug: 'puglia',                regionId: 16 },
  { regionSlug: 'sardegna',              regionId: 19 },
  { regionSlug: 'sicilia',               regionId: 20 },
  { regionSlug: 'toscana',               regionId: 9  },
  { regionSlug: 'trentino-alto-adige',   regionId: 5  },
  { regionSlug: 'umbria',                regionId: 10 },
  { regionSlug: 'valle-daosta',          regionId: 1  },
  { regionSlug: 'veneto',                regionId: 6  },
];
