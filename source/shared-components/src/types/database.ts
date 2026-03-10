/**
 * Database-related type definitions
 */

import { Pool, PoolConfig } from 'pg';

export interface DatabaseConfig extends PoolConfig {
  database: string;
}

export interface DatabaseClient {
  pool: Pool;
  query: (text: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
}

export interface ListingRecord {
  id: string;
  url: string;
  title?: string;
  price?: number;
  currency?: string;
  property_type?: string;
  transaction_type?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqm?: number;
  floor?: number;
  rooms?: number;
  year_built?: number;
  images?: any;
  description?: string;
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
  agent_agency?: string;
  features?: any;
  raw_data?: any;
  status?: string;
  first_seen_at?: Date;
  last_seen_at?: Date;
  last_checked_at?: Date;
  scrape_count?: number;
  error_count?: number;
  last_error?: string;
  created_at?: Date;
  updated_at?: Date;
}
