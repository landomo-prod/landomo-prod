/**
 * Type definitions for Immonet.de portal data (AVIV Group)
 */

export interface ImmonetListing {
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

  // German-specific fields
  constructionYear?: number;
  condition?: string;
  furnished?: string;
  energyRating?: string;
  heatingType?: string;
  parkingSpaces?: number;
  balcony?: boolean;
  terrace?: boolean;
  garden?: boolean;
  elevator?: boolean;
  cellar?: boolean;

  coordinates?: {
    lat: number;
    lng: number;
  };

  realtor?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    logo?: string;
  };

  metadata?: {
    views?: number;
    published?: string;
    updated?: string;
    listingId?: string;
    estateId?: string;
  };

  // German-specific indexed fields
  ownershipType?: string;
  hausgeld?: number;
  courtage?: string;
  kfwStandard?: string;
  denkmalschutz?: boolean;

  // AVIV Group specific fields (from __NEXT_DATA__)
  _nextData?: any;
  _attributes?: Record<string, string>;
}

export interface ScrapeResult {
  listings: ImmonetListing[];
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
  propertyType?: 'apartment' | 'house' | 'commercial' | 'land';
  location?: string;
  locationId?: string;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  roomsMin?: number;
  page?: number;
}
