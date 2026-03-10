-- Scraper Database Schema Template (Tier 1)
-- One database per scraper: scraper_[country]_[portal]
-- Purpose: Store raw scraped data, change tracking, scraper monitoring

-- Core listings table (current state)
CREATE TABLE IF NOT EXISTS listings (
  id VARCHAR(255) PRIMARY KEY,           -- Portal's listing ID
  url TEXT NOT NULL,

  -- Property details
  title TEXT,
  price NUMERIC,
  currency VARCHAR(10),
  property_type VARCHAR(50),
  transaction_type VARCHAR(10),

  -- Location
  address TEXT,
  city VARCHAR(255),
  region VARCHAR(255),
  country VARCHAR(100),
  latitude NUMERIC,
  longitude NUMERIC,

  -- Details
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqm NUMERIC,
  floor INTEGER,
  rooms INTEGER,
  year_built INTEGER,

  -- Media
  images JSONB,                          -- Array of image URLs
  description TEXT,

  -- Agent
  agent_name VARCHAR(255),
  agent_phone VARCHAR(50),
  agent_email VARCHAR(255),
  agent_agency VARCHAR(255),

  -- Features
  features JSONB,                        -- Array of feature strings

  -- Raw data (for debugging/reprocessing)
  raw_data JSONB,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'active',   -- active, removed, expired
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Metadata
  scrape_count INTEGER DEFAULT 1,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('active', 'removed', 'expired'))
);

-- Change events (audit trail)
CREATE TABLE IF NOT EXISTS listing_events (
  id SERIAL PRIMARY KEY,
  listing_id VARCHAR(255) REFERENCES listings(id),
  event_type VARCHAR(20) NOT NULL,       -- new, updated, removed, reactivated
  changed_fields JSONB,                  -- Which fields changed (for updated events)
  old_values JSONB,                      -- Previous values
  new_values JSONB,                      -- New values
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Context
  scraper_run_id UUID,                   -- Link to scraper run for debugging

  CONSTRAINT valid_event_type CHECK (event_type IN ('new', 'updated', 'removed', 'reactivated'))
);

-- Scraper runs (for monitoring)
CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_type VARCHAR(20) NOT NULL,     -- listings, details, cron
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(20),                    -- running, completed, failed

  -- Statistics
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  listings_removed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,

  -- Metadata
  config JSONB,                          -- Scraper configuration used
  error_log TEXT,

  CONSTRAINT valid_scraper_type CHECK (scraper_type IN ('listings', 'details', 'cron')),
  CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_listings_last_checked ON listings(last_checked_at);
CREATE INDEX IF NOT EXISTS idx_listing_events_listing_id ON listing_events(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_events_event_type ON listing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_listing_events_detected_at ON listing_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_started_at ON scraper_runs(started_at);
