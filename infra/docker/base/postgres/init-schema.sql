-- ============================================================
-- Landomo-World Base Schema + Multi-Tier Extensions
-- This schema is applied to ALL country databases
-- Version: 1.0.0
-- Date: 2026-02-06
-- ============================================================

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Properties table (standardized + country-specific)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  portal_id VARCHAR(255) NOT NULL,        -- Original ID from portal
  portal VARCHAR(100) NOT NULL,           -- Source portal (domain, immobiliare, etc.)
  source_url TEXT NOT NULL,

  -- Property details (standardized for global search)
  title TEXT,
  price NUMERIC,
  currency VARCHAR(10),
  property_type VARCHAR(50),              -- Normalized: apartment, house, villa, etc.
  transaction_type VARCHAR(10),           -- sale, rent

  -- Location (standardized)
  address TEXT,
  city VARCHAR(255),
  region VARCHAR(255),
  country VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  latitude NUMERIC,
  longitude NUMERIC,
  geohash VARCHAR(20),                    -- For geo-queries

  -- Details (standardized for cross-country comparison)
  bedrooms INTEGER,                       -- Normalized bedroom count
  bathrooms INTEGER,
  sqm NUMERIC,
  sqm_type VARCHAR(20),                   -- living, total, land
  floor INTEGER,
  total_floors INTEGER,
  rooms INTEGER,                          -- Total rooms (standardized)
  year_built INTEGER,

  -- Media
  images JSONB,                            -- Array of image URLs
  videos JSONB,                            -- Array of video URLs
  description TEXT,
  description_language VARCHAR(10),

  -- Agent/Agency
  agent_name VARCHAR(255),
  agent_phone VARCHAR(50),
  agent_email VARCHAR(255),
  agent_agency VARCHAR(255),
  agent_agency_logo TEXT,

  -- Features (standardized)
  features JSONB,                          -- Array of standardized feature strings

  -- Amenities (structured for filtering)
  has_parking BOOLEAN,
  has_garden BOOLEAN,
  has_balcony BOOLEAN,
  has_terrace BOOLEAN,
  has_pool BOOLEAN,
  has_elevator BOOLEAN,
  has_garage BOOLEAN,
  has_basement BOOLEAN,
  has_fireplace BOOLEAN,
  is_furnished BOOLEAN,
  is_new_construction BOOLEAN,
  is_luxury BOOLEAN,

  -- Energy rating
  energy_rating VARCHAR(10),

  -- Universal property attributes (Tier 1 - cross-country queryable)
  condition VARCHAR(50),                   -- new, good, renovated, etc.
  heating_type VARCHAR(50),                -- central_heating, gas_heating, etc.
  furnished VARCHAR(30),                   -- furnished, partially_furnished, not_furnished
  construction_type VARCHAR(50),           -- brick, panel, concrete, wood, etc.
  renovation_year INTEGER,                 -- Year of last major renovation
  available_from DATE,                     -- When property becomes available (rentals)
  published_date TIMESTAMPTZ,              -- When listing was published on portal
  deposit NUMERIC,                         -- Security deposit (rentals)
  parking_spaces INTEGER,                  -- Number of parking spots

  -- Financial
  price_per_sqm NUMERIC,
  hoa_fees NUMERIC,
  property_tax NUMERIC,

  -- ============================================================
  -- MULTI-TIER EXTENSIONS
  -- ============================================================

  -- Portal-specific metadata (Tier 3)
  portal_metadata JSONB DEFAULT '{}'::jsonb,
  portal_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  portal_ui_config JSONB DEFAULT '{}'::jsonb,

  -- Country-specific columns (Czech Republic)
  czech_disposition VARCHAR(10),
  czech_ownership VARCHAR(50),

  -- Country-specific columns (Slovakia)
  slovak_disposition VARCHAR(20),
  slovak_ownership VARCHAR(50),

  -- Country-specific columns (Hungary)
  hungarian_room_count VARCHAR(20),
  hungarian_ownership VARCHAR(50),

  -- Country-specific columns (Germany)
  german_ownership VARCHAR(50),
  german_hausgeld NUMERIC,
  german_courtage NUMERIC,
  german_kfw_standard VARCHAR(20),
  german_is_denkmalschutz BOOLEAN DEFAULT FALSE,

  -- Country-specific columns (Austria)
  austrian_ownership VARCHAR(50),
  austrian_operating_costs NUMERIC,
  austrian_heating_costs NUMERIC,

  -- Country-specific columns (United Kingdom)
  uk_tenure VARCHAR(20),
  uk_council_tax_band VARCHAR(5),
  uk_epc_rating VARCHAR(5),
  uk_leasehold_years_remaining INTEGER,

  -- Country-specific columns (United States)
  usa_lot_size_sqft NUMERIC,
  usa_hoa_name VARCHAR(255),
  usa_mls_number VARCHAR(100),
  usa_property_tax_annual NUMERIC,
  usa_parcel_number VARCHAR(100),

  -- Country-specific columns (France)
  france_dpe_rating VARCHAR(5),
  france_ges_rating VARCHAR(5),
  france_copropriete BOOLEAN DEFAULT FALSE,
  france_charges_copro NUMERIC,

  -- Country-specific columns (Spain)
  spain_ibi_annual NUMERIC,
  spain_community_fees NUMERIC,
  spain_cedula_habitabilidad BOOLEAN DEFAULT FALSE,

  -- Country-specific columns (Italy)
  italy_cadastral_category VARCHAR(10),
  italy_cadastral_income NUMERIC,

  -- Country-specific columns (Australia)
  australia_land_size_sqm NUMERIC,
  australia_council_rates_annual NUMERIC,

  -- Fallback JSONB for any country-specific data
  country_specific JSONB DEFAULT '{}'::jsonb,

  -- ============================================================
  -- END MULTI-TIER EXTENSIONS
  -- ============================================================

  -- Cross-portal deduplication
  canonical_property_id UUID,              -- FK to canonical property (self-ref, set after table creation)

  -- Raw data preservation
  raw_data JSONB NOT NULL,                 -- Complete portal response

  -- Status
  status VARCHAR(20) DEFAULT 'active',     -- active, removed, sold, rented
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique constraint: one property per portal
  CONSTRAINT unique_portal_property UNIQUE (portal, portal_id),
  CONSTRAINT valid_status CHECK (status IN ('active', 'removed', 'sold', 'rented'))
);

