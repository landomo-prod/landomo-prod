/**
 * Nehnutelnosti.sk API Response Types
 * Based on the official Nehnutelnosti.sk public API structure
 */

export interface NehnutelnostiListingResponse {
  _embedded?: {
    offers?: NehnutelnostiListing[];
    estates?: NehnutelnostiListing[];
  };
  items?: NehnutelnostiListing[];
  _links?: any;
  result_size?: number;
  per_page?: number;
  page?: number;
  total?: number;
}

export interface NehnutelnostiListing {
  id?: string | number;
  hash_id?: string | number;
  name?: string;
  title?: string;
  headline?: string;

  // Price
  price?: number;
  price_value?: number;
  price_czk?: number;
  price_eur?: number;
  currency?: string;
  price_note?: string;

  // Location
  locality?: string;
  address?: string;
  city?: string;
  region?: string;
  district?: string;
  location?: {
    lat?: number;
    lon?: number;
    latitude?: number;
    longitude?: number;
  };
  gps?: {
    lat?: number;
    lon?: number;
    latitude?: number;
    longitude?: number;
  };

  // Property type & transaction
  property_type?: string;
  category?: string;
  category_main_cb?: number;
  category_type_cb?: number;
  transaction_type?: string;
  type?: string;

  // Area & rooms
  area?: number;
  usable_area?: number;
  floor_area?: number;
  area_build?: number;
  area_land?: number;
  rooms?: number;
  disposition?: string;

  // Floor
  floor?: number;
  floor_number?: number;
  total_floors?: number;

  // Features & amenities
  features?: string[];
  amenities?: string[];
  equipment?: string[];

  // Images & media
  images?: string[];
  photos?: Array<{
    url?: string;
    href?: string;
    src?: string;
  }>;
  image_count?: number;
  photo_count?: number;
  _links?: {
    images?: Array<{ href: string }>;
    photos?: Array<{ href: string }>;
  };

  // Description
  description?: string;
  text?: string;

  // Additional details
  items?: Array<{
    name: string;
    label?: string;
    value: string;
    type?: string;
  }>;

  // URLs
  url?: string;
  detail_url?: string;

  // Status
  status?: string;
  is_active?: boolean;

  // Slovak-specific fields
  ownership?: string;  // Vlastníctvo
  condition?: string;  // Stav
  furnished?: string;  // Vybavenie
  energy_rating?: string;  // Energetická trieda
  heating?: string;  // Vykurovanie
  construction_type?: string;  // Typ stavby

  // Detail-page enriched fields
  has_elevator?: boolean;
  has_balcony?: boolean;
  has_basement?: boolean;
  has_parking?: boolean;
  has_garage?: boolean;
  has_garden?: boolean;
  bathrooms?: number;
  year_built?: number;

  // Land utility connections (from detail attrs)
  water_supply?: string;    // e.g. 'mains', 'none'
  sewage?: string;          // e.g. 'mains', 'septic', 'none'
  electricity?: string;     // e.g. 'connected', 'none'
  gas?: string;             // e.g. 'connected', 'none'

  // (area_land already declared above)

  // Timestamps
  created_at?: string;
  updated_at?: string;
  published_at?: string;

  // Detail-enriched - new fields
  bedrooms_count?: number;          // from "Počet spální"
  parking_spaces_count?: number;    // from "Počet parkovacích miest v garáži"
  balcony_area?: number;
  cellar_area?: number;
  terrain?: string;
  building_permit?: string;
  land_use?: string;
  orientation?: string;
  wc_count?: number;
  year_approved?: number;
  loggia_count?: number;
  sqm_built?: number;
  agent_name?: string;
  agency_name?: string;
  price_per_sqm?: string;
  published_date?: string;

  // Street address from location object
  street?: string;
  street_number?: string;

  // Advertiser type (AGENT, OWNER, DEVELOPER, etc.)
  advertiser_type?: string;

  // Contact fields (from detail page advertiser object / JSON-LD)
  agent_profile_url?: string;
  agency_profile_url?: string;
  agency_website?: string;
  agency_address?: string;
  phone_partial?: string;

  // Utility/power costs (rentals)
  utility_cost?: string;
  utility_included?: boolean;

  // Additional area measurements
  terrace_area?: number;
  loggia_area?: number;
  renovation_year?: number;
  plot_width?: number;
  plot_length?: number;
  heat_source?: string;
  land_zone?: string;
  balcony_count?: number;
  room_count?: number;

  [key: string]: any; // Allow additional fields
}

export interface NehnutelnostiDetailResponse {
  id?: string | number;
  name?: string;
  title?: string;
  description?: string;
  text?: string;
  items?: Array<{
    name: string;
    label?: string;
    value: string;
    type?: string;
  }>;
  _embedded?: {
    images?: Array<{
      _links?: {
        self?: { href: string };
        original?: { href: string };
      };
      url?: string;
    }>;
  };
  images?: string[];
  [key: string]: any;
}
