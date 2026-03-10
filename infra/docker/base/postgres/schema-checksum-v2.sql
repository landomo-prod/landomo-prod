-- ============================================================================
-- LANDOMO v2: Checksum-First Architecture
-- Optimized for change detection and minimal scraping overhead
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROPERTIES (Current State)
-- ============================================================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  portal VARCHAR(100) NOT NULL,
  portal_id VARCHAR(255) NOT NULL,

  -- Core fields (Tier 1 - Global)
  title TEXT,
  description TEXT,
  price NUMERIC,
  currency VARCHAR(10) DEFAULT 'CZK',
  property_type VARCHAR(50),
  transaction_type VARCHAR(10),

  -- Location
  location JSONB,
  coordinates GEOMETRY(Point, 4326),

  -- Details
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqm NUMERIC,
  floor INTEGER,

  -- Amenities
  has_parking BOOLEAN,
  has_balcony BOOLEAN,
  has_elevator BOOLEAN,
  has_cellar BOOLEAN,
  has_garage BOOLEAN,

  -- Media
  images JSONB,
  virtual_tour_url TEXT,

  -- Metadata
  listing_status VARCHAR(20) DEFAULT 'active',
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW(),
  last_scraped_at TIMESTAMP DEFAULT NOW(),

  -- CHECKSUM (SHA256 of key fields)
  content_hash VARCHAR(64) NOT NULL,

  -- Country-specific (Tier 2 - Czech)
  disposition VARCHAR(50),
  building_type VARCHAR(50),
  ownership VARCHAR(50),

  -- Portal data (Tier 3)
  portal_metadata JSONB,
  raw_data JSONB NOT NULL,

  CONSTRAINT unique_portal_property UNIQUE (portal, portal_id)
);

CREATE INDEX idx_properties_portal ON properties(portal, portal_id);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_status ON properties(listing_status);
CREATE INDEX idx_properties_checksum ON properties(content_hash);
CREATE INDEX idx_properties_last_scraped ON properties(last_scraped_at);
CREATE INDEX idx_properties_coordinates ON properties USING GIST(coordinates);

-- ============================================================================
-- 2. PROPERTY_CHECKSUMS (Lightweight Change Detection)
-- ============================================================================
CREATE TABLE property_checksums (
  portal VARCHAR(100) NOT NULL,
  portal_id VARCHAR(255) NOT NULL,

  -- SHA256 hash of (price + title + description + bedrooms + bathrooms + sqm)
  content_hash VARCHAR(64) NOT NULL,

  -- Tracking
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  scrape_run_id UUID,

  -- Metadata for debugging
  checksum_version VARCHAR(20) DEFAULT 'sha256_v1',

  PRIMARY KEY (portal, portal_id)
);

CREATE INDEX idx_checksums_last_seen ON property_checksums(portal, last_seen_at);
CREATE INDEX idx_checksums_scrape_run ON property_checksums(scrape_run_id);

-- ============================================================================
-- 3. PROPERTY_UPDATES (Change History)
-- ============================================================================
CREATE TABLE property_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  portal VARCHAR(100) NOT NULL,
  portal_id VARCHAR(255) NOT NULL,

  -- Change metadata
  update_type VARCHAR(50) NOT NULL, -- 'new', 'price_up', 'price_down', 'delisted', 'reactivated'
  changed_fields TEXT[],

  -- Checksums
  old_checksum VARCHAR(64),
  new_checksum VARCHAR(64) NOT NULL,

  -- Price tracking (denormalized for fast queries)
  price_old NUMERIC,
  price_new NUMERIC,
  price_change_pct NUMERIC,

  -- Full change data (for complex queries)
  old_values JSONB,
  new_values JSONB,

  -- Timing
  detected_at TIMESTAMP DEFAULT NOW(),
  scrape_run_id UUID
);