-- Property change history
CREATE TABLE IF NOT EXISTS property_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  change_type VARCHAR(20) NOT NULL,        -- price_change, status_change, data_update
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_change_type CHECK (change_type IN ('price_change', 'status_change', 'data_update', 'removed', 'reactivated'))
);

-- Price history (denormalized for fast queries)
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  currency VARCHAR(10),
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ingestion tracking
CREATE TABLE IF NOT EXISTS ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(100) NOT NULL,
  portal_listing_id VARCHAR(255) NOT NULL,
  ingested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20),                      -- success, validation_error, duplicate
  error_message TEXT,
  raw_payload JSONB,
  request_id VARCHAR(255),                 -- correlation ID for end-to-end tracing

  CONSTRAINT valid_ingestion_status CHECK (status IN ('success', 'validation_error', 'duplicate', 'rejected'))
);

-- ============================================================
-- LISTING LIFECYCLE TABLES
-- ============================================================

-- Track status periods for each listing
CREATE TABLE IF NOT EXISTS listing_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  reason VARCHAR(50),  -- 'scraper_ingest', 'staleness_check', 'manual'
  CONSTRAINT valid_lsh_status CHECK (status IN ('active', 'removed', 'sold', 'rented'))
);

-- Track when each portal was last scraped
CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  listings_found INTEGER DEFAULT 0,
  listings_new INTEGER DEFAULT 0,
  listings_updated INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running',
  CONSTRAINT valid_run_status CHECK (status IN ('running', 'completed', 'failed'))
);

