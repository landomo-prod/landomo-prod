/**
 * Search Type Definitions
 */

export interface SearchFilters {
  // Global filters (work everywhere)
  property_category?: string;          // apartment, house, land, commercial (partition key)
  price_min?: number;
  price_max?: number;
  property_type?: string;              // apartment, house, etc.
  transaction_type?: string;           // sale, rent
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

  // Portal filters
  portal?: string;                     // "sreality", "rightmove", "domain"
  portal_features?: string[];          // ["3d_tour", "video"]

  // Universal property attribute filters
  energy_class?: string;
  floor_min?: number;
  floor_max?: number;
  furnished?: string;                  // 'furnished', 'not_furnished', 'partially_furnished'
  construction_type?: string;          // 'brick', 'panel', 'wood', 'concrete', 'mixed', 'stone', 'prefab', 'other'
  sqm_plot_min?: number;
  sqm_plot_max?: number;
  year_built_min?: number;
  year_built_max?: number;
  has_basement?: boolean;

  // Country-specific filters (passed through to country modules)
  // Czech
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

  // Geographic boundary filter
  boundary_id?: string;                // UUID from boundaries table — filter by polygon
  district?: string;                   // Text match on district column
  neighbourhood?: string;              // Text match on neighbourhood column
  municipality?: string;               // Text match on municipality column (admin level 8)

  // Internal: resolved boundary geometry (set by search engine, not by caller)
  _boundary_geojson?: string;

  // Bounding box filter (map viewport sync)
  bounds_north?: number;
  bounds_south?: number;
  bounds_east?: number;
  bounds_west?: number;

  // Full-text search
  search_query?: string;               // Search in title + description
}

export interface SearchSort {
  field: string;                       // price, created_at, sqm
  order: 'asc' | 'desc';
}

export interface SearchPagination {
  limit: number;                       // Default: 20, max: 100
  offset: number;
}

export type SortByPreset = 'price_asc' | 'price_desc' | 'date_newest' | 'date_oldest';

export interface SearchRequest {
  countries?: string[];                // Optional: ["czech", "uk"] or ["*"]
  filters: SearchFilters;
  sort?: SearchSort;
  sort_by?: SortByPreset;             // Shorthand: price_asc, price_desc, date_newest, date_oldest
  pagination?: SearchPagination;
  page?: number;                       // Page number (1-based), default: 1
  limit?: number;                      // Items per page, default: 20, max: 100
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PropertyResult {
  id: string;
  portal: string;
  portal_id: string;
  title: string;
  price: number;
  currency: string;
  property_type: string;
  transaction_type: string;
  city: string;
  region: string;
  country: string;
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  floor?: number;
  latitude?: number;
  longitude?: number;
  images?: string[];
  description?: string;
  created_at: string;
  updated_at?: string;

  // Country-specific fields (optional)
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

  // Agent info
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
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

export interface GeoSearchRequest {
  latitude: number;
  longitude: number;
  radius_km: number;
  countries?: string[];
  filters?: SearchFilters;
  limit?: number;
  page?: number;                       // Page number (1-based), default: 1
  sort_by?: SortByPreset;
}

export interface GeoSearchResult extends PropertyResult {
  distance_km: number;
  distance_formatted?: string;
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
