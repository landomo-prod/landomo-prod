/**
 * Wohnnet.at API Response Types
 * Based on HTML scraping and JSON-LD structured data
 */

/**
 * JSON-LD Schema.org structured data from Wohnnet listings
 */
export interface WohnnetJsonLd {
  '@context': string;
  '@type': string;
  name?: string;
  url?: string;
  description?: string;
  image?: string | string[];
  offers?: {
    '@type': string;
    price?: string | number;
    priceCurrency?: string;
    availability?: string;
  };
  address?: {
    '@type': string;
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: {
    '@type': string;
    latitude?: number | string;
    longitude?: number | string;
  };
  numberOfRooms?: number | string;
  floorSize?: {
    '@type': string;
    value?: number | string;
    unitCode?: string;
  };
  [key: string]: any; // Allow additional schema.org properties
}

/**
 * Listing extracted from HTML
 */
export interface WohnnetListing {
  id: string;
  title: string;
  url: string;
  price?: number;
  currency?: string;
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  coordinates?: {
    lat: number;
    lon: number;
  };
  details?: {
    rooms?: number;
    sqm?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    propertyType?: string;
    transactionType?: string;
    yearBuilt?: number;
    condition?: string;
    furnished?: boolean;
    heatingType?: string;
    energyRating?: string;
    accessible?: boolean;
    petsAllowed?: boolean;
    ownershipType?: string;
    operatingCosts?: number;
    heatingCosts?: number;
  };
  images?: string[];
  description?: string;
  jsonLd?: WohnnetJsonLd;
  // Raw HTML for debugging
  rawHtml?: string;
}

/**
 * Detail page response
 */
export interface WohnnetDetailResponse {
  id: string;
  title: string;
  description: string;
  price?: number;
  currency?: string;
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
  details?: {
    rooms?: number;
    sqm?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    totalFloors?: number;
    yearBuilt?: number;
    propertyType?: string;
    condition?: string;
    furnished?: boolean;
    parking?: boolean;
    garage?: boolean;
    balcony?: boolean;
    terrace?: boolean;
    garden?: boolean;
    elevator?: boolean;
    basement?: boolean;
    heatingType?: string;
    energyRating?: string;
  };
  images?: WohnnetImage[];
  contactInfo?: {
    agentName?: string;
    agencyName?: string;
    phone?: string;
    email?: string;
  };
  features?: string[];
  amenities?: {
    [key: string]: boolean;
  };
  jsonLd?: WohnnetJsonLd;
}

/**
 * Image data from Wohnnet API
 */
export interface WohnnetImage {
  id?: string;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  alt?: string;
  title?: string;
}

/**
 * Pagination metadata
 */
export interface WohnnetPaginationMeta {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems?: number;
  hasNextPage: boolean;
}

/**
 * Scraping statistics
 */
export interface ScraperStats {
  totalPages: number;
  totalListings: number;
  successfulListings: number;
  failedListings: number;
  detailsEnriched: number;
  startTime: number;
  endTime?: number;
  duration?: number;
}
