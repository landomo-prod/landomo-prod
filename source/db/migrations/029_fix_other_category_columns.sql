-- ============================================================
-- Migration 029: Fix Other Category - Add Missing Columns
--
-- Adds missing other_* columns that bulk-operations.ts expects
-- but were not included in migration 020
--
-- Date: 2026-02-16
-- ============================================================

BEGIN;

-- ============================================================
-- Add missing other_* columns
-- ============================================================

ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_has_parking BOOLEAN;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_year_built INTEGER;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_construction_type VARCHAR(100);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_condition VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_deposit NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_service_charges NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS other_available_from DATE;

-- ============================================================
-- Add indexes for new columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_other_has_parking ON properties_other (other_has_parking)
  WHERE other_has_parking = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_year_built ON properties_other (other_year_built)
  WHERE other_year_built IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_condition ON properties_other (other_condition)
  WHERE other_condition IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_other_deposit ON properties_other (other_deposit)
  WHERE other_deposit IS NOT NULL AND status = 'active';

-- ============================================================
-- Documentation
-- ============================================================

COMMENT ON COLUMN properties_new.other_has_parking IS 'Other: Has parking available';
COMMENT ON COLUMN properties_new.other_year_built IS 'Other: Year built/constructed';
COMMENT ON COLUMN properties_new.other_construction_type IS 'Other: Construction type/material';
COMMENT ON COLUMN properties_new.other_condition IS 'Other: Property condition (new, good, renovated, original)';
COMMENT ON COLUMN properties_new.other_deposit IS 'Other: Required deposit amount';
COMMENT ON COLUMN properties_new.other_service_charges IS 'Other: Monthly service/maintenance charges';
COMMENT ON COLUMN properties_new.other_available_from IS 'Other: Date available for occupancy';

-- ============================================================
-- COMPLETION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 029: Added missing other_* columns';
  RAISE NOTICE 'New columns: other_has_parking, other_year_built, other_construction_type, other_condition, other_deposit, other_service_charges, other_available_from';
  RAISE NOTICE 'New indexes: idx_other_has_parking, idx_other_year_built, idx_other_condition, idx_other_deposit';
END $$;

COMMIT;
