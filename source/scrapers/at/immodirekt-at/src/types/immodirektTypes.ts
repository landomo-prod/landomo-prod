/**
 * Type definitions for Immodirekt.at portal data
 */

export interface ImmodirektListing {
  id: string;
  title: string;
  url: string;
  price?: number;
  priceText?: string;
  location?: {
    city?: string;
    state?: string;
    postalCode?: string;
    address?: string;
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
  // Austrian-specific fields
  condition?: string;
  furnished?: string;
  energyRating?: string;
  heatingType?: string;
  constructionYear?: number;
  availableFrom?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  realtor?: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
  };
  metadata?: {
    views?: number;
    published?: string;
    updated?: string;
    listingType?: string;
  };
  rawHtml?: string;
  // Cost fields
  ownershipType?: string;
  operatingCosts?: number;
  heatingCosts?: number;
  // Internal field for attributes extracted from detail pages
  _attributes?: Record<string, string>;
  // Raw data from window.__INITIAL_STATE__
  raw?: any;
}

export interface ScrapeResult {
  listings: ImmodirektListing[];
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
  useStealthMode: boolean;
  bypassCloudflare: boolean;
}

export interface SearchParams {
  transactionType: 'sale' | 'rent';
  propertyType?: 'apartment' | 'house' | 'land' | 'commercial';
  location?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
}
