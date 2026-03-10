/**
 * Type definitions for Reality.idnes.cz portal data
 */

export interface IdnesListing {
  id: string;
  title: string;
  url: string;
  price?: number;
  priceText?: string;
  location?: {
    city?: string;
    district?: string;
    region?: string;
    address?: string;
  };
  area?: number;
  plotArea?: number;
  rooms?: string;
  floor?: number;
  propertyType?: string;
  transactionType?: string;
  description?: string;
  images?: string[];
  features?: string[];
  // Czech-specific fields from detail pages
  ownership?: string;
  condition?: string;
  furnished?: string;
  energyRating?: string;
  heatingType?: string;
  constructionType?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  realtor?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  metadata?: {
    views?: number;
    published?: string;
    updated?: string;
  };
  rawHtml?: string;
  // Internal field for attributes extracted from detail pages
  _attributes?: Record<string, string>;
}

export interface ScrapeResult {
  listings: IdnesListing[];
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
  propertyType?: 'flat' | 'house' | 'land' | 'commercial';
  location?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
}
