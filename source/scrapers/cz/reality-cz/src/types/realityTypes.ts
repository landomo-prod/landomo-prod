/**
 * Reality.cz API types
 * Based on actual API responses (APK v3.1.4)
 */

// ============ API Response Types ============

export interface RealityApiGps {
  lat: number;
  lng: number;
}

export interface RealityApiPrice {
  price: number;
  unit: string;
}

export interface RealityApiPriceInfo {
  sale?: RealityApiPrice | null;
  rent?: RealityApiPrice | null;
  advance?: RealityApiPrice | null;
  commission?: boolean;
  note?: string;
  previous_price?: string | null;
  previous?: number | null;
  discount?: number | null;
  auction?: unknown | null;
}

export interface RealityApiInformationEntry {
  key: string;
  value: string;
}

export interface RealityApiPhoto {
  name: string;
  title: string;
}

export interface RealityApiVideo {
  url: string;
  type: string;
}

export interface RealityApiBadge {
  text: string;
  color: string;
}

export interface RealityApiContact {
  advertiser?: {
    name: string;
    company: string;
    email: string;
    title: string;
    phones: string[];
    has_name: boolean;
  };
  broker?: {
    name: string;
    email: string;
    phones: string[];
    photo: string;
    title: string;
    url?: string;
    gender: number;
  };
  real_estate?: {
    name: string;
    address: string;
    email: string;
    phones: string[];
    logo: string;
    title: string;
  };
}

/** Full detail response from GET /{advertisement_id}/ */
export interface RealityApiDetailResponse {
  id: string;
  custom_id?: string;
  type: string;  // Descriptive: "byt 2+1, 62 m², panel, osobní"
  title: string; // Often empty
  place: string;
  description?: string;
  offer_type?: number; // 1 = sale, 2 = rent
  price: RealityApiPriceInfo;
  location?: {
    gps: RealityApiGps;
    show_location: boolean;
    street?: Array<Array<RealityApiGps>>;
  };
  information?: RealityApiInformationEntry[];
  photos?: RealityApiPhoto[];
  badges?: RealityApiBadge[];
  badge?: RealityApiBadge | null;
  contact?: RealityApiContact;
  created_at?: string;
  modified_at?: string;
  // Fields that may or may not be present
  ok?: string;
  err?: string;
}

/** List item from search response */
export interface RealityApiListItem {
  id: string;
  type: string;  // Descriptive: "byt 2+1, 62 m², panel, osobní"
  place: string;
  gps: RealityApiGps;
  price: RealityApiPriceInfo;
  photos?: string[];
  photo_id?: string;
  offer_type?: number;
  badge?: RealityApiBadge | null;
}

/** Search response from GET /{offer_type}/{kind}/{region}/... */
export interface RealityApiSearchResponse {
  count: number;
  location?: string;
  location_gps?: RealityApiGps;
  description?: string;
  topped?: string;
  skip?: number;
  take?: number;
  viewport?: {
    southwest: RealityApiGps;
    northeast: RealityApiGps;
    zoom: number;
  };
  advertisements: RealityApiListItem[];
  // May be present on empty/error responses
  ok?: string;
  err?: string;
}

// ============ Internal Normalized Type ============

/**
 * RealityListing - normalized from API detail response
 * Used as input to category-specific transformers
 */
export interface RealityListing {
  // From API detail response
  id: string;
  title: string;
  api_type: string;  // API "type" field: "byt 2+1, 62 m², panel, osobní"
  transaction_type: 'sale' | 'rent';
  place: string;
  description?: string;
  url: string;

  // Structured price from API
  price?: number;
  currency: string;
  price_note?: string;
  previous_price?: string | null;
  has_commission: boolean;

  // GPS coordinates (NEW - not available in HTML scraping)
  gps?: RealityApiGps;

  // Structured information array from API detail
  information: RealityApiInformationEntry[];

  // Photos (constructed URLs)
  images: string[];

  // Videos & virtual tours
  videos?: RealityApiVideo[];
  virtual_tours?: RealityApiVideo[];

  // Contact info
  contact?: RealityApiContact;

  // Dates from API
  created_at?: string;
  modified_at?: string;

  // Outdated status
  outdated: boolean;
  outdated_text?: string | null;

  // Metadata
  scraped_at: string;
  custom_id?: string;
}

// ============ Helper to convert API detail to RealityListing ============

/**
 * Convert API detail response to internal RealityListing format
 */
export function apiDetailToListing(
  detail: RealityApiDetailResponse,
  transactionType: 'sale' | 'rent'
): RealityListing {
  // Extract price from structured price object
  const priceObj = transactionType === 'sale' ? detail.price?.sale : detail.price?.rent;

  // Build image URLs from photo paths
  const images = (detail.photos || [])
    .map(p => `https://api.reality.cz${p.name}`);

  // Use type as title fallback since title is often empty
  const title = detail.title || detail.type || detail.place || 'Unknown';

  return {
    id: detail.id,
    title,
    api_type: detail.type,
    transaction_type: transactionType,
    place: detail.place,
    description: detail.description,
    url: detail.id ? `https://reality.cz/${detail.id}/` : '',

    price: priceObj?.price,
    currency: priceObj?.unit === 'Kc' || priceObj?.unit === 'Kč' ? 'CZK' : (priceObj?.unit || 'CZK'),
    price_note: detail.price?.note || undefined,
    previous_price: detail.price?.previous_price,
    has_commission: detail.price?.commission ?? false,

    gps: detail.location?.gps,

    information: detail.information || [],

    images,

    contact: detail.contact,

    created_at: detail.created_at,
    modified_at: detail.modified_at,

    outdated: false,

    scraped_at: new Date().toISOString(),
    custom_id: detail.custom_id,
  };
}

// ============ Config Types ============

export interface RealityScraperConfig {
  base_url: string;
  max_pages?: number;
  items_per_page: number;
  delay_ms?: number;
}

export interface ScrapingContext {
  transaction_type: 'prodej' | 'pronajem';
  property_type: 'byty' | 'domy' | 'pozemky' | 'komercni';
  region?: string;
}

export type PropertyTypeCzech = 'byty' | 'domy' | 'pozemky' | 'komercni';
export type TransactionTypeCzech = 'prodej' | 'pronajem';