CREATE INDEX idx_updates_property ON property_updates(property_id, detected_at DESC);
CREATE INDEX idx_updates_portal ON property_updates(portal, detected_at DESC);
CREATE INDEX idx_updates_type ON property_updates(update_type, detected_at DESC);
CREATE INDEX idx_updates_price_changes ON property_updates(price_change_pct) WHERE update_type IN ('price_up', 'price_down');

-- ============================================================================
-- 4. SCRAPE_RUNS (Scrape Execution Tracking)
-- ============================================================================
CREATE TABLE scrape_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  portal VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'failed'

  -- Timing
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Stats
  listings_checked INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  listings_unchanged INTEGER DEFAULT 0,
  listings_delisted INTEGER DEFAULT 0,

  -- Performance
  phase1_duration_ms INTEGER, -- Checksum collection
  phase2_duration_ms INTEGER, -- Change detection
  phase3_duration_ms INTEGER, -- Detail fetching

  -- Error tracking
  error_message TEXT,

  CONSTRAINT check_status CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_scrape_runs_portal ON scrape_runs(portal, started_at DESC);
CREATE INDEX idx_scrape_runs_status ON scrape_runs(status);

-- ============================================================================
-- 5. SCRAPE_METADATA (Per-Portal Configuration)
-- ============================================================================
CREATE TABLE scrape_metadata (
  portal VARCHAR(100) PRIMARY KEY,

  -- Scrape timing
  last_scrape_started TIMESTAMP,
  last_scrape_completed TIMESTAMP,
  last_full_scrape TIMESTAMP,

  -- Stats
  total_properties INTEGER DEFAULT 0,
  average_change_rate NUMERIC, -- % of properties that change per scrape

  -- Configuration
  scrape_interval_minutes INTEGER DEFAULT 60,
  enable_checksum_mode BOOLEAN DEFAULT true,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 6. STALENESS TRACKING (Automatic Delisting Detection)
-- ============================================================================
CREATE TABLE staleness_thresholds (
  portal VARCHAR(100) PRIMARY KEY,
  threshold_hours INTEGER DEFAULT 72,
  circuit_breaker_pct NUMERIC DEFAULT 30.0
);

-- ============================================================================
-- 7. INGESTION_LOG (Audit Trail)
-- ============================================================================
CREATE TABLE ingestion_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  portal VARCHAR(100),
  portal_id VARCHAR(255),

  status VARCHAR(20), -- 'success', 'error', 'skipped'
  error_message TEXT,

  -- For debugging
  checksum_computed VARCHAR(64),
  checksum_matched BOOLEAN,

  ingested_at TIMESTAMP DEFAULT NOW(),
  scrape_run_id UUID
);

CREATE INDEX idx_ingestion_log_status ON ingestion_log(status, ingested_at DESC);
CREATE INDEX idx_ingestion_log_scrape_run ON ingestion_log(scrape_run_id);

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function to mark stale properties
CREATE OR REPLACE FUNCTION mark_stale_properties(
  p_portal VARCHAR(100),
  p_threshold_hours INTEGER DEFAULT 72
) RETURNS TABLE(marked_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE properties
  SET listing_status = 'removed',
      last_updated_at = NOW()
  WHERE portal = p_portal
    AND listing_status = 'active'
    AND last_scraped_at < NOW() - (p_threshold_hours || ' hours')::INTERVAL
  RETURNING id INTO v_count;

  RETURN QUERY SELECT COUNT(*)::INTEGER FROM properties WHERE portal = p_portal;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. INITIAL DATA
-- ============================================================================

-- Default staleness thresholds
INSERT INTO staleness_thresholds (portal, threshold_hours) VALUES
  ('sreality', 72),
  ('bezrealitky', 72),
  ('reality', 72),
  ('idnes-reality', 72),
  ('realingo', 72);

-- Initialize scrape metadata
INSERT INTO scrape_metadata (portal, scrape_interval_minutes, enable_checksum_mode) VALUES
  ('sreality', 60, true),
  ('bezrealitky', 60, true),
  ('reality', 60, true),
  ('idnes-reality', 60, true),
  ('realingo', 60, true);

-- ============================================================================
-- DONE
-- ============================================================================
