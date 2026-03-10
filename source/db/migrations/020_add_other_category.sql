-- ============================================================
-- Migration 020: Add 'other' Category Partition
--
-- Adds properties_other partition to the properties_new table
-- for miscellaneous property types (garages, storage units, etc.)
--
-- Date: 2026-02-13
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Update CHECK constraint to allow 'other' category
-- ============================================================

ALTER TABLE properties_new DROP CONSTRAINT IF EXISTS properties_new_property_category_check;
ALTER TABLE properties_new ADD CONSTRAINT properties_new_property_category_check
  CHECK (property_category IN ('apartment', 'house', 'land', 'commercial', 'other'));

-- ============================================================
-- STEP 2: Add 'other' category columns to properties_new
-- ============================================================

ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_sqm_total NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_parking_spaces INTEGER;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_electricity BOOLEAN DEFAULT false;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_water_connection BOOLEAN;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_heating BOOLEAN;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_security_type VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_access_type VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_property_subtype VARCHAR(50);

-- ============================================================
-- STEP 3: Create partition for 'other' category
-- ============================================================

CREATE TABLE IF NOT EXISTS properties_other PARTITION OF properties_new
  FOR VALUES IN ('other');

-- ============================================================
-- STEP 4: Create indexes on properties_other partition
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_other_sqm_total ON properties_other (other_sqm_total)
  WHERE other_sqm_total IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_property_subtype ON properties_other (other_property_subtype)
  WHERE other_property_subtype IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_parking_spaces ON properties_other (other_parking_spaces)
  WHERE other_parking_spaces IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_price ON properties_other (price)
  WHERE status = 'active';

-- ============================================================
-- STEP 5: Documentation
-- ============================================================

COMMENT ON TABLE properties_other IS 'Partition for other/miscellaneous properties (property_category = other)';

COMMENT ON COLUMN properties_new.other_sqm_total IS 'Other: Total area in square meters';
COMMENT ON COLUMN properties_new.other_parking_spaces IS 'Other: Number of parking spaces';
COMMENT ON COLUMN properties_new.other_has_electricity IS 'Other: Has electricity connection';
COMMENT ON COLUMN properties_new.other_has_water_connection IS 'Other: Has water connection';
COMMENT ON COLUMN properties_new.other_has_heating IS 'Other: Has heating';
COMMENT ON COLUMN properties_new.other_security_type IS 'Other: Security type (alarm, camera, guard, none)';
COMMENT ON COLUMN properties_new.other_access_type IS 'Other: Access type (key, code, remote, card)';
COMMENT ON COLUMN properties_new.other_property_subtype IS 'Other: Property subtype (garage, storage, parking_spot, etc.)';

-- ============================================================
-- COMPLETION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 020: properties_other partition created successfully';
  RAISE NOTICE 'Partitions: apartment, house, land, commercial, other';
  RAISE NOTICE 'New columns: other_sqm_total, other_parking_spaces, other_has_electricity, other_has_water_connection, other_has_heating, other_security_type, other_access_type, other_property_subtype';
  RAISE NOTICE 'Indexes: idx_other_sqm_total, idx_other_property_subtype, idx_other_parking_spaces, idx_other_price';
END $$;

COMMIT;
