/**
 * Landomo Core Types - Property Definitions
 *
 * These types define both:
 * 1. Raw property data (portal-specific)
 * 2. Standardized property data (for Core Service/DB)
 */

/**
 * Standardized Property - Used by Core Service API
 * This is the target format that all scrapers should transform their data into
 */
/**
 * Enhanced media data with portal-specific image metadata
 */
export interface PropertyImage {
  url: string;
  alt?: string;
  caption?: string;
  order?: number;  // Image order in gallery
  is_main?: boolean;  // Main/featured image flag
  thumbnail_url?: string;  // Thumbnail variant
  width?: number;
  height?: number;
  filename?: string;  // Original filename from portal
  image_id?: string;  // Portal's image identifier
}

export interface PropertyMedia {
  // Images - enriched with metadata where available
  images?: (PropertyImage | string)[];  // Can be objects or simple URLs

  // Tours & Virtual Viewings
  virtual_tour_url?: string;  // Matterport or similar
  tour_360_url?: string;  // 360-degree panoramic tour
  video_tour_url?: string;  // Video walkthrough

  // Floor Plans
  floor_plan_url?: string;
  floor_plan_urls?: string[];  // Multiple floor plans

  // Other media
  videos?: string[];  // General video URLs
  documents?: string[];  // Brochures, PDFs, etc.

  // Image statistics
  total_images?: number;
  image_count?: number;
}

export interface StandardProperty {
  // Basic info
  title: string;
  price: number;
  currency: string;
  property_type: string;        // apartment, house, villa, studio, land, etc.
  transaction_type: 'sale' | 'rent';

  // Portal URLs
  source_url?: string;  // Original listing link on platform
  source_platform?: string;  // Platform name (sreality, bezrealitky, etc.)

  // Location (standardized)
  location: PropertyLocation;

  // Details (standardized for cross-country comparison)
  details: PropertyDetails;

  // Media (enhanced with metadata and tours)
  media?: PropertyMedia;

  // Legacy fields (backwards compatibility)
  images?: string[];
  videos?: string[];
  description?: string;
  description_language?: string;

  // Agent/Agency
  agent?: PropertyAgent;

  // Features (standardized array)
  features?: string[];

  // Amenities (structured booleans for filtering)
  amenities?: PropertyAmenities;

  // Energy rating
  energy_rating?: string;

  // ============ Universal property attributes (Tier 1) ============
  // These fields exist across ALL countries and are promoted from Tier 2
  // for cross-country querying and comparison

  // Property condition (universal across all markets)
  condition?: 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' |
              'before_renovation' | 'requires_renovation' | 'project' | 'under_construction' | string;

  // Heating system type
  heating_type?: 'central_heating' | 'district_heating' | 'gas_heating' | 'electric_heating' |
                 'oil_heating' | 'heat_pump' | 'floor_heating' | 'individual_heating' |
                 'hot_water' | 'none' | 'other' | string;

  // Furnished status (enum, supplements boolean is_furnished in amenities)
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished' | 'unfurnished';

  // Construction material/type
  construction_type?: 'panel' | 'brick' | 'stone' | 'wood' | 'concrete' | 'steel' |
                      'masonry' | 'mixed' | 'other' | string;

  // Temporal / availability
  available_from?: string;     // ISO date when property becomes available (rentals)
  published_date?: string;     // ISO date when listing was published on portal

  // Financial
  price_per_sqm?: number;
  hoa_fees?: number;
  property_tax?: number;
  deposit?: number;            // Security deposit (rentals)

  // ============ Enhanced: Portal-specific extensions ============
  portal_metadata?: PortalMetadata;
  portal_features?: string[];
  portal_ui_config?: PortalUIConfig;

  // ============ Country-specific fields (Tier 2) ============
  // Czech Republic: See CzechSpecificFields
  // Austria: See AustrianSpecificFields
  // Germany: See GermanSpecificFields
  // Other countries: Can extend with similar pattern
  country_specific?: (CzechSpecificFields | AustrianSpecificFields | GermanSpecificFields | SlovakSpecificFields | HungarianSpecificFields | FrenchSpecificFields | SpanishSpecificFields | UKSpecificFields) & Record<string, any>;

  // Status
  status?: 'active' | 'removed' | 'sold' | 'rented';
}

/**
 * Portal-specific metadata that doesn't fit unified schema
 * Structured by portal name for type safety
 */
export interface PortalMetadata {
  [portalName: string]: Record<string, any>;
}

/**
 * UI rendering configuration hints
 * Used by frontend to display portal-specific features
 */
export interface PortalUIConfig {
  primaryBadge?: string;           // "Premium", "New", "Reduced"
  badgeColor?: string;             // "gold", "blue", "red"
  showVirtualTour?: boolean;
  showVideo?: boolean;
  showFloorPlan?: boolean;
  contactAvailable?: boolean;
  highlightPrice?: boolean;
  [key: string]: any;
}

export interface PropertyLocation {
  address?: string;
  city: string;
  region?: string;
  country: string;
  postal_code?: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  geohash?: string;
}

