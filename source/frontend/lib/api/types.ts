/**
 * API Type Definitions
 *
 * These types match the backend search-service API schema.
 * Source: search-service/src/types/search.ts
 */

// ============================================================================
// Search Request Types
// ============================================================================

export interface SearchFilters {
  // Core filters
  property_category?: 'apartment' | 'house' | 'land' | 'commercial';
  price_min?: number;
  price_max?: number;
  property_type?: string;
  transaction_type?: 'sale' | 'rent' | 'auction';
  city?: string;
  region?: string;
  country?: string;
  bedrooms?: number;
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;
  sqm_min?: number;
  sqm_max?: number;

  // Amenities
  has_parking?: boolean;
  has_garden?: boolean;
  has_pool?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_elevator?: boolean;
  has_garage?: boolean;
  has_basement?: boolean;

  // Portal filters
  portal?: string;
  portal_features?: string[];

  // Extended filters
  energy_class?: string;
  floor_min?: number;
  floor_max?: number;
  furnished?: string;
  construction_type?: string;
  sqm_plot_min?: number;
  sqm_plot_max?: number;
  year_built_min?: number;
  year_built_max?: number;

  // Country-specific filters
  // Czech Republic
  disposition?: string;
  ownership?: string;
  building_type?: string;
  condition?: string;

  // UK
  tenure?: string;
  council_tax_band?: string;
  epc_rating?: string | string[];
  epc_min_rating?: string;
  leasehold_min_years?: number;
  postcode_district?: string;

  // USA
  mls_number?: string;
  hoa_fee_max?: number;

  // Australia
  land_size_min?: number;

  // Bounding box filter (map viewport sync)
  bounds_north?: number;
  bounds_south?: number;
  bounds_east?: number;
  bounds_west?: number;

  // Full-text search
  search_query?: string;
}

export type SortByPreset = 'price_asc' | 'price_desc' | 'date_newest' | 'date_oldest';

export interface SearchRequest {
  countries?: string[];
  filters: SearchFilters;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  sort_by?: SortByPreset;
  page?: number;
  limit?: number;
}

export interface GeoSearchRequest {
  latitude: number;
  longitude: number;
  radius_km: number;
  countries?: string[];
  filters?: SearchFilters;
  limit?: number;
  page?: number;
  sort_by?: SortByPreset;
}

// ============================================================================
// Response Types
// ============================================================================

export interface PropertyResult {
  // Core fields
  id: string;
  portal: string;
  portal_id: string;
  title: string;
  price: number;
  currency: string;
  property_type: string;
  property_category: 'apartment' | 'house' | 'land' | 'commercial' | 'other';
  transaction_type: 'sale' | 'rent' | 'auction';

  // Location
  city: string;
  region: string;
  country: string;
  latitude?: number | string;
  longitude?: number | string;

  // Property details
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  monthly_rent?: number;
  energy_rating?: string;
  floor?: number;
  images?: string[];
  description?: string;

  // Timestamps
  created_at: string;
  updated_at?: string;
  last_seen_at?: string;

  // Status
  status?: string;

  // Country-specific fields
  czech_disposition?: string;
  czech_ownership?: string;
  uk_tenure?: string;
  uk_epc_rating?: string;
  usa_mls_number?: string;

  // Formatted fields (added by country modules)
  price_formatted?: string;
  disposition_description?: string;
  tenure_description?: string;
  country_name?: string;

  // Portal metadata
  portal_metadata?: any;
  portal_features?: string[];

  // Amenities
  has_parking?: boolean;
  has_garden?: boolean;
  has_pool?: boolean;
  has_balcony?: boolean;
  has_terrace?: boolean;
  has_elevator?: boolean;
  has_garage?: boolean;
  has_basement?: boolean;

  // Agent info
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;

  // Additional details (Tier 1 universal fields)
  condition?: string;
  heating_type?: string;
  furnished?: string;
  construction_type?: string;
  renovation_year?: number;
  available_from?: string;
  published_date?: string;
  deposit?: number;
  parking_spaces?: number;

  // Commission & costs
  is_commission?: boolean;
  commission_note?: string;

  // Universal extras
  year_built?: number;
  energy_class?: string;
  rooms?: number;

