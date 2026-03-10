/**
 * Flatfox API types - based on verified public API at /api/v1/flat/
 */

export interface FlatfoxListing {
  pk: number;
  id?: number;
  slug: string;
  url: string;
  short_url?: string;
  status: string; // 'act' = active

  // Offer details
  offer_type: 'RENT' | 'SALE';
  object_category: string; // 'APARTMENT', 'SHARED', 'HOUSE', 'PARKING', 'COMMERCIAL'
  object_type: string; // 'APARTMENT', 'SHARED_FLAT', 'ATTIC_FLAT', 'HOUSE', etc.

  // Pricing
  price_display: number;
  price_display_type: string; // 'TOTAL'
  price_unit: string; // 'monthly', 'sell'
  rent_net: number | null;
  rent_charges: number;
  rent_gross: number | null;
  rent_display: number;

  // Property details
  short_title: string;
  public_title: string;
  description_title?: string;
  description: string;
  livingspace: number; // m2
  number_of_rooms: string;
  floor: number | null;
  year_built: number | null;

  // Location
  zipcode: number;
  city: string;
  public_address: string;
  latitude: number;
  longitude: number;
  show_exact_address: boolean;

  // Features
  attributes: Array<{ name: string }>;
  is_furnished: boolean;
  is_temporary: boolean;
  is_selling_furniture: boolean;

  // Media
  cover_image?: FlatfoxImage;
  images: FlatfoxImage[];
  documents?: any[];
  video_url?: string;
  tour_url?: string;
  website_url?: string;

  // Organization
  organization?: {
    name: string;
    logo?: string;
  };

  // Dates
  moving_date_type: string; // 'dat', 'imm', 'agr'
  moving_date: string | null;
}

export interface FlatfoxImage {
  pk: number;
  caption?: string;
  url: string;
  url_thumb_m?: string;
  url_listing_search?: string;
  search_url?: string;
  ordering: number;
  width?: number;
  height?: number;
}

export interface FlatfoxApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FlatfoxListing[];
}