export interface PropertyDetails {
  bedrooms?: number;          // Normalized bedroom count
  bathrooms?: number;
  sqm?: number;              // Living area in square meters
  sqm_type?: string;         // living, total, land
  floor?: number;
  total_floors?: number;
  rooms?: number;            // Total rooms (standardized)
  year_built?: number;
  renovation_year?: number;   // Year of last major renovation
  parking_spaces?: number;    // Number of parking spots (supplements boolean has_parking)
}

export interface PropertyAgent {
  name: string;
  phone?: string;
  email?: string;
  agency?: string;
  agency_logo?: string;
}

export interface PropertyAmenities {
  // Basic
  has_parking?: boolean;
  has_garage?: boolean;
  has_garden?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_basement?: boolean;
  has_elevator?: boolean;

  // Luxury/Comfort
  has_pool?: boolean;
  has_fireplace?: boolean;
  has_sauna?: boolean;
  has_gym?: boolean;
  has_ac?: boolean;
  has_wifi?: boolean;

  // Security & Storage
  has_security?: boolean;
  has_storage?: boolean;

  // Extended
  has_loggia?: boolean;
  has_hot_water?: boolean;
  is_barrier_free?: boolean;
  is_pet_friendly?: boolean;
  is_low_energy?: boolean;
  is_renovated?: boolean;

  // Status
  is_furnished?: boolean;
  is_new_construction?: boolean;
  is_luxury?: boolean;
}

/**
 * Czech-specific property fields (Tier 2: Country-Specific)
 *
 * COMPREHENSIVE Czech real estate attributes - ALL 172+ unmapped fields
 * Standardized Czech market classifications and normalized enums
 *
 * Organized by category:
 * - Core Czech Classifications (disposition, ownership, condition, etc.)
 * - Areas & Dimensions
 * - Building Structure & Features
 * - Infrastructure & Utilities
 * - Financial & Rental Terms
 * - Market Segmentation
 * - Temporal/Status Information
 * - Media
 */
export interface CzechSpecificFields {
  // ========== CORE CZECH CLASSIFICATIONS ==========

  // Room layout (Czech disposition: 1+kk, 2+1, etc.) - Tier 2 CRITICAL
  czech_disposition?: 'atypical' | '1+kk' | '1+1' | '2+kk' | '2+1' | '3+kk' | '3+1' |
                      '4+kk' | '4+1' | '5+kk' | '5+1' | '6+kk' | '6+1' | '7+kk' | '7+1' |
                      '8+kk' | '8+1' | 'studio' | 'atelier' | 'open_space';

  // Ownership type - Tier 2 CRITICAL
  czech_ownership?: 'personal' | 'cooperative' | 'state' | 'municipal' | 'company' | 'shared' | 'other';

  // Building/Property condition - Tier 2 CRITICAL
  condition?: 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' |
              'before_renovation' | 'requires_renovation' | 'project' | 'under_construction' | 'newly_renovated';

  // Furnished status - Tier 2 CRITICAL
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished' | 'unfurnished';

  // Energy efficiency (PENB standard) - Tier 2 CRITICAL
  energy_rating?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'unknown';

  // Heating type - Tier 2 CRITICAL
  heating_type?: 'central_heating' | 'individual_heating' | 'electric_heating' |
                 'gas_heating' | 'hot_water' | 'water_heating' | 'heat_pump' | 'other' | 'none' | 'unknown';

  // Construction type - Tier 2 CRITICAL
  construction_type?: 'panel' | 'brick' | 'stone' | 'wood' | 'concrete' | 'steel' | 'masonry' | 'mixed' | 'other';

  // ========== ADDITIONAL BUILDING/PROPERTY DETAILS ==========

  // Building type details (raw, not normalized)
  building_type?: string;  // detached, semi-detached, terraced, villa, cottage, etc.
  house_type?: string;  // For houses/villas: detached, semi_detached, terraced, villa, cottage
  land_type?: string;  // For land: arable, grassland, forest, water, built, orchard, vineyard, fishpond

  // ========== AREAS & DIMENSIONS (TIER 2 HIGH VALUE) ==========

  // Core areas
  area_living?: number;  // Living area (usable area) in m²
  area_total?: number;  // Total area in m²
  area_plot?: number;  // Plot/land area in m²
  area_garden?: number;  // Garden area in m²

  // Detailed area breakdown (BezRealitky - NEW)
  area_balcony?: number;  // Balcony area in m²
  area_terrace?: number;  // Terrace area in m²
  area_loggia?: number;  // Loggia area in m²
  area_cellar?: number;  // Cellar/basement area in m²

  // ========== BUILDING STRUCTURE & POSITIONING ==========

  // Building structure
  total_floors?: number;  // Total floors in building
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor' | 'raised_ground' | 'semi_basement';
  position_in_building?: 'corner' | 'middle' | 'end' | 'ground_facing' | 'rear_facing' | 'courtyard';

  // ========== INFRASTRUCTURE & UTILITIES ==========

  // Water/sewage
  water_supply?: string;  // mains, well, spring, rainwater, unknown
  sewage_type?: string;  // mains, septic, treatment_plant, none, unknown
  gas_supply?: boolean;  // Gas connection available?
  electricity_supply?: boolean;  // Electricity available?

