/**
 * Bazos API Type Definitions
 * Extracted from decompilation and live API testing
 */

export interface BazosAd {
  id: string;
  title: string;
  price_formatted: string;
  price?: number;
  currency: string;
  locality: string;
  from: string; // Posted datetime "2026-02-07 20:00:00"
  views: number;
  topped: boolean | string;
  favourite: boolean | string;
  image_thumbnail?: string;
  image_thumbnail_width?: number;
  image_thumbnail_height?: number;
  url: string;
  [key: string]: any; // Allow for additional fields
}

export interface BazosCategory {
  id: number;
  title: string;
  url?: string;
  name?: string; // Alternative field name
  [key: string]: any;
}

export interface BazosZipSearchResult {
  zip_code: string;
  city: string;
  post_office: string;
  latitude: string;
  longitude: string;
  [key: string]: any;
}

export interface BazosAdDetail {
  id: string;
  [key: string]: any;
}

export interface BazosApiResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  [key: string]: any;
}

export interface ScraperStats {
  totalProcessed: number;
  newListings: number;
  sections: Record<string, number>;
  countries: Record<string, number>;
  errors: number;
}

export interface BazosScraperConfig {
  countries?: string[];
  sections?: string[];
  maxPages?: number;
  delayMs?: number;
}
