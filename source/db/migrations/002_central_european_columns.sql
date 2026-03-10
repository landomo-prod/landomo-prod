-- Migration: 002_central_european_columns.sql
-- Add country-specific indexed columns for Central European markets
-- Follows pattern from 001_multi_tier_schema.sql

BEGIN;

-- ============================================================================
-- Slovakia
-- ============================================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS slovak_disposition VARCHAR(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS slovak_ownership VARCHAR(50);

-- ============================================================================
-- Hungary
-- ============================================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hungarian_room_count VARCHAR(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hungarian_ownership VARCHAR(50);

-- ============================================================================
-- Germany
-- ============================================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS german_ownership VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS german_hausgeld NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS german_courtage NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS german_kfw_standard VARCHAR(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS german_is_denkmalschutz BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Austria
-- ============================================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS austrian_ownership VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS austrian_operating_costs NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS austrian_heating_costs NUMERIC;

-- ============================================================================
-- Indexes: Partial indexes on country-specific columns (WHERE NOT NULL saves space)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_properties_slovak_disposition ON properties(slovak_disposition) WHERE slovak_disposition IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_slovak_ownership ON properties(slovak_ownership) WHERE slovak_ownership IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_hungarian_room_count ON properties(hungarian_room_count) WHERE hungarian_room_count IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_hungarian_ownership ON properties(hungarian_ownership) WHERE hungarian_ownership IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_german_ownership ON properties(german_ownership) WHERE german_ownership IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_german_hausgeld ON properties(german_hausgeld) WHERE german_hausgeld IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_austrian_ownership ON properties(austrian_ownership) WHERE austrian_ownership IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_austrian_operating_costs ON properties(austrian_operating_costs) WHERE austrian_operating_costs IS NOT NULL;

COMMIT;