  // Building quality/exposure
  street_exposure?: string;  // quiet, normal, busy, pedestrian, courtyard, upscale, average (raw from portal)
  execution_quality?: string;  // simple, standard, quality, luxury (raw from portal)

  // ========== TEMPORAL/CONDITION INFO ==========

  year_built?: number;  // Year of construction
  renovation_year?: number;  // Year of last major renovation
  building_age?: number;  // Calculated age in years
  low_energy?: boolean;  // Low energy building flag
  recently_renovated?: boolean;  // Recently renovated flag

  // ========== RENTAL-SPECIFIC FIELDS (TIER 2 - NEW) ==========

  // Rental terms
  rental_period?: 'short_term' | 'long_term' | 'seasonal' | 'occasional';
  short_term_rental?: boolean;  // Allows short-term rental?
  min_rental_days?: number;  // Minimum rental period in days (NEW - HIGH VALUE)
  max_rental_days?: number;  // Maximum rental period in days (NEW - HIGH VALUE)
  available_from?: string;  // Date when property becomes available (NEW - HIGH VALUE)

  // Rental costs
  monthly_price?: number;  // Monthly rent price
  deposit?: number;  // Security deposit amount (NEW - HIGH VALUE)
  charges?: number;  // Service charges/fees (NEW - MEDIUM VALUE)
  utility_charges?: number;  // Utility costs included (NEW - MEDIUM VALUE)
  utility_charges_note?: string;  // Details about what utilities are included
  service_charges_note?: string;  // Details about service charges

  // ========== GEOGRAPHIC SEGMENTATION (BezRealitky - TIER 2 NEW - HIGH VALUE) ==========

  // Geographic classification for market analysis
  is_prague?: boolean;  // Property in Prague
  is_brno?: boolean;  // Property in Brno
  is_prague_west?: boolean;  // Property in West Prague
  is_prague_east?: boolean;  // Property in East Prague
  is_city_with_districts?: boolean;  // City with multiple districts
  is_ts_region?: boolean;  // Moravian-Silesian region

  // ========== AMENITIES/FEATURES (NOT IN PropertyAmenities) ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  has_alarm?: boolean;
  has_climate_control?: boolean;
  has_smart_home?: boolean;
  has_laundry_room?: boolean;
  has_storage_room?: boolean;

  // ========== MEDIA & DOCUMENTATION ==========

  image_urls?: string[];  // All image URLs from estate
  image_count?: number;  // Total image count
  floor_plan_urls?: string[];  // Floor plan URLs if available
  brochure_url?: string;  // Property brochure/document URL
  video_tour_url?: string;  // Video walkthrough URL
  virtual_tour_url?: string;  // Virtual tour URL (Matterport etc)
  tour_360_url?: string;  // 360° panoramic tour URL

  // ========== FLEXIBLE CATCH-ALL FOR PORTAL-SPECIFIC FIELDS ==========
  // Allows for any additional Czech-specific fields not covered above
  [key: string]: any;
}

/**
 * Austrian-specific property fields (Tier 2: Country-Specific)
 *
 * Austria and Germany share similar real estate market structures,
 * so these fields align closely with German standards.
 */
export interface AustrianSpecificFields {
  // ========== CORE AUSTRIAN CLASSIFICATIONS ==========

  // Property condition - standardized for AT/DE markets
  condition?: 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' |
              'before_renovation' | 'requires_renovation' | 'project' |
              'under_construction' | 'newly_renovated';

  // Furnished status
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished' | 'unfurnished';

  // Energy efficiency (EU PENB standard A-G)
  energy_rating?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'unknown';

  // Heating type
  heating_type?: 'central_heating' | 'individual_heating' | 'electric_heating' |
                 'gas_heating' | 'hot_water' | 'water_heating' | 'heat_pump' |
                 'district_heating' | 'oil_heating' | 'floor_heating' |
                 'other' | 'none' | 'unknown';

  // Construction/building type
  construction_type?: 'panel' | 'brick' | 'stone' | 'wood' | 'concrete' |
                      'steel' | 'masonry' | 'mixed' | 'other';

  // ========== BUILDING DETAILS ==========

  building_type?: string;
  year_built?: number;
  renovation_year?: number;
  building_age?: number;

  // ========== AREAS & DIMENSIONS ==========

  area_living?: number;
  area_total?: number;
  area_plot?: number;
  area_garden?: number;
  area_balcony?: number;
  area_terrace?: number;
  area_loggia?: number;
  area_cellar?: number;

  // ========== BUILDING STRUCTURE & POSITIONING ==========

  total_floors?: number;
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor' |
                   'raised_ground' | 'semi_basement';
  position_in_building?: 'corner' | 'middle' | 'end' | 'street_facing' |
                         'courtyard_facing';

  // ========== AUSTRIAN OWNERSHIP & RENTAL ==========

  ownership_type?: 'eigentumsrecht' | 'baurecht' | 'mietkauf' |
                   'erbpacht' | 'genossenschaft' | 'other';

  rental_period?: 'short_term' | 'long_term' | 'seasonal' | 'occasional';
  short_term_rental?: boolean;
  min_rental_days?: number;
  max_rental_days?: number;
  available_from?: string;

