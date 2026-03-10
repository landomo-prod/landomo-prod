/**
 * Tier 3: Portal-Specific Field Definitions
 *
 * Each portal exposes different unique fields. These interfaces define
 * the complete set of raw (non-normalized) fields available from each portal.
 *
 * Fields are kept in their original names and raw formats here.
 * Normalization happens when mapping to Tier 2 (country-specific fields).
 */

import {
  ImmoScout24ATPortalMetadata,
  ImmoScout24DEPortalMetadata,
  WillhabenATPortalMetadata,
  ImmoweltDEPortalMetadata
} from './portal-metadata-austria';

/**
 * SReality.cz Portal Metadata (Tier 3)
 * API-based real estate portal with detailed structure
 */
export interface SRealityPortalMetadata {
  // Identity
  hash_id: number;
  locality_id?: number;
  seo_locality?: string;

  // Pricing
  price_note?: string;
  price_czk_value?: number;

  // Classification
  category_main_cb?: number;  // Main category code
  category_type_cb?: number;  // Type category code

  // Geographic
  gps_lat?: number;
  gps_lon?: number;
  map_lat?: number;
  map_lon?: number;

  // Media
  advert_images_count?: number;

  // Status & Flags
  is_featured?: boolean;
  is_premium?: boolean;

  // Portal-specific features
  [key: string]: any;
}

/**
 * BezRealitky.cz Portal Metadata (Tier 3)
 * MOST COMPREHENSIVE - 162+ available fields
 */
export interface BezRealitkyPortalMetadata {
  // Identity (HIGH VALUE)
  id: string;
  hash?: string;
  code?: string;
  external_id?: string;
  uri?: string;
  ruan_id?: string;

  // Classification
  estate_type?: string;  // BYT, DUM, POZEMEK, GARAZ, KANCELAR, etc.
  offer_type?: string;  // PRODEJ, PRONAJETI

  // ===== GEOGRAPHIC SEGMENTATION (HIGH VALUE - Tier 2) =====
  is_prague?: boolean;
  is_brno?: boolean;
  is_prague_west?: boolean;
  is_prague_east?: boolean;
  is_city_with_districts?: boolean;
  is_ts_region?: boolean;  // Moravian-Silesian

  // ===== AREA BREAKDOWN (MEDIUM VALUE - Tier 2) =====
  surface?: number;  // Main living area
  surface_land?: number;  // Land area
  balcony_surface?: number;
  loggia_surface?: number;
  terrace_surface?: number;
  cellar_surface?: number;

  // ===== FINANCIAL DETAILS (MEDIUM VALUE - Tier 2) =====
  deposit?: number;  // Kaučení vklad
  charges?: number;  // Service charges
  utility_charges?: number;
  utility_charges_note?: string;
  service_charges_note?: string;
  is_discounted?: boolean;
  original_price?: number;
  price_formatted?: string;

  // ===== RENTAL DETAILS (MEDIUM VALUE - Tier 2) =====
  short_term?: boolean;
  min_rent_days?: number;
  max_rent_days?: number;
  available_from?: string;

  // Building details
  position?: string;  // Street exposure
  situation?: string;  // Street exposure variant
  execution?: string;  // Execution quality
  reconstruction?: boolean;  // Major reconstruction?

  // ===== STATUS & LIFECYCLE FLAGS (MEDIUM VALUE) =====
  highlighted?: boolean;
  is_new?: boolean;
  reserved?: boolean;
  days_active?: number;
  visit_count?: number;
  conversation_count?: number;
  time_activated?: string;  // ISO timestamp
  tour_360?: string;  // 360 tour URL

  // ===== ADMINISTRATIVE FLAGS =====
  is_paused_by_system?: boolean;
  is_paused_by_user?: boolean;
  activation_pending?: boolean;
  archived?: boolean;
  time_deactivated?: string;
  time_expiration?: string;

  // Contact & Agent
  agent?: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  };

  // Features/Tags
  tags?: string[];
  briz_count?: number;
  show_own_est?: boolean;
  show_price_suggestion?: boolean;
  real_man_export_enabled?: boolean;
  charity?: boolean;

  // Translations
  description_sk?: string;  // Slovak translation
  description_en?: string;  // English translation

  // Address components
  address_input?: string;
  address_point_id?: string;

  // Additional
  fee?: number;
  threesome?: number;
  fivesome?: number;
  filename?: string;
  is_editable?: boolean;
  locale?: string;
  rent_platform_order?: number;
  rent_platform_status?: string;
  roommate?: string;  // Roommate details
  image_alt_text?: string;

  // Status codes
  time_order?: string;
  order?: number;

  // Media
  public_images?: Array<{
    id: string;
    url: string;
    filename: string;
    main: boolean;
    order: number;
    thumbnail_url?: string;
  }>;

  [key: string]: any;
}

/**
 * UlovDomov.cz Portal Metadata (Tier 3)
 * REST API with good coverage (83% extracted)
 */
export interface UlovDomovPortalMetadata {
  // Identity
  id: string;

  // Classification
  property_type?: string;  // FLAT, HOUSE, ROOM, LAND, COMMERCIAL
  offer_type?: string;  // SALE, RENT

  // Layout & Structure
  dispozice?: string;
  total_floors?: number;

  // Ownership & Condition
  ownership?: string;
  construction?: string;
  condition?: string;
  furnished?: string;
  energy_efficiency?: string;

  // Areas
  area?: number;
  plot_area?: number;
  floor?: number;

  // Amenities (Boolean fields)
  parking?: boolean;
  balcony?: boolean;
  terrace?: boolean;
  cellar?: boolean;
  elevator?: boolean;
  barrier_free?: boolean;

