/**
 * Kleinanzeigen.de API Response Types
 * Based on the official Kleinanzeigen.de (formerly eBay Kleinanzeigen) public API structure
 *
 * API Documentation from reverse engineering:
 * - Base URL: https://api.kleinanzeigen.de/api
 * - Authentication: Basic YW5kcm9pZDpUYVI2MHBFdHRZ
 */

export interface KleinanzeigenListingResponse {
  ads: KleinanzeigenListing[];
  _embedded?: {
    ads?: KleinanzeigenListing[];
  };
  paging?: {
    total: number;
    size: number;
    page: number;
  };
  total?: number;
  size?: number;
  page?: number;
}

export interface KleinanzeigenListing {
  id: number;
  title?: string;
  description?: {
    value?: string;
    text?: string;
  };
  price?: {
    amount?: number;
    currencyIsoCode?: string;
    priceType?: string;
  };
  location?: {
    id?: number;
    city?: string;
    zipCode?: string;
    state?: string;
    street?: string;
    latitude?: number;
    longitude?: number;
  };
  categoryId?: number;
  category?: {
    id: number;
    name?: string;
    parentId?: number;
  };
  adType?: string; // 'OFFER' or 'WANTED'
  features?: {
    [key: string]: string;
  };
  attributes?: Array<{
    name: string;
    value: string;
    type?: string;
    label?: string;
  }>;
  images?: Array<{
    id?: string;
    url?: string;
    thumbnailUrl?: string;
    largeUrl?: string;
  }>;
  pictures?: Array<{
    id?: string;
    url?: string;
    thumbnail?: string;
    large?: string;
  }>;
  startDate?: string;
  posterContact?: {
    name?: string;
    phoneNumber?: string;
    email?: string;
  };
  imprint?: {
    name?: string;
    companyName?: string;
  };
  link?: string;
  url?: string;
  // Real estate specific fields
  realEstateType?: string; // apartment, house, etc.
  livingSpace?: number; // in sqm
  rooms?: number;
  plotArea?: number;
  constructionYear?: number;
  floor?: number;
  numberOfFloors?: number;
  condition?: string; // renovated, first_occupancy, etc.
  heatingType?: string;
  furnished?: string; // yes, no, partially
  balcony?: boolean;
  garden?: boolean;
  cellar?: boolean;
  lift?: boolean;
  parking?: boolean;
  garage?: boolean;
  [key: string]: any; // Allow additional fields
}

export interface KleinanzeigenDetailResponse {
  id: number;
  title?: string;
  description?: {
    value?: string;
  };
  price?: {
    amount?: number;
    currencyIsoCode?: string;
  };
  location?: {
    city?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  };
  images?: Array<{
    url?: string;
    thumbnailUrl?: string;
  }>;
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  [key: string]: any;
}

export interface KleinanzeigenLocationResponse {
  locations: Array<{
    id: number;
    name: string;
    parentId?: number;
    locationType?: string;
  }>;
}

/**
 * Category IDs for real estate on Kleinanzeigen
 * Main category 195: Immobilien (All Real Estate)
 *
 * Based on official kleinanzeigen.de category structure
 * Total: ~530,190 listings across all categories
 */
export const REAL_ESTATE_CATEGORIES = {
  // RESIDENTIAL - Apartments
  APARTMENTS_RENT: 203, // Mietwohnungen (~143,644 listings)
  APARTMENTS_SALE: 196, // Eigentumswohnungen (~61,166 listings)

  // RESIDENTIAL - Houses
  HOUSES_RENT: 205, // Häuser zur Miete (~11,440 listings)
  HOUSES_SALE: 208, // Häuser zum Kauf (~194,684 listings)

  // TEMPORARY & SHARED
  TEMPORARY_SHARED: 199, // Auf Zeit & WG (~16,519 listings)

  // VACATION & FOREIGN
  VACATION_FOREIGN: 275, // Ferien- & Auslandsimmobilien (~24,872 listings)

  // LAND & GARDENS
  LAND_GARDENS: 207, // Grundstücke & Gärten (~36,583 listings)

  // COMMERCIAL
  COMMERCIAL: 277, // Gewerbeimmobilien (~63,344 listings)

  // PARKING
  PARKING: 197, // Garagen & Stellplätze (~36,388 listings)

  // CONTAINERS
  CONTAINERS: 402, // Container (~15,772 listings)

  // NEW CONSTRUCTION
  NEW_CONSTRUCTION: 403, // Neubauprojekte (~40 listings)

  // MISCELLANEOUS
  MISCELLANEOUS: 198 // Weitere Immobilien (~4,021 listings)
} as const;