  monthly_price?: number;
  deposit?: number;
  operating_costs?: number;
  heating_costs?: number;
  additional_costs?: number;
  utility_charges?: number;
  service_charges?: number;

  // ========== INFRASTRUCTURE & UTILITIES ==========

  water_supply?: 'mains' | 'well' | 'spring' | 'rainwater' | 'unknown';
  sewage_type?: 'mains' | 'septic' | 'treatment_plant' | 'none' | 'unknown';
  gas_supply?: boolean;
  electricity_supply?: boolean;

  // ========== AMENITIES ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  has_alarm?: boolean;
  has_climate_control?: boolean;
  has_smart_home?: boolean;
  has_laundry_room?: boolean;
  has_storage_room?: boolean;

  accessible?: boolean;
  pets_allowed?: boolean;

  low_energy?: boolean;
  passive_house?: boolean;
  recently_renovated?: boolean;

  // ========== MEDIA ==========

  image_urls?: string[];
  image_count?: number;
  floor_plan_urls?: string[];
  brochure_url?: string;
  video_tour_url?: string;
  virtual_tour_url?: string;
  tour_360_url?: string;

  // ========== MARKET SEGMENTATION ==========

  is_luxury?: boolean;
  is_investment_property?: boolean;
  is_holiday_home?: boolean;

  // ========== FLEXIBLE CATCH-ALL ==========
  [key: string]: any;
}

/**
 * German-specific property fields (Tier 2: Country-Specific)
 *
 * Germany and Austria share very similar real estate market structures,
 * so these fields align closely with Austrian standards.
 */
export interface GermanSpecificFields {
  // ========== CORE GERMAN CLASSIFICATIONS ==========

  // Property condition - standardized for DE/AT markets
  condition?: 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' |
              'before_renovation' | 'requires_renovation' | 'project' |
              'under_construction' | 'newly_renovated';

  // Furnished status
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished' | 'unfurnished';

  // Energy efficiency (EU PENB standard A-G)
  energy_rating?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'unknown';

  // Heating type
  heating_type?: 'central_heating' | 'individual_heating' | 'electric_heating' |
                 'gas_heating' | 'hot_water' | 'water_heating' | 'heat_pump' |
                 'district_heating' | 'oil_heating' | 'floor_heating' |
                 'other' | 'none' | 'unknown';

  // Construction/building type
  construction_type?: 'panel' | 'brick' | 'stone' | 'wood' | 'concrete' |
                      'steel' | 'masonry' | 'mixed' | 'other';

  // ========== BUILDING DETAILS ==========

  building_type?: string;
  year_built?: number;
  renovation_year?: number;
  building_age?: number;

  // ========== AREAS & DIMENSIONS ==========

  area_living?: number;
  area_total?: number;
  area_plot?: number;
  area_garden?: number;
  area_balcony?: number;
  area_terrace?: number;
  area_loggia?: number;
  area_cellar?: number;

  // ========== BUILDING STRUCTURE & POSITIONING ==========

  total_floors?: number;
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor' |
                   'raised_ground' | 'semi_basement';
  position_in_building?: 'corner' | 'middle' | 'end' | 'street_facing' |
                         'courtyard_facing';

  // ========== GERMAN OWNERSHIP & RENTAL ==========

  ownership_type?: 'eigentum' | 'erbbaurecht' | 'mietkauf' |
                   'genossenschaft' | 'wohnungseigentum' | 'other';

  rental_period?: 'short_term' | 'long_term' | 'seasonal' | 'occasional';
  short_term_rental?: boolean;
  min_rental_days?: number;
  max_rental_days?: number;
  available_from?: string;

  monthly_price?: number;
  deposit?: number;
  operating_costs?: number;
  heating_costs?: number;
  additional_costs?: number;
  utility_charges?: number;
  service_charges?: number;

  hausgeld?: number;
  courtage?: number;

  // ========== INFRASTRUCTURE & UTILITIES ==========

  water_supply?: 'mains' | 'well' | 'spring' | 'rainwater' | 'unknown';
  sewage_type?: 'mains' | 'septic' | 'treatment_plant' | 'none' | 'unknown';
  gas_supply?: boolean;
  electricity_supply?: boolean;

  // ========== AMENITIES ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  has_alarm?: boolean;
  has_climate_control?: boolean;
  has_smart_home?: boolean;
  has_laundry_room?: boolean;
  has_storage_room?: boolean;

  accessible?: boolean;
  pets_allowed?: boolean;

  low_energy?: boolean;
  passive_house?: boolean;
  kfw_standard?: string;
  recently_renovated?: boolean;

  // ========== MEDIA ==========

  image_urls?: string[];
  image_count?: number;
  floor_plan_urls?: string[];
  brochure_url?: string;
  video_tour_url?: string;
  virtual_tour_url?: string;
  tour_360_url?: string;

  // ========== MARKET SEGMENTATION ==========

  is_luxury?: boolean;
  is_investment_property?: boolean;
  is_holiday_home?: boolean;
  is_denkmalschutz?: boolean;

  // ========== FLEXIBLE CATCH-ALL ==========
  [key: string]: any;
}

/**
 * Slovak-specific property fields (Tier 2: Country-Specific)
 *
 * Comprehensive Slovak real estate attributes
 * Standardized with English canonical values
 */
