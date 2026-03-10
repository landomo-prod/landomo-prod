/**
 * Type definitions for Immowelt.at portal data
 */

export interface ImmoweltListing {
  id: string;
  title: string;
  url: string;
  price?: number;
  priceText?: string;
  location?: {
    city?: string;
    district?: string;
    address?: string;
    postalCode?: string;
  };
  area?: number;
  plotArea?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  totalFloors?: number;
  propertyType?: string;
  transactionType?: string;
  description?: string;
  images?: string[];
  features?: string[];
  // Austrian/German-specific fields
  condition?: string;
  furnished?: string;
  energyRating?: string;
  heatingType?: string;
  constructionType?: string;
  buildingType?: string;
  yearBuilt?: number;
  availableFrom?: string;
  parkingSpaces?: number;
  // Cost and ownership fields
  ownershipType?: string;
  operatingCosts?: number;
  heatingCosts?: number;
  // Coordinates
  coordinates?: {
    lat: number;
    lng: number;
  };
  // Realtor info
  realtor?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    logo?: string;
  };
  // Metadata
  metadata?: {
    views?: number;
    published?: string;
    updated?: string;
    externalId?: string;
  };
  // Next.js data
  __NEXT_DATA__?: any;
  // Internal field for attributes extracted from detail pages
  _attributes?: Record<string, string>;
}

export interface ScrapeResult {
  listings: ImmoweltListing[];
  totalFound: number;
  scraped: number;
  errors: string[];
}

export interface ScraperConfig {
  headless: boolean;
  timeout: number;
  maxRetries: number;
  rateLimit: number;
  userAgent?: string;
}

export interface SearchParams {
  transactionType: 'sale' | 'rent';
  propertyType?: 'apartment' | 'house' | 'land' | 'commercial';
  location?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
}

/**
 * Next.js __NEXT_DATA__ structure from Immowelt pages
 */
export interface NextDataStructure {
  props?: {
    pageProps?: {
      searchResults?: {
        items?: any[];
        totalCount?: number;
      };
      exposé?: any;
      property?: any;
      [key: string]: any;
    };
    [key: string]: any;
  };
  page?: string;
  query?: Record<string, any>;
  buildId?: string;
  [key: string]: any;
}

/**
 * Immowelt API search response structure
 */
export interface ImmoweltSearchResponse {
  items?: Array<{
    id?: string;
    title?: string;
    price?: {
      value?: number;
      currency?: string;
    };
    location?: {
      city?: string;
      street?: string;
      postalCode?: string;
    };
    area?: {
      livingArea?: number;
      plotArea?: number;
    };
    rooms?: number;
    propertyType?: string;
    images?: Array<{
      url?: string;
    }>;
    [key: string]: any;
  }>;
  totalCount?: number;
  page?: number;
  pageSize?: number;
}
