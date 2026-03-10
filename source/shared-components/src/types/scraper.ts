/**
 * Scraper-related type definitions
 */

export interface ScraperOptions {
  city?: string;
  district?: string;
  transactionType?: 'sale' | 'rent';
  propertyType?: string;
  limit?: number;
  dryRun?: boolean;
  maxPages?: number;
}

export interface ScraperRun {
  id: string;
  scraper_type: 'listings' | 'details' | 'cron';
  started_at: Date;
  completed_at?: Date;
  status: 'running' | 'completed' | 'failed';
  listings_found?: number;
  listings_new?: number;
  listings_updated?: number;
  listings_removed?: number;
  errors_count?: number;
  config?: any;
  error_log?: string;
}

export interface DetailJob {
  listingId: string;
  url: string;
  priority: 'high' | 'normal' | 'low';
  isRecheck?: boolean;
  attempts?: number;
}