export interface SlovakSpecificFields {
  // ========== CORE SLOVAK CLASSIFICATIONS ==========

  // Room layout (Slovak disposition: 1-izbovy, 2-izbovy, etc.)
  disposition?: string;

  // Ownership type
  ownership?: 'personal' | 'cooperative' | 'state' | 'municipal' | 'other';

  // Property condition
  condition?: 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' |
              'after_partial_renovation' | 'before_renovation' | 'original' |
              'under_construction' | 'neglected';

  // Furnished status
  furnished?: 'furnished' | 'partially_furnished' | 'unfurnished';

  // Energy efficiency
  energy_rating?: 'a0' | 'a1' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

  // Heating type
  heating_type?: 'central_heating' | 'individual_heating' | 'electric_heating' |
                 'gas_heating' | 'floor_heating' | 'heat_pump' | 'district_heating' |
                 'solid_fuel' | 'solar' | 'other' | 'none';

  // Construction type
  construction_type?: 'brick' | 'panel' | 'wood' | 'concrete' | 'reinforced_concrete' |
                      'prefab' | 'steel' | 'lightweight' | 'mixed' | 'stone' |
                      'aerated_concrete' | 'new_build' | 'other';

  // ========== BUILDING DETAILS ==========

  building_type?: string;
  property_subtype?: string;
  year_built?: number;
  renovation_year?: number;
  building_age?: number;

  // ========== AREAS & DIMENSIONS ==========

  area_living?: number;
  area_total?: number;
  area_plot?: number;
  area_garden?: number;
  area_balcony?: number;
  area_terrace?: number;
  area_loggia?: number;
  area_cellar?: number;
  area_garage?: number;
  area_usable?: number;

  // ========== BUILDING STRUCTURE & POSITIONING ==========

  floor?: number;
  total_floors?: number;
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor' | 'raised_ground' | 'semi_basement';
  position_in_building?: 'corner' | 'middle' | 'end' | 'street_facing' | 'courtyard_facing';

  // Room details
  rooms?: number;
  bathrooms?: number;
  toilets?: number;
  bedroom_count?: number;

  // ========== INFRASTRUCTURE & UTILITIES ==========

  water_supply?: string;
  sewage_type?: string;
  gas_supply?: boolean;
  electricity_supply?: boolean;
  internet?: boolean;
  road_access?: string;

  // ========== AMENITIES ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  has_alarm?: boolean;
  has_smart_home?: boolean;
  has_storage_room?: boolean;
  elevator?: boolean;
  barrier_free?: boolean;
  garage?: boolean;
  pool?: boolean;
  sauna?: boolean;
  garden?: boolean;
  terrace?: boolean;
  balcony?: boolean;
  loggia?: boolean;

  // ========== RENTAL FIELDS ==========

  available_from?: string;
  monthly_rent?: number;
  service_charges?: number;
  utility_costs?: number;
  deposit?: number;
  price_per_sqm?: number;

  // ========== GEOGRAPHIC SEGMENTATION ==========

  is_bratislava?: boolean;
  is_kosice?: boolean;
  district?: string;
  cadastral_area?: string;
  municipality?: string;

  // ========== MEDIA ==========

  image_urls?: string[];
  image_count?: number;
  floor_plan_urls?: string[];
  video_tour_url?: string;
  virtual_tour_url?: string;

  // ========== FLEXIBLE CATCH-ALL ==========
  [key: string]: any;
}

/**
 * Hungarian-specific property fields (Tier 2: Country-Specific)
 *
 * Comprehensive Hungarian real estate attributes
 * Hungarian uses room counts (szoba) instead of disposition
 */
export interface HungarianSpecificFields {
  // ========== CORE HUNGARIAN CLASSIFICATIONS ==========

  // Room count (Hungarian uses room counts, not disposition)
  room_count?: number;
  half_rooms?: number;

  // Ownership type
  ownership?: 'freehold' | 'cooperative' | 'municipal' | 'state' | 'condominium' |
              'shared_ownership' | 'usufruct' | 'leasehold' | 'other';

  // Property condition
  condition?: 'new' | 'new_build' | 'like_new' | 'renovated' | 'fully_renovated' |
              'partially_renovated' | 'good' | 'average' | 'acceptable' |
              'needs_renovation' | 'poor' | 'under_construction' | 'move_in_ready';

  // Furnished status
  furnished?: 'furnished' | 'partially_furnished' | 'unfurnished';

  // Energy efficiency
  energy_rating?: 'aa_plus_plus' | 'aa_plus' | 'aa' | 'bb' | 'cc' | 'dd' | 'ee' |
                  'ff' | 'gg' | 'hh' | 'ii' | 'jj' |
                  'a_plus' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';

  // Heating type
  heating_type?: 'central' | 'district' | 'individual' | 'gas' | 'gas_circo' |
                 'gas_convector' | 'gas_boiler' | 'electric' | 'floor_heating' |
                 'heat_pump' | 'mixed' | 'solid_fuel' | 'wood' | 'oil' |
                 'fireplace' | 'stove' | 'solar' | 'none';

