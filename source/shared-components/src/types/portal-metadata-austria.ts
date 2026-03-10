/**
 * Tier 3: Austrian Portal-Specific Field Definitions
 *
 * Each Austrian portal exposes different unique fields. These interfaces define
 * the complete set of raw (non-normalized) fields available from each portal.
 *
 * Fields are kept in their original formats here.
 * Normalization happens when mapping to Tier 2 (AustrianSpecificFields).
 */

/**
 * ImmoScout24.at Portal Metadata (Tier 3)
 * API-based real estate portal with comprehensive structure
 */
export interface ImmoScout24ATPortalMetadata {
  // Identity
  expose_id: string;
  hash_id?: string;
  external_id?: string;

  // Classification (raw from API)
  property_type?: string;  // APARTMENT, HOUSE, SINGLE_FAMILY_HOUSE, etc.
  property_sub_type?: string;
  transaction_type?: string;  // RENT, SALE

  // Pricing (detailed)
  price_type?: string;
  price_interval_type?: string;
  original_price?: number;
  price_reduction?: boolean;
  price_reduction_amount?: number;
  additional_costs?: number;
  heating_costs?: number;
  operating_costs?: number;
  deposit?: number;
  provision_free?: boolean;

  // Advertisement metadata
  advertisement_type?: string;
  creation_date?: string;
  last_modification_date?: string;
  published_date?: string;
  expiration_date?: string;

  // Location precision
  precise_location?: boolean;
  location_quality?: string;

  // Building characteristics (raw)
  building_type?: string;
  heating_type?: string;
  energy_certificate?: {
    type?: string;
    value?: string;
    year?: number;
  };

  // Media counts
  image_count?: number;
  floor_plan_count?: number;
  video_count?: number;
  virtual_tour?: boolean;

  // Status flags
  is_featured?: boolean;
  is_premium?: boolean;
  is_top?: boolean;
  is_new?: boolean;
  is_price_reduced?: boolean;

  // Contact/Agency
  agency_id?: string;
  agency_name?: string;
  agent_id?: string;
  contact_type?: string;

  // View statistics
  view_count?: number;
  favorite_count?: number;

  // Geographic
  coordinates?: {
    lat: number;
    lon: number;
    precision?: string;
  };

  [key: string]: any;
}

/**
 * Willhaben.at Portal Metadata (Tier 3)
 * Austria's leading classifieds platform
 */
export interface WillhabenATPortalMetadata {
  // Identity
  id: string;
  vertical_id?: string;
  ad_type_id?: string;
  product_id?: string;
  ad_uuid?: string;
  org_id?: string;
  org_uuid?: string;

  // Classification
  property_type_id?: string;
  category_id?: string;
  category_tree_ids?: string[];

  // Status
  advert_status?: {
    id: string;
    description: string;
  };
  is_private?: boolean;
  is_bumped?: boolean;

  // Publishing
  published?: string;
  published_string?: string;

  // Location
  location_id?: string;
  location_quality?: string;

  // Display/Formatting
  price_for_display?: string;

  // Features (Willhaben-specific IDs)
  estate_preference?: string[];  // Array of feature IDs (24=Balkon, 25=Terrasse, etc.)

  // Images (detailed structure)
  images?: Array<{
    id?: string;
    name?: string;
    reference_image_url?: string;
    main_image_url?: string;
    thumbnail_image_url?: string;
    description?: string;
  }>;

  // Floor plans
  floor_plans?: Array<{
    url?: string;
    href?: string;
    reference?: string;
  }>;

  // SEO
  seo_url?: string;

  [key: string]: any;
}

/**
 * ImmobilienScout24.de Portal Metadata (Tier 3)
 * German version - similar structure to Austrian
 */
export interface ImmoScout24DEPortalMetadata {
  // Identity (same as AT version)
  expose_id: string;
  hash_id?: string;
  external_id?: string;

  // Classification
  property_type?: string;
  property_sub_type?: string;
  transaction_type?: string;

  // Pricing
  price_type?: string;
  price_interval_type?: string;
  original_price?: number;
  price_reduction?: boolean;
  additional_costs?: number;
  heating_costs?: number;
  operating_costs?: number;
  deposit?: number;
  courtage?: string;  // German-specific: broker commission
  provision_free?: boolean;

  // German-specific financial
  buying_price?: number;
  monthly_rent?: number;
  base_rent?: number;  // Kaltmiete
  total_rent?: number;  // Warmmiete

  // Advertisement
  advertisement_type?: string;
  creation_date?: string;
  last_modification_date?: string;
  published_date?: string;

  // Location
  precise_location?: boolean;
  location_quality?: string;

  // Building
  building_type?: string;
  heating_type?: string;
  energy_certificate?: {
    type?: string;
    value?: string;
    year?: number;
  };

  // Media
  image_count?: number;
  floor_plan_count?: number;
  video_count?: number;
  virtual_tour?: boolean;

  // Status
  is_featured?: boolean;
  is_premium?: boolean;
  is_top?: boolean;

  // Contact
  agency_id?: string;
  agency_name?: string;

  // Statistics
  view_count?: number;

  [key: string]: any;
}

/**
 * Immowelt.de Portal Metadata (Tier 3)
 * Major German real estate portal
 */
export interface ImmoweltDEPortalMetadata {
  // Identity
  id: string;
  expose_id?: string;

  // Classification
  estate_type?: string;
  marketing_type?: string;  // RENT, BUY

  // Pricing
  price?: number;
  price_type?: string;
  rental_price?: number;
  additional_costs?: number;
  heating_costs?: number;
  deposit?: string;
  courtage_note?: string;

  // Location
  address?: {
    street?: string;
    house_number?: string;
    city?: string;
    postal_code?: string;
    quarter?: string;
    state?: string;
  };

  // Geographic
  geo_location?: {
    latitude: number;
    longitude: number;
  };

  // Building details
  construction_year?: number;
  last_modernization?: number;
  object_condition?: string;

  // Features
  equipment?: string[];
  special_features?: string[];

  // Media
  attachments?: Array<{
    url?: string;
    type?: string;
    title?: string;
  }>;

  // Contact
  contact?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
  };

  // Statistics
  online_id?: string;
  global_object_key?: string;

  [key: string]: any;
}

/**
 * Universal Austrian/German Portal Metadata Wrapper
 */
export interface AustrianGermanPortalMetadata {
  immobilienscout24_at?: ImmoScout24ATPortalMetadata;
  willhaben?: WillhabenATPortalMetadata;
  immoscout24_de?: ImmoScout24DEPortalMetadata;
  immowelt?: ImmoweltDEPortalMetadata;
  [portalName: string]: any;
}
