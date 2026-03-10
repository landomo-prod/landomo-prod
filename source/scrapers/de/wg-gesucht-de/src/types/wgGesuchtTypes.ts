/**
 * WG-Gesucht API Response Types
 * Based on the unofficial WG-Gesucht API structure
 *
 * API Base: https://www.wg-gesucht.de/api/asset/offers/
 *
 * Authentication: Bearer token (obtained via login)
 * - Access token + refresh token
 * - Auto-refresh when expired
 */

/**
 * WG-Gesucht API Search Response
 */
export interface WGGesuchtSearchResponse {
  data: {
    offers: WGGesuchtOffer[];
    pagination?: {
      page: number;
      total: number;
      per_page: number;
    };
  };
  meta?: any;
}

/**
 * WG-Gesucht Offer (Listing)
 */
export interface WGGesuchtOffer {
  id: string | number;
  offer_id?: string;

  // Basic info
  title?: string;
  description?: string;

  // Property type
  category?: string; // 'WG-Zimmer', 'Wohnung', 'Haus', etc.
  offer_type?: number; // Offer type code
  rent_type?: number; // Rent type code (temporary, permanent)

  // Location
  city?: string;
  district?: string;
  street?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;

  // Financial
  rent?: number; // Warm rent (including utilities)
  rent_cold?: number; // Cold rent (excluding utilities)
  utilities?: number; // Additional costs
  deposit?: number;

  // Size and details
  size?: number; // Room size in m²
  apartment_size?: number; // Total apartment size in m²
  rooms?: number; // Total rooms in apartment
  bedroom_size?: number;

  // Availability
  available_from?: string; // Date string
  available_to?: string | null; // Date string or null (unlimited)
  available_duration?: string;

  // Features
  furniture?: string; // 'furnished', 'partially_furnished', 'unfurnished'
  furnished?: boolean;
  internet?: boolean;
  tv?: boolean;
  kitchen?: boolean;
  balcony?: boolean;
  garden?: boolean;
  parking?: boolean;
  elevator?: boolean;
  barrier_free?: boolean;

  // Building
  floor?: number;
  total_floors?: number;
  year_built?: number;

  // Roommates
  flatmates?: {
    total?: number;
    male?: number;
    female?: number;
    diverse?: number;
    age_min?: number;
    age_max?: number;
    looking_for?: string[]; // ['male', 'female', 'diverse']
  };

  // Images
  images?: string[];
  thumbnail?: string;
  image_count?: number;

  // User/Contact
  user_id?: string | number;
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
  };

  // Metadata
  online_since?: string;
  last_modified?: string;
  views?: number;

  // URL
  url?: string;

  // Additional fields (catch-all)
  [key: string]: any;
}

/**
 * WG-Gesucht Offer Detail Response
 * More detailed information when fetching a single offer
 */
export interface WGGesuchtOfferDetail extends WGGesuchtOffer {
  // Extended description
  description_long?: string;

  // Extended images
  images_full?: Array<{
    url: string;
    thumbnail?: string;
    caption?: string;
  }>;

  // Extended features
  features?: {
    wg_type?: string;
    languages?: string[];
    smoking?: boolean;
    pets?: boolean;
    occupation?: string[];
    interests?: string[];
  };

  // Public transport
  public_transport?: Array<{
    line: string;
    station: string;
    distance: number; // in meters
    time: number; // in minutes
  }>;

  // Nearby amenities
  amenities?: {
    supermarket?: number;
    restaurant?: number;
    pharmacy?: number;
    bakery?: number;
  };
}

/**
 * Authentication Types
 */
export interface WGGesuchtAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface WGGesuchtCredentials {
  username: string; // Email or username
  password: string;
}

/**
 * Search Parameters
 */
export interface WGGesuchtSearchParams {
  city_id?: number; // Berlin: 8, Munich: 90, Hamburg: 55, etc.
  categories?: string[]; // ['0'] = WG-Zimmer, ['1'] = 1-Zimmer-Wohnung, etc.
  rent_min?: number;
  rent_max?: number;
  size_min?: number;
  size_max?: number;
  available_from?: string; // YYYY-MM-DD
  duration?: string; // 'temporary' or 'unlimited'
  furnished?: boolean;
  page?: string | number;
  limit?: number;
}

/**
 * City IDs for major German cities
 */
export const CITY_IDS = {
  BERLIN: 8,
  MUNICH: 90,
  HAMBURG: 55,
  COLOGNE: 73,
  FRANKFURT: 41,
  STUTTGART: 124,
  DUSSELDORF: 27,
  DORTMUND: 24,
  ESSEN: 30,
  LEIPZIG: 77,
  BREMEN: 17,
  DRESDEN: 25,
  HANOVER: 57,
  NUREMBERG: 96,
  DUISBURG: 26,
} as const;

/**
 * Category Types
 */
export const CATEGORY_TYPES = {
  WG_ROOM: '0',           // WG-Zimmer (shared flat room)
  ONE_ROOM: '1',          // 1-Zimmer-Wohnung (studio)
  TWO_ROOM: '2',          // 2-Zimmer-Wohnung
  THREE_ROOM: '3',        // 3-Zimmer-Wohnung
  MULTI_ROOM: '4',        // 4+ Zimmer-Wohnung
  HOUSE: '5',             // Haus (house)
  APARTMENT: '6',         // Wohnung (apartment)
} as const;