  // Source URL
  source_url?: string;

  // Location details
  district?: string;
  neighbourhood?: string;
  municipality?: string;

  // Source platform
  source_platform?: string;

  // Category-specific detail fields (returned by property detail endpoint)
  // Apartment
  apt_sqm?: number;
  apt_floor?: number;
  apt_total_floors?: number;
  apt_rooms?: number;
  apt_bedrooms?: number;
  apt_bathrooms?: number;
  apt_has_loggia?: boolean;
  apt_loggia_area?: number;
  apt_balcony_area?: number;
  apt_terrace_area?: number;
  apt_cellar_area?: number;
  apt_hoa_fees?: number;
  apt_energy_class?: string;
  apt_has_basement?: boolean;
  apt_property_subtype?: string;
  apt_floor_location?: string;
  apt_service_charges?: number;

  // House
  house_sqm_living?: number;
  house_sqm_total?: number;
  house_sqm_plot?: number;
  house_stories?: number;
  house_rooms?: number;
  house_bedrooms?: number;
  house_bathrooms?: number;
  house_garden_area?: number;
  house_terrace_area?: number;
  house_garage_count?: number;
  house_cellar_area?: number;
  house_energy_class?: string;
  house_year_built?: number;
  house_roof_type?: string;
  house_has_basement?: boolean;
  house_balcony_area?: number;
  house_has_fireplace?: boolean;
  house_has_attic?: boolean;
  house_has_pool?: boolean;
  house_property_subtype?: string;
  house_service_charges?: number;

  // Land
  land_area_plot_sqm?: number;
  land_zoning?: string;
  land_water_supply?: string;
  land_sewage?: string;
  land_electricity?: string;
  land_gas?: string;
  land_road_access?: string;
  land_building_permit?: string;
  land_property_subtype?: string;

  // Commercial
  comm_floor_area?: number;
  comm_property_subtype?: string;
  comm_floor_number?: number;
  comm_total_floors?: number;
  comm_ceiling_height?: number;
  comm_has_loading_bay?: boolean;
  comm_has_reception?: boolean;
  comm_energy_class?: string;
  comm_service_charges?: number;
}

// ============================================================================
// Price History
// ============================================================================

export interface PriceHistoryEntry {
  price: number;
  currency: string;
  recorded_at: string;
}