-- Per-portal staleness thresholds (overrides default)
CREATE TABLE IF NOT EXISTS staleness_thresholds (
  portal VARCHAR(100) PRIMARY KEY,
  threshold_hours INTEGER NOT NULL DEFAULT 72,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEDUPLICATION
-- ============================================================

-- Self-referencing FK for canonical_property_id (added after table creation)
ALTER TABLE properties
  ADD CONSTRAINT fk_canonical_property
  FOREIGN KEY (canonical_property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- Track duplicate relationships across portals
CREATE TABLE IF NOT EXISTS property_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  duplicate_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  confidence_score NUMERIC(5,2) NOT NULL,
  match_method VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_duplicate_pair UNIQUE (canonical_id, duplicate_id),
  CONSTRAINT no_self_duplicate CHECK (canonical_id <> duplicate_id),
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 100),
  CONSTRAINT valid_match_method CHECK (match_method IN (
    'exact_coordinates_price',
    'postal_code_address_price',
    'city_details_price'
  ))
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Core indexes for filtering and searching
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_transaction_type ON properties(transaction_type);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_region ON properties(region);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX IF NOT EXISTS idx_properties_sqm ON properties(sqm);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_portal ON properties(portal);
CREATE INDEX IF NOT EXISTS idx_properties_geohash ON properties(geohash);
CREATE INDEX IF NOT EXISTS idx_properties_last_seen ON properties(last_seen_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_properties_type_transaction_city ON properties(property_type, transaction_type, city);
CREATE INDEX IF NOT EXISTS idx_properties_city_price ON properties(city, price) WHERE status = 'active';

-- Full-text search on title and description
CREATE INDEX IF NOT EXISTS idx_properties_search ON properties USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Portal-specific indexes (GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_properties_portal_metadata ON properties USING GIN(portal_metadata);
CREATE INDEX IF NOT EXISTS idx_properties_portal_features ON properties USING GIN(portal_features);
CREATE INDEX IF NOT EXISTS idx_properties_portal_ui_config ON properties USING GIN(portal_ui_config);

-- Indexes for change tracking
CREATE INDEX IF NOT EXISTS idx_property_changes_property_id ON property_changes(property_id);
CREATE INDEX IF NOT EXISTS idx_property_changes_changed_at ON property_changes(changed_at);
CREATE INDEX IF NOT EXISTS idx_price_history_property_id ON price_history(property_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_portal ON ingestion_log(portal);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_ingested_at ON ingestion_log(ingested_at);

-- Listing lifecycle indexes
CREATE INDEX IF NOT EXISTS idx_lsh_property_id ON listing_status_history(property_id);
CREATE INDEX IF NOT EXISTS idx_lsh_open_periods ON listing_status_history(property_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scrape_runs_portal ON scrape_runs(portal, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_stale ON properties(last_seen_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ingestion_log_portal_listing ON ingestion_log(portal, portal_listing_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_request_id ON ingestion_log(request_id) WHERE request_id IS NOT NULL;

-- Deduplication indexes
CREATE INDEX IF NOT EXISTS idx_properties_lat_lon ON properties(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_postal_price ON properties(postal_code, price) WHERE postal_code IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_properties_city_bed_sqm ON properties(city, bedrooms, sqm) WHERE city IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_properties_canonical ON properties(canonical_property_id) WHERE canonical_property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_duplicates_canonical ON property_duplicates(canonical_id);
CREATE INDEX IF NOT EXISTS idx_property_duplicates_duplicate ON property_duplicates(duplicate_id);
CREATE INDEX IF NOT EXISTS idx_property_duplicates_confidence ON property_duplicates(confidence_score DESC);

-- ============================================================
-- COMPREHENSIVE INDEXES (from migration 007)
-- ============================================================

-- Search: timestamps for default sort
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_updated_at ON properties(updated_at DESC);

-- Search: primary composite for status + type + transaction + price
CREATE INDEX IF NOT EXISTS idx_properties_search_composite
  ON properties(status, property_type, transaction_type, price)
  WHERE status = 'active';

-- Search: city-based search with type and price
CREATE INDEX IF NOT EXISTS idx_properties_active_city_type_price
  ON properties(city, property_type, transaction_type, price)
  WHERE status = 'active';

-- Search: active properties sorted by price
CREATE INDEX IF NOT EXISTS idx_properties_active_price
  ON properties(price ASC)
  WHERE status = 'active' AND price IS NOT NULL AND price > 0;

-- Search: active properties sorted by created_at (newest first)
CREATE INDEX IF NOT EXISTS idx_properties_active_created
  ON properties(created_at DESC)
  WHERE status = 'active';

-- Search: active properties by region
CREATE INDEX IF NOT EXISTS idx_properties_active_region
  ON properties(region, property_type)
  WHERE status = 'active';

-- Geo: PostGIS spatial index (conditional on extension)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_properties_geo_point
        ON properties USING GIST (
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        )
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ';
  END IF;
END $$;

-- Geo: bounding box for map view queries
CREATE INDEX IF NOT EXISTS idx_properties_lat_lon_bbox
  ON properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';

-- Staleness: portal + status for circuit breaker GROUP BY
CREATE INDEX IF NOT EXISTS idx_properties_portal_status
  ON properties(portal, status);

-- Staleness: portal + last_seen_at for UPDATE with race-condition re-check
CREATE INDEX IF NOT EXISTS idx_properties_portal_stale_check
  ON properties(portal, last_seen_at)
  WHERE status = 'active';

-- Lifecycle: status + last_updated_at for admin dashboards
CREATE INDEX IF NOT EXISTS idx_properties_status_updated
  ON properties(status, last_updated_at DESC);

-- Aggregation: price stats grouped by type
CREATE INDEX IF NOT EXISTS idx_properties_agg_price
  ON properties(property_type, transaction_type, price)
  WHERE status = 'active' AND price IS NOT NULL;

-- Aggregation: property type distribution
CREATE INDEX IF NOT EXISTS idx_properties_active_type_dist
  ON properties(property_type)
  WHERE status = 'active';

-- Change tracking: filter by change type
CREATE INDEX IF NOT EXISTS idx_property_changes_type
  ON property_changes(change_type);

-- Change tracking: recent changes per property
CREATE INDEX IF NOT EXISTS idx_property_changes_property_recent
  ON property_changes(property_id, changed_at DESC);

-- Price history: per-property timeline
CREATE INDEX IF NOT EXISTS idx_price_history_property_recent
  ON price_history(property_id, recorded_at DESC);

-- Listing status history: analytics by status period
CREATE INDEX IF NOT EXISTS idx_lsh_status_started
  ON listing_status_history(status, started_at DESC);

-- Listing status history: per-property status timeline
CREATE INDEX IF NOT EXISTS idx_lsh_property_status
  ON listing_status_history(property_id, status, started_at DESC);

-- Scrape runs: orphaned run reaper (finds 'running' > 4h)
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status_started
  ON scrape_runs(status, started_at)
  WHERE status = 'running';

-- Scrape runs: latest completed run per portal
CREATE INDEX IF NOT EXISTS idx_scrape_runs_portal_status
  ON scrape_runs(portal, status, finished_at DESC);

-- Ingestion log: find failed ingestions
CREATE INDEX IF NOT EXISTS idx_ingestion_log_status
  ON ingestion_log(status)
  WHERE status != 'success';

-- Ingestion log: per-portal history
CREATE INDEX IF NOT EXISTS idx_ingestion_log_portal_time
  ON ingestion_log(portal, ingested_at DESC);

-- Universal Tier 1 attribute indexes
CREATE INDEX IF NOT EXISTS idx_properties_condition
  ON properties(condition)
  WHERE condition IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_properties_heating_type
  ON properties(heating_type)
  WHERE heating_type IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_properties_furnished
  ON properties(furnished)
  WHERE furnished IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_properties_construction_type
  ON properties(construction_type)
  WHERE construction_type IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_properties_published_date
  ON properties(published_date DESC)
  WHERE published_date IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_properties_available_from
  ON properties(available_from)
  WHERE available_from IS NOT NULL AND status = 'active';

-- Slovakia country-specific indexes
CREATE INDEX IF NOT EXISTS idx_properties_slovak_disposition
  ON properties(slovak_disposition)
  WHERE slovak_disposition IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_slovak_ownership
  ON properties(slovak_ownership)
  WHERE slovak_ownership IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_slovak_disposition_price
  ON properties(slovak_disposition, price)
  WHERE slovak_disposition IS NOT NULL AND price IS NOT NULL;

-- ============================================================
-- SECURITY MONITORING (Migration 011)
-- ============================================================

-- API Access Log (authentication and rate limiting monitoring)
CREATE TABLE IF NOT EXISTS api_access_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_ip VARCHAR(45) NOT NULL,
  api_key_hash VARCHAR(64),
  api_key_prefix VARCHAR(10),
  api_key_version VARCHAR(20),
  request_id VARCHAR(100),
  country VARCHAR(2),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  query_params JSONB,
  status_code INT NOT NULL,
  error_message TEXT,
  response_time_ms INT,
  response_size_bytes INT,
  user_agent TEXT,
  referer TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_api_access_timestamp ON api_access_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_status ON api_access_log(status_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_key_prefix ON api_access_log(api_key_prefix, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_client_ip ON api_access_log(client_ip, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_country ON api_access_log(country, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_endpoint ON api_access_log(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_failed_auth ON api_access_log(timestamp DESC, status_code)
  WHERE status_code IN (401, 403);
CREATE INDEX IF NOT EXISTS idx_api_access_rate_limit ON api_access_log(timestamp DESC, client_ip, api_key_prefix)
  WHERE status_code = 429;
CREATE INDEX IF NOT EXISTS idx_api_access_expired_key ON api_access_log(timestamp DESC, api_key_prefix)
  WHERE error_message LIKE '%expired%';

-- System Error Log (infrastructure monitoring)
CREATE TABLE IF NOT EXISTS system_errors (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  component VARCHAR(50) NOT NULL,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'error',
  service VARCHAR(50),
  country VARCHAR(2),
  request_id VARCHAR(100),
  metadata JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_system_errors_timestamp ON system_errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_component ON system_errors(component, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_severity ON system_errors(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved ON system_errors(resolved, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_connection ON system_errors(timestamp DESC, component)
  WHERE error_type LIKE '%connection%' OR error_type LIKE '%timeout%';

-- Secrets Metadata (rotation monitoring)
CREATE TABLE IF NOT EXISTS secrets_metadata (
  id SERIAL PRIMARY KEY,
  secret_name VARCHAR(255) UNIQUE NOT NULL,
  secret_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  next_rotation_due TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  owner VARCHAR(100),
  scope VARCHAR(50),
  country VARCHAR(2),
  rotation_count INT DEFAULT 0,
  last_rotation_reason TEXT,
  metadata JSONB,
  created_by VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_secrets_status ON secrets_metadata(status, created_at);
CREATE INDEX IF NOT EXISTS idx_secrets_type ON secrets_metadata(secret_type, status);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_due ON secrets_metadata(next_rotation_due)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_secrets_country ON secrets_metadata(country, status);
CREATE INDEX IF NOT EXISTS idx_secrets_age ON secrets_metadata(created_at DESC)
  WHERE status = 'active';

-- Secret Rotation History (audit trail)
CREATE TABLE IF NOT EXISTS secret_rotation_history (
  id BIGSERIAL PRIMARY KEY,
  secret_name VARCHAR(255) NOT NULL,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_by VARCHAR(100) NOT NULL,
  rotation_reason TEXT,
  old_secret_hash VARCHAR(64),
  new_secret_hash VARCHAR(64),
  rotation_method VARCHAR(50),
  metadata JSONB,
  FOREIGN KEY (secret_name) REFERENCES secrets_metadata(secret_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_secret_rotation_name ON secret_rotation_history(secret_name, rotated_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_date ON secret_rotation_history(rotated_at DESC);

-- Cleanup function for log retention
CREATE OR REPLACE FUNCTION cleanup_security_logs(retention_days INTEGER DEFAULT 90)
RETURNS TABLE(
  api_access_deleted BIGINT,
  system_errors_deleted BIGINT
) AS $$
DECLARE
  api_deleted BIGINT;
  errors_deleted BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM api_access_log
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days
    RETURNING *
  )
  SELECT COUNT(*) INTO api_deleted FROM deleted;

  WITH deleted AS (
    DELETE FROM system_errors
    WHERE resolved = true
      AND timestamp < NOW() - INTERVAL '1 day' * retention_days
    RETURNING *
  )
  SELECT COUNT(*) INTO errors_deleted FROM deleted;

  RETURN QUERY SELECT api_deleted, errors_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMPLETION
-- ============================================================

-- Print success message
DO $$
BEGIN
  RAISE NOTICE '✅ Base schema initialized successfully (includes security monitoring)';
  RAISE NOTICE 'Note: Country-specific indexes should be applied separately';
END $$;
