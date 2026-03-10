/**
 * Booli.se API Types
 *
 * Booli is Sweden's second-largest real estate portal (~8% market share),
 * owned by SBAB Bank. It aggregates listings from multiple Swedish portals
 * and provides its own search/analytics layer.
 *
 * API: https://api.booli.se
 * Auth: HMAC-SHA1 signature (callerId + unique + time + secret → SHA1 hash)
 * Documentation: https://www.booli.se/api
 *
 * Key endpoints:
 *   GET /listings  - Active listings for sale (till salu)
 *   GET /rentals   - Active rental listings (hyra)
 *   GET /sold      - Sold listings (historical)
 *
 * Authentication params (all required):
 *   callerId - your registered caller ID
 *   unique   - random 16-char string, unique per request
 *   time     - Unix timestamp (seconds)
 *   hash     - SHA1(callerId + unique + time + secret)
 *
 * Pagination:
 *   offset - starting index (default 0)
 *   limit  - results per page (max 500, default 25)
 *   totalCount returned in response
 *
 * Listing types (objectType field):
 *   Lägenhet     → apartment (bostadsrätt)
 *   Villa        → house (detached)
 *   Radhus       → house (row/terraced)
 *   Kedjehus     → house (chain house)
 *   Parhus       → house (semi-detached)
 *   Fritidshus   → house (vacation/recreational)
 *   Gård/Skog    → house (farm/estate)
 *   Tomt/Mark    → land (building plot)
 *   Lokaler      → commercial
 */

export interface BooliLocation {
  /** Full street address */
  address?: string;
  /** City/town name */
  city?: string;
  /** Municipality name */
  municipality?: string;
  /** County/region */
  county?: string;
  /** Swedish postal code (e.g. "112 45") */
  postalCode?: string;
  /** Postal area name */
  postalArea?: string;
  /** Neighbourhood name */
  area?: string;
  /** WGS84 latitude */
  latitude?: number;
  /** WGS84 longitude */
  longitude?: number;
}

export interface BooliSeller {
  /** Agent/agency name */
  name?: string;
  /** Contact URL */
  url?: string;
}

export interface BooliListingShort {
  /** Booli's internal listing ID */
  booliId: number;
  /** Original listing URL on source portal */
  url: string;
  /** Type of listing: "Lägenhet", "Villa", "Radhus", etc. */
  objectType: string;
  /** Location details */
  location: BooliLocation;
  /** Asking price in SEK (null if not disclosed) */
  listPrice?: number;
  /** Price per sqm in SEK */
  listSqmPrice?: number;
  /** Living area in sqm */
  livingArea?: number;
  /** Additional area (biarea) in sqm */
  additionalArea?: number;
  /** Plot/land area in sqm */
  plotArea?: number;
  /** Number of rooms (includes living room, Swedish convention) */
  rooms?: number;
  /** Monthly HOA fee (avgift) in SEK - for bostadsrätt */
  rent?: number;
  /** Floor number */
  floor?: number;
  /** Has elevator */
  hasElevator?: boolean;
  /** Has balcony */
  hasBalcony?: boolean;
  /** Has patio/deck */
  hasPatio?: boolean;
  /** Has fireplace */
  hasFireplace?: boolean;
  /** Construction year */
  constructionYear?: number;
  /** Publication date on Booli (ISO 8601) */
  published?: string;
  /** Date listing was created on source portal */
  sourceCreated?: string;
  /** Selling agent/agency */
  seller?: BooliSeller;
  /** Source portal identifier */
  source?: { name?: string; id?: string; type?: string };
}

export interface BooliRentalListing extends BooliListingShort {
  /** Monthly rent in SEK */
  listRent?: number;
  /** Rental type: "Hyresrätt", "Andrahand", etc. */
  rentalType?: string;
}

export interface BooliListingsResponse {
  /** Total number of matching listings */
  totalCount: number;
  /** Listings returned in this page */
  count: number;
  /** Offset used in this request */
  offset: number;
  /** Limit used in this request */
  limit: number;
  /** The listing results */
  listings: BooliListingShort[];
}

export interface BooliRentalsResponse {
  totalCount: number;
  count: number;
  offset: number;
  limit: number;
  listings: BooliRentalListing[];
}

/**
 * Booli object types and their Landomo category mapping
 */
export const BOOLI_OBJECT_TYPE_TO_CATEGORY = {
  // Apartments (bostadsrätt / hyresrätt)
  'Lägenhet': 'apartment',
  'Bostadsrätt': 'apartment',
  'Hyresrätt': 'apartment',

  // Houses
  'Villa': 'house',
  'Radhus': 'house',
  'Kedjehus': 'house',
  'Parhus': 'house',
  'Fritidshus': 'house',
  'Vinterbonat fritidshus': 'house',
  'Gård': 'house',
  'Gård/Skog': 'house',
  'Skog': 'house',
  'Övrig': 'house',

  // Land
  'Tomt': 'land',
  'Mark': 'land',
  'Tomt/Mark': 'land',

  // Commercial
  'Lokaler': 'commercial',
} as const;

export type BooliObjectType = keyof typeof BOOLI_OBJECT_TYPE_TO_CATEGORY;
export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Transaction type detection from listing context
 */
export type TransactionType = 'sale' | 'rent';
