-- ============================================================
-- Migration 030: Add "Other" Category Partition
--
-- Creates the missing properties_other partition for garages,
-- parking spaces, mobile homes, and storage units.
--
-- Date: 2026-02-16
-- ============================================================

BEGIN;

-- ============================================================
-- Create Other Partition
-- ============================================================

-- Add missing columns to base table first (if not already added by 029)
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_property_subtype VARCHAR(100);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_sqm_total NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_parking BOOLEAN;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_electricity BOOLEAN;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_parking_spaces INTEGER;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_water_connection BOOLEAN;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_heating BOOLEAN;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_security_type VARCHAR(100);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_access_type VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_year_built INTEGER;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_construction_type VARCHAR(100);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_condition VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_deposit NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_service_charges NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_available_from DATE;

-- Update property_category CHECK constraint to include 'other'
ALTER TABLE properties_new DROP CONSTRAINT IF EXISTS properties_new_property_category_check;
ALTER TABLE properties_new ADD CONSTRAINT properties_new_property_category_check
  CHECK (property_category IN ('apartment', 'house', 'land', 'commercial', 'other'));

-- Create the properties_other partition
CREATE TABLE IF NOT EXISTS properties_other PARTITION OF properties_new
  FOR VALUES IN ('other');

-- ============================================================
-- Create Indexes for Other Partition
-- ============================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_other_status ON properties_other (status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_price ON properties_other (price)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_city ON properties_other (city)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_transaction_type ON properties_other (transaction_type)
  WHERE status = 'active';

-- Other-specific indexes
CREATE INDEX IF NOT EXISTS idx_other_subtype ON properties_other (other_property_subtype)
  WHERE other_property_subtype IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_sqm_total ON properties_other (other_sqm_total)
  WHERE other_sqm_total IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_has_parking ON properties_other (other_has_parking)
  WHERE other_has_parking = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_has_electricity ON properties_other (other_has_electricity)
  WHERE other_has_electricity = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_parking_spaces ON properties_other (other_parking_spaces)
  WHERE other_parking_spaces IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_year_built ON properties_other (other_year_built)
  WHERE other_year_built IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_condition ON properties_other (other_condition)
  WHERE other_condition IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_security_type ON properties_other (other_security_type)
  WHERE other_security_type IS NOT NULL AND status = 'active';

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_other_location_gin ON properties_other USING GIN (location)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_coordinates ON properties_other (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';

-- Portal & lifecycle indexes
CREATE INDEX IF NOT EXISTS idx_other_portal ON properties_other (portal)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_source_platform ON properties_other (source_platform)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_created_at ON properties_other (created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_updated_at ON properties_other (updated_at DESC)
  WHERE status = 'active';

-- ============================================================
-- Documentation
-- ============================================================

COMMENT ON TABLE properties_other IS 'Partition for other category properties (garages, parking spaces, mobile homes, storage units)';

COMMENT ON COLUMN properties_new.other_property_subtype IS 'Other: Property subtype (garage, parking_space, mobile_home, storage, other)';
COMMENT ON COLUMN properties_new.other_sqm_total IS 'Other: Total area in square meters';
COMMENT ON COLUMN properties_new.other_has_parking IS 'Other: Has parking available';
COMMENT ON COLUMN properties_new.other_has_electricity IS 'Other: Has electricity connection';
COMMENT ON COLUMN properties_new.other_parking_spaces IS 'Other: Number of parking spaces';
COMMENT ON COLUMN properties_new.other_has_water_connection IS 'Other: Has water connection';
COMMENT ON COLUMN properties_new.other_has_heating IS 'Other: Has heating system';
COMMENT ON COLUMN properties_new.other_security_type IS 'Other: Security system type';
COMMENT ON COLUMN properties_new.other_access_type IS 'Other: Access type (direct, remote, keycard)';
COMMENT ON COLUMN properties_new.other_year_built IS 'Other: Year built/constructed';
COMMENT ON COLUMN properties_new.other_construction_type IS 'Other: Construction type/material';
COMMENT ON COLUMN properties_new.other_condition IS 'Other: Property condition';
COMMENT ON COLUMN properties_new.other_deposit IS 'Other: Required deposit amount';
COMMENT ON COLUMN properties_new.other_service_charges IS 'Other: Monthly service/maintenance charges';
COMMENT ON COLUMN properties_new.other_available_from IS 'Other: Date available for occupancy';

-- ============================================================
-- COMPLETION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 030: Created properties_other partition';
  RAISE NOTICE 'Added 15 other_* columns to properties_new';
  RAISE NOTICE 'Created 18 indexes on properties_other partition';
  RAISE NOTICE 'Updated property_category CHECK constraint to include "other"';
END $$;

COMMIT;