export interface PriceHistoryResponse {
  property_id: string;
  history: PriceHistoryEntry[];
  summary: {
    current_price: number;
    initial_price: number;
    price_change_pct: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface GeoSearchResult extends PropertyResult {
  distance_km: number;
  distance_formatted?: string;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SearchAggregations {
  by_country: Record<string, number>;
  by_property_type: Record<string, number>;
  by_transaction_type: Record<string, number>;
  price_range: {
    min: number;
    max: number;
    avg: number;
  };
  total_results: number;
}

export interface SearchResponse {
  total: number;
  results: PropertyResult[];
  pagination: PaginationMetadata;
  aggregations: SearchAggregations;
  query_time_ms: number;
  countries_queried: string[];
}

export interface GeoSearchResponse {
  center: {
    latitude: number;
    longitude: number;
  };
  radius_km: number;
  total: number;
  results: GeoSearchResult[];
  pagination: PaginationMetadata;
  query_time_ms: number;
}

// ============================================================================
// Property Details
// ============================================================================

export interface PropertyDetailsResponse {
  property: PropertyResult;
  similar_properties?: PropertyResult[];
  price_history?: Array<{
    date: string;
    price: number;
  }>;
  market_data?: {
    avg_price_per_sqm: number;
    median_price_area: number;
    price_trend_3m: number;
  };
}

// ============================================================================
// Filter Options
// ============================================================================

export interface FilterOptionValue {
  value: string;
  count: number;
  label?: string;
}

export interface FilterOptionsResponse {
  dispositions: FilterOptionValue[];
  ownerships: FilterOptionValue[];
  conditions: FilterOptionValue[];
  building_types: FilterOptionValue[];
  heating_types: FilterOptionValue[];
  furnished_options: FilterOptionValue[];
  portals: FilterOptionValue[];
  cities: FilterOptionValue[];
  price_range: { min: number; max: number };
  area_range: { min: number; max: number };
}

// ============================================================================
// Map Clustering Types
// ============================================================================

export interface MapClusterRequest {
  country: string;
  zoom: number;
  bounds: { north: number; south: number; east: number; west: number };
  filters?: Record<string, any>;
  viewport_width?: number;
  viewport_height?: number;
}

export interface MapCluster {
  clusterId: string;
  count: number;
  centerLat: number;
  centerLon: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  categoryCounts?: Record<string, number>;
  bounds?: { north: number; south: number; east: number; west: number };
}

export interface MapPropertyPreview {
  id: string;
  title: string;
  price: number;
  currency: string;
  propertyCategory: string;
  transactionType?: string;
  latitude: number;
  longitude: number;
  thumbnailUrl?: string;
  bedrooms?: number;
  sqm?: number;
}

export interface MapClusterResponse {
  strategy: 'geohash' | 'grid' | 'individual';
  zoom: number;
  bounds: { north: number; south: number; east: number; west: number };
  clusters?: MapCluster[];
  properties?: MapPropertyPreview[];
  total: number;
  query_time_ms: number;
  cached: boolean;
}

// ============================================================================
// Location Autocomplete Types
// ============================================================================

export interface LocationSuggestion {
  id: string;
  label: string;
  type: 'region' | 'district' | 'municipality' | 'neighbourhood' | 'street' | 'address';
  coordinates: { lat: number; lon: number };
  bounds?: { north: number; south: number; east: number; west: number };
  boundary_id?: string;
  admin_level?: number;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface PropertyCoordinates {
  lat: number;
  lng: number;
}

export interface PropertyFeature {
  id: string;
  name: string;
  icon: string;
}

// ============================================================================
// Mappers: Backend → Frontend
// ============================================================================

/**
 * Maps backend PropertyResult to frontend-friendly coordinates
 */
export function getPropertyCoordinates(property: PropertyResult): PropertyCoordinates | undefined {
  if (property.latitude !== undefined && property.longitude !== undefined) {
    const lat = typeof property.latitude === 'string' ? parseFloat(property.latitude) : property.latitude;
    const lng = typeof property.longitude === 'string' ? parseFloat(property.longitude) : property.longitude;
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return undefined;
}

/**
 * Maps backend amenities to frontend feature list
 */
export function getPropertyFeatures(property: PropertyResult): PropertyFeature[] {
  const features: PropertyFeature[] = [];

  if (property.has_parking) {
    features.push({ id: 'parking', name: 'Parking', icon: 'parking-circle' });
  }
  if (property.has_balcony) {
    features.push({ id: 'balcony', name: 'Balcony', icon: 'snowflake' });
  }
  if (property.has_terrace) {
    features.push({ id: 'terrace', name: 'Terrace', icon: 'sun' });
  }
  if (property.has_garden) {
    features.push({ id: 'garden', name: 'Garden', icon: 'tree-deciduous' });
  }
  if (property.has_elevator) {
    features.push({ id: 'elevator', name: 'Elevator', icon: 'move-vertical' });
  }
  if (property.has_garage) {
    features.push({ id: 'garage', name: 'Garage', icon: 'warehouse' });
  }
  if (property.has_pool) {
    features.push({ id: 'pool', name: 'Pool', icon: 'waves' });
  }
  if (property.has_basement) {
    features.push({ id: 'basement', name: 'Basement', icon: 'box' });
  }

  return features;
}

/**
 * Gets display address from property
 */
export function getPropertyAddress(property: PropertyResult): string {
  return property.title || property.city;
}

/**
 * Gets price per sqm
 */
export function getPricePerSqm(property: PropertyResult): number | undefined {
  if (property.price && property.sqm && property.sqm > 0) {
    return Math.round(property.price / property.sqm);
  }
  return undefined;
}

/**
 * Gets disposition display (Czech-specific)
 */
export function getDisposition(property: PropertyResult): string | undefined {
  return property.czech_disposition || property.disposition_description;
}

/**
 * Format currency
 */
export function formatPrice(price: number, currency: string = 'CZK'): string {
  if (price <= 1) return 'na dotaz';

  if (currency === 'CZK') {
    return `${price.toLocaleString('cs-CZ')} Kč`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
