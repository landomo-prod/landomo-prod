-- Core Database Schema Template (Tier 2)
-- One database per country: landomo_[country]
-- Purpose: Store standardized, queryable data from all portals in that country

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

  -- Country-specific fields (flexible JSONB)
  -- Examples:
  -- Czech: { "disposition": "2+kk", "disposition_type": "kk" }
  -- UK: { "reception_rooms": 2, "property_style": "terraced" }
  -- USA: { "lot_size_sqft": 5000, "garage_spaces": 2 }
  country_specific JSONB,

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

  -- Financial
  price_per_sqm NUMERIC,
  hoa_fees NUMERIC,
  property_tax NUMERIC,

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

  CONSTRAINT valid_ingestion_status CHECK (status IN ('success', 'validation_error', 'duplicate', 'rejected'))
);

-- Indexes for filtering and searching
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

-- Indexes for change tracking
CREATE INDEX IF NOT EXISTS idx_property_changes_property_id ON property_changes(property_id);
CREATE INDEX IF NOT EXISTS idx_property_changes_changed_at ON property_changes(changed_at);
CREATE INDEX IF NOT EXISTS idx_price_history_property_id ON price_history(property_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_portal ON ingestion_log(portal);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_ingested_at ON ingestion_log(ingested_at);