  // Contact Info
  contact_phone?: string;
  contact_email?: string;
  agent?: {
    name?: string;
    company?: string;
  };

  // Pricing
  price_note?: string;

  // Features
  features?: string[];

  // Media
  images?: string[];

  // Temporal
  published?: string;
  updated?: string;

  // Location
  location?: {
    street?: string;
    city?: string;
    district?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  // Description
  description?: string;

  [key: string]: any;
}

/**
 * Realingo.cz Portal Metadata (Tier 3)
 * GraphQL API with 30 fields, 83% extracted
 */
export interface RealingoPortalMetadata {
  // Identity
  id: string;

  // Classification
  purpose?: 'SALE' | 'RENT';
  property?: 'FLAT' | 'HOUSE' | 'LAND' | 'COMMERCIAL' | 'OTHER';

  // Czech fields
  ownership?: string;
  construction?: string;
  condition?: string;
  disposition?: string;

  // Areas
  area?: number;
  plot_area?: number;

  // Building
  floor?: number;
  total_floors?: number;

  // Agent
  agent?: {
    name?: string;
    phone?: string;
    email?: string;
  };

  // Amenities
  parking?: boolean;
  balcony?: boolean;
  terrace?: boolean;
  cellar?: boolean;
  elevator?: boolean;
  furnished?: boolean;

  // Energy
  energy_rating?: string;

  // Status
  status?: string;

  // Temporal
  published?: string;
  updated?: string;

  // Features & Media
  features?: string[];
  images?: string[];

  // URL
  url?: string;

  // Description
  description?: string;

  // Location
  location?: {
    name?: string;
    city?: string;
    district?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };

  [key: string]: any;
}

/**
 * Reality.cz Portal Metadata (Tier 3)
 * HTML-scraped portal with limited field coverage (43%)
 */
export interface RealityCzPortalMetadata {
  // Identity
  id: string;

  // Classification
  property_type?: string;
  transaction_type?: string;

  // Czech fields (extracted from HTML)
  disposition?: string;
  ownership?: string;
  condition?: string;
  furnished?: string;
  energy_rating?: string;
  heating_type?: string;
  construction_type?: string;

  // Areas
  area?: number;
  plot_area?: number;

  // Building
  floor?: number;
  total_floors?: number;

  // Location
  address?: string;
  city?: string;
  region?: string;
  district?: string;
  postal_code?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };

  // Features
  features?: string[];

  // Media
  images?: string[];
  floor_plan_urls?: string[];
  video_urls?: string[];

  // Amenities
  parking?: boolean;
  balcony?: boolean;
  terrace?: boolean;
  garage?: boolean;
  cellar?: boolean;
  elevator?: boolean;

  // Agent/Contact
  agent?: {
    name?: string;
    phone?: string;
    email?: string;
  };

  // Description
  description?: string;

  // Temporal
  published?: string;
  updated?: string;

  // URL
  url?: string;

  [key: string]: any;
}

/**
 * Idnes Reality Portal Metadata (Tier 3)
 * Playwright-scraped portal, 38% coverage with detail page potential
 */
export interface IdnesRealityPortalMetadata {
  // Identity
  id: string;

  // Classification
  property_type?: string;
  transaction_type?: string;

  // Czech fields (extracted from detail pages)
  rooms?: string;  // "3+kk" format
  condition?: string;
  energy_rating?: string;
  heating_type?: string;
  construction_type?: string;
  furnished?: string;

  // Areas
  area?: number;
  plot_area?: number;

  // Building
  floor?: number;
  price_text?: string;

  // Location
  address?: string;
  city?: string;
  district?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };

  // Features & Media
  features?: string[];
  images?: string[];
  virtual_tour_url?: string;
  floor_plan_urls?: string[];

  // Realtor (NOW EXTRACTED)
  realtor?: {
    name?: string;
    phone?: string;
    email?: string;
  };

  // Metadata
  metadata?: {
    views?: number;
    published?: string;
    updated?: string;
    tour_url?: string;
    virtual_tour?: string;
    matterport?: string;
  };

  // Description
  description?: string;

  // URL
  url?: string;

  // Raw HTML (if stored)
  raw_html?: string;

  // Attributes extracted from detail page
  _attributes?: Record<string, string>;
  _tourUrl?: string;
  _virtualTour?: string;
  _matterport?: string;

  [key: string]: any;
}

/**
 * Universal PortalMetadata (Tier 3 Wrapper)
 * Used by StandardProperty.portal_metadata
 */
export type PortalMetadataUnion =
  | SRealityPortalMetadata
  | BezRealitkyPortalMetadata
  | UlovDomovPortalMetadata
  | RealingoPortalMetadata
  | RealityCzPortalMetadata
  | IdnesRealityPortalMetadata
  | Record<string, any>;

export interface UniversalPortalMetadata {
  // Czech portals
  sreality?: SRealityPortalMetadata;
  bezrealitky?: BezRealitkyPortalMetadata;
  ulovdomov?: UlovDomovPortalMetadata;
  realingo?: RealingoPortalMetadata;
  reality?: RealityCzPortalMetadata;
  idnes?: IdnesRealityPortalMetadata;

  // Austrian portals
  immobilienscout24_at?: ImmoScout24ATPortalMetadata;
  willhaben?: WillhabenATPortalMetadata;

  // German portals
  immoscout24_de?: ImmoScout24DEPortalMetadata;
  immowelt?: ImmoweltDEPortalMetadata;

  [portalName: string]: any;
}

// Re-export Austrian/German portal types
export type {
  ImmoScout24ATPortalMetadata,
  ImmoScout24DEPortalMetadata,
  WillhabenATPortalMetadata,
  ImmoweltDEPortalMetadata
};
