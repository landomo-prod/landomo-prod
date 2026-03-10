-- ============================================================
-- Migration 006: Cross-Portal Property Deduplication
-- Adds canonical_property_id to link duplicate listings across portals
-- and a property_duplicates table for tracking match metadata.
-- ============================================================

-- Add canonical_property_id to properties (nullable FK to self)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS canonical_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Table tracking duplicate relationships with confidence scores
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

-- Indexes for deduplication queries

-- Fast lookup: find properties near given coordinates
CREATE INDEX IF NOT EXISTS idx_properties_lat_lon
  ON properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Fast lookup: postal code + price for address-based matching
CREATE INDEX IF NOT EXISTS idx_properties_postal_price
  ON properties(postal_code, price)
  WHERE postal_code IS NOT NULL AND status = 'active';

-- Fast lookup: city + bedrooms + sqm for detail-based matching
CREATE INDEX IF NOT EXISTS idx_properties_city_bed_sqm
  ON properties(city, bedrooms, sqm)
  WHERE city IS NOT NULL AND status = 'active';

-- Canonical property lookup
CREATE INDEX IF NOT EXISTS idx_properties_canonical
  ON properties(canonical_property_id)
  WHERE canonical_property_id IS NOT NULL;

-- Duplicate relationship lookups
CREATE INDEX IF NOT EXISTS idx_property_duplicates_canonical ON property_duplicates(canonical_id);
CREATE INDEX IF NOT EXISTS idx_property_duplicates_duplicate ON property_duplicates(duplicate_id);
CREATE INDEX IF NOT EXISTS idx_property_duplicates_confidence ON property_duplicates(confidence_score DESC);

DO $$
BEGIN
  RAISE NOTICE 'Migration 006: Property deduplication schema applied successfully';
END $$;