  // Construction type
  construction_type?: 'brick' | 'panel' | 'wood' | 'wood_frame' | 'adobe' | 'mixed' |
                      'concrete' | 'reinforced_concrete' | 'monolithic' | 'steel' |
                      'block' | 'cinder_block' | 'aerated_concrete' | 'stone' | 'new_build';

  // Comfort level (Hungarian-specific)
  comfort_level?: 'luxury' | 'double_comfort' | 'full_comfort' | 'comfort' |
                  'half_comfort' | 'no_comfort';

  // ========== BUILDING DETAILS ==========

  building_type?: string;
  property_subtype?: string;
  year_built?: number;
  renovation_year?: number;
  building_age?: number;

  // ========== AREAS & DIMENSIONS ==========

  area_living?: number;
  area_total?: number;
  area_plot?: number;
  area_garden?: number;
  area_balcony?: number;
  area_terrace?: number;
  area_loggia?: number;
  area_cellar?: number;
  area_garage?: number;
  area_usable?: number;

  // ========== BUILDING STRUCTURE & POSITIONING ==========

  floor?: number;
  total_floors?: number;
  floor_location?: 'ground_floor' | 'middle_floor' | 'top_floor' | 'raised_ground' | 'semi_basement';

  // Room details
  bathrooms?: number;
  toilets?: number;
  bedroom_count?: number;

  // ========== INFRASTRUCTURE & UTILITIES ==========

  water_supply?: string;
  sewage_type?: string;
  gas_supply?: boolean;
  electricity_supply?: boolean;
  internet?: boolean;

  // ========== AMENITIES ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  has_alarm?: boolean;
  has_smart_home?: boolean;
  has_storage_room?: boolean;
  elevator?: boolean;
  barrier_free?: boolean;
  garage?: boolean;
  pool?: boolean;
  sauna?: boolean;
  garden?: boolean;
  terrace?: boolean;
  balcony?: boolean;
  loggia?: boolean;

  // ========== HUNGARIAN-SPECIFIC FINANCIAL ==========

  monthly_rent?: number;
  service_charges?: number;
  utility_costs?: number;
  deposit?: number;
  price_per_sqm?: number;
  kozos_koltseg?: number;       // Common costs
  felujitasi_alap?: number;     // Renovation fund

  // ========== GEOGRAPHIC SEGMENTATION ==========

  is_budapest?: boolean;
  is_pest?: boolean;
  is_buda?: boolean;
  budapest_district?: number;   // Budapest districts I-XXIII
  county?: string;
  district?: string;
  settlement?: string;

  // ========== MEDIA ==========

  image_urls?: string[];
  image_count?: number;
  floor_plan_urls?: string[];
  video_tour_url?: string;
  virtual_tour_url?: string;

  // ========== FLEXIBLE CATCH-ALL ==========
  [key: string]: any;
}

/**
 * French-specific property fields (Tier 2: Country-Specific)
 *
 * French real estate has unique regulatory requirements including
 * DPE (Diagnostic de Performance Energétique) and GES ratings,
 * copropriété (co-ownership) rules, and specific tax structures.
 */
export interface FrenchSpecificFields {
  // ========== CORE FRENCH CLASSIFICATIONS ==========

  // Energy performance - DPE rating (A-G, mandatory in France)
  dpe_rating?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  dpe_value?: number;  // kWh/m²/year

  // Greenhouse gas emissions - GES rating (A-G, mandatory in France)
  ges_rating?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  ges_value?: number;  // kgCO2/m²/year

  // Copropriété (co-ownership)
  copropriete?: boolean;
  charges_copro?: number;  // Monthly co-ownership charges
  nb_lots_copro?: number;  // Number of lots in co-ownership
  syndic_type?: 'professional' | 'volunteer' | 'cooperative';

  // Property condition
  condition?: 'new' | 'excellent' | 'very_good' | 'good' | 'renovated' |
              'to_renovate' | 'to_refresh' | 'under_construction' | 'ruin';

  // Furnished status
  furnished?: 'furnished' | 'partially_furnished' | 'unfurnished';

  // Heating type
  heating_type?: 'central' | 'individual' | 'collective' | 'electric' |
                 'gas' | 'oil' | 'heat_pump' | 'wood' | 'solar' |
                 'floor_heating' | 'radiator' | 'none';

  // Construction type
  construction_type?: 'stone' | 'brick' | 'concrete' | 'wood' | 'mixed' |
                      'half_timber' | 'prefab' | 'steel' | 'other';

  // ========== BUILDING DETAILS ==========

  building_type?: string;
  year_built?: number;
  renovation_year?: number;

  // ========== AREAS & DIMENSIONS ==========

  area_living?: number;  // Surface habitable (Loi Carrez for copro)
  area_total?: number;
  area_plot?: number;   // Terrain
  area_carrez?: number;  // Loi Carrez certified area
  area_garden?: number;
  area_balcony?: number;
  area_terrace?: number;
  area_cellar?: number;

  // ========== BUILDING STRUCTURE ==========

  floor?: number;
  total_floors?: number;
  rooms?: number;  // Pièces
  bedrooms?: number;  // Chambres
  bathrooms?: number;  // Salles de bain
  shower_rooms?: number;  // Salles d'eau
  toilets?: number;

  // ========== FRENCH-SPECIFIC FINANCIAL ==========

  taxe_fonciere?: number;  // Annual property tax
  taxe_habitation?: number;  // Annual habitation tax
  honoraires?: number;  // Agency fees
  honoraires_charge?: 'buyer' | 'seller';  // Who pays fees
  prix_hors_honoraires?: number;  // Price excluding fees

  // ========== FRENCH REGULATIONS ==========

  loi_carrez?: boolean;  // Loi Carrez certification exists
  diagnostics_done?: boolean;
  amiante?: boolean;  // Asbestos diagnosis
  plomb?: boolean;  // Lead diagnosis
  termites?: boolean;  // Termite diagnosis
  risques_naturels?: boolean;  // Natural risks

  // ========== AMENITIES ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  elevator?: boolean;
  garage?: boolean;
  pool?: boolean;
  garden?: boolean;
  terrace?: boolean;
  balcony?: boolean;
  cellar?: boolean;
  parking?: boolean;
  digicode?: boolean;
  interphone?: boolean;

  // ========== GEOGRAPHIC ==========

  departement?: string;
  commune?: string;
  arrondissement?: string;
  quartier?: string;

  // ========== MEDIA ==========

  image_urls?: string[];
  image_count?: number;
  floor_plan_urls?: string[];
  video_tour_url?: string;
  virtual_tour_url?: string;

  // ========== FLEXIBLE CATCH-ALL ==========
  [key: string]: any;
}

/**
 * Spanish-specific property fields (Tier 2: Country-Specific)
 *
 * Spanish real estate has unique features including IBI tax,
 * community fees, cédula de habitabilidad, and nota simple.
 */
export interface SpanishSpecificFields {
  // ========== CORE SPANISH CLASSIFICATIONS ==========

  // Energy efficiency (mandatory since 2013)
  energy_rating?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'pending' | 'exempt';
  energy_consumption?: number;  // kWh/m²/year
  co2_emissions?: number;  // kgCO2/m²/year

  // Property condition
  condition?: 'new' | 'excellent' | 'good' | 'needs_renovation' |
              'to_renovate' | 'under_construction' | 'project';

  // Furnished status
  furnished?: 'furnished' | 'partially_furnished' | 'unfurnished';

  // Heating type
  heating_type?: 'central' | 'individual' | 'electric' | 'gas' |
                 'oil' | 'heat_pump' | 'air_conditioning' | 'radiant_floor' |
                 'biomass' | 'solar' | 'none';

  // Construction type
  construction_type?: 'brick' | 'stone' | 'concrete' | 'wood' | 'mixed' |
                      'prefab' | 'steel' | 'adobe' | 'other';

  // ========== BUILDING DETAILS ==========

  building_type?: string;
  year_built?: number;
  renovation_year?: number;

  // ========== AREAS & DIMENSIONS ==========

  area_constructed?: number;  // Superficie construida
  area_useful?: number;  // Superficie útil
  area_plot?: number;  // Parcela
  area_terrace?: number;
  area_garden?: number;

  // ========== BUILDING STRUCTURE ==========

  floor?: number;
  total_floors?: number;
  rooms?: number;  // Habitaciones
  bedrooms?: number;  // Dormitorios
  bathrooms?: number;  // Baños
  toilets?: number;  // Aseos

  // ========== SPANISH-SPECIFIC FINANCIAL ==========

  ibi_annual?: number;  // Impuesto sobre Bienes Inmuebles (annual property tax)
  community_fees?: number;  // Gastos de comunidad (monthly)
  basura?: number;  // Garbage collection fee
  plus_valia?: number;  // Capital gains tax estimate

  // ========== SPANISH REGULATIONS ==========

  cedula_habitabilidad?: boolean;  // Habitability certificate
  nota_simple?: boolean;  // Property registry extract
  referencia_catastral?: string;  // Cadastral reference
  vpo?: boolean;  // Vivienda de Protección Oficial (subsidized housing)
  orientacion?: string;  // Orientation (norte, sur, este, oeste)

  // ========== AMENITIES ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  elevator?: boolean;
  garage?: boolean;
  pool?: boolean;
  garden?: boolean;
  terrace?: boolean;
  balcony?: boolean;
  storage_room?: boolean;  // Trastero
  parking?: boolean;
  portero?: boolean;  // Doorman/concierge

  // ========== GEOGRAPHIC ==========

  comunidad_autonoma?: string;  // Autonomous community
  provincia?: string;  // Province
  municipio?: string;  // Municipality
  barrio?: string;  // Neighborhood
  zona?: string;  // Zone (costa, interior, etc.)

  // ========== MEDIA ==========

  image_urls?: string[];
  image_count?: number;
  floor_plan_urls?: string[];
  video_tour_url?: string;
  virtual_tour_url?: string;

  // ========== FLEXIBLE CATCH-ALL ==========
  [key: string]: any;
}

/**
 * UK-specific property fields (Tier 2: Country-Specific)
 *
 * UK real estate has unique features including tenure (freehold/leasehold),
 * council tax bands, EPC ratings, and stamp duty considerations.
 */
export interface UKSpecificFields {
  // ========== CORE UK CLASSIFICATIONS ==========

  // Tenure (critical in UK market)
  tenure?: 'freehold' | 'leasehold' | 'share_of_freehold' | 'commonhold';
  leasehold_years_remaining?: number;
  ground_rent?: number;  // Annual ground rent for leasehold
  service_charge?: number;  // Annual service charge

  // Council tax band (A-H in England/Scotland, A-I in Wales)
  council_tax_band?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i';
  council_tax_annual?: number;

  // EPC rating (Energy Performance Certificate, A-G)
  epc_rating?: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  epc_score?: number;  // Numerical score 1-100
  epc_potential?: string;  // Potential rating after improvements

  // Property condition
  condition?: 'new_build' | 'excellent' | 'good' | 'average' |
              'needs_modernisation' | 'needs_renovation' | 'project';

  // Furnished status
  furnished?: 'furnished' | 'part_furnished' | 'unfurnished';

  // Heating type
  heating_type?: 'gas_central' | 'electric' | 'oil' | 'lpg' |
                 'heat_pump' | 'biomass' | 'solar' | 'district' |
                 'storage_heaters' | 'underfloor' | 'none';

  // Construction type
  construction_type?: 'brick' | 'stone' | 'timber_frame' | 'concrete' |
                      'steel_frame' | 'rendered' | 'cladding' | 'mixed';

  // ========== BUILDING DETAILS ==========

  building_type?: string;
  year_built?: number;
  renovation_year?: number;
  listed_building?: boolean;  // Heritage/listed building
  listed_grade?: 'i' | 'ii_star' | 'ii';  // Listed building grade

  // ========== AREAS & DIMENSIONS ==========

  area_sqft?: number;  // UK uses square feet
  area_sqm?: number;  // Converted to metric
  area_acres?: number;  // For land/large plots
  area_hectares?: number;
  area_plot_sqft?: number;

  // ========== BUILDING STRUCTURE ==========

  total_floors?: number;
  rooms?: number;  // Total rooms
  bedrooms?: number;
  bathrooms?: number;
  reception_rooms?: number;  // Living/dining rooms (UK-specific)
  en_suites?: number;

  // ========== UK-SPECIFIC FINANCIAL ==========

  stamp_duty_estimate?: number;
  help_to_buy?: boolean;
  shared_ownership?: boolean;
  shared_ownership_percentage?: number;
  retirement_property?: boolean;

  // ========== AMENITIES ==========

  has_fireplace?: boolean;
  has_air_conditioning?: boolean;
  has_security_system?: boolean;
  has_conservatory?: boolean;  // UK-specific
  has_utility_room?: boolean;
  has_en_suite?: boolean;
  elevator?: boolean;
  garage?: boolean;
  pool?: boolean;
  garden?: boolean;
  terrace?: boolean;
  balcony?: boolean;
  parking?: boolean;
  off_street_parking?: boolean;
  driveway?: boolean;
  double_glazing?: boolean;

  // ========== GEOGRAPHIC ==========

  region?: string;  // e.g., South East, North West
  county?: string;
  postcode_area?: string;
  postcode_district?: string;

  // ========== MEDIA ==========

  image_urls?: string[];
  image_count?: number;
  floor_plan_urls?: string[];
  video_tour_url?: string;
  virtual_tour_url?: string;

  // ========== FLEXIBLE CATCH-ALL ==========
  [key: string]: any;
}

/**
 * Raw Property - Portal-specific data structure
 * Each scraper defines its own RawProperty type based on portal structure
 */
export interface RawProperty {
  id: string;
  url: string;
  [key: string]: any;  // Flexible structure per portal
}

/**
 * Core Service Ingestion Payload
 * What scrapers send to the Core Service API
 */
export interface IngestionPayload {
  portal: string;              // e.g., "domain", "rightmove", "immobiliare"
  portal_id: string;           // Portal's listing ID
  country: string;             // e.g., "australia", "uk", "italy"
  data: StandardProperty | Record<string, any>;      // Standardized property data (Tier I types or legacy StandardProperty)
  raw_data: any;              // Original portal response (preserved)
  scrape_run_id?: string;      // Optional: ID of the scrape run that produced this property
}

/**
 * Core Service Response
 */
export interface IngestionResponse {
  status: 'success' | 'error' | 'validation_error';
  property_id?: string;
  action?: 'created' | 'updated';
  changes?: string[];
  error?: string;
  errors?: any[];
}

/**
 * Listing Event - Change tracking
 */
export interface ListingEvent {
  listing_id: string;
  event_type: 'new' | 'updated' | 'removed' | 'reactivated';
  changed_fields?: string[];
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  detected_at?: Date;
  scraper_run_id?: string;
}

/**
 * Scraper Configuration (optional structure)
 */
export interface ScraperConfig {
  portal: string;
  country: string;
  baseUrl: string;

  // Rate limiting
  requestDelay?: number;
  maxConcurrent?: number;

  // Scraping options
  useStealthBrowser?: boolean;
  needsProxy?: boolean;

  // Timeouts
  navigationTimeout?: number;
  detailTimeout?: number;

  // Cron settings
  recheckAfterDays?: number;
  recheckBatchSize?: number;
}
