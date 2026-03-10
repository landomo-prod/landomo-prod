-- ============================================================
-- Migration 009: Promote universal fields to Tier 1
--
-- These fields exist in EVERY country's Tier 2 data and are now
-- promoted to dedicated indexed columns for cross-country querying.
-- ============================================================

-- Add new Tier 1 columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS condition VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS heating_type VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS furnished VARCHAR(30);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS construction_type VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS renovation_year INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS available_from DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS published_date TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deposit NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parking_spaces INTEGER;

-- Indexes for the new filterable columns
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

-- Backfill from country_specific JSONB where data exists
UPDATE properties
SET
  condition = COALESCE(condition, country_specific->>'condition'),
  heating_type = COALESCE(heating_type, country_specific->>'heating_type'),
  furnished = COALESCE(furnished, country_specific->>'furnished'),
  construction_type = COALESCE(construction_type, country_specific->>'construction_type'),
  renovation_year = COALESCE(renovation_year, (country_specific->>'renovation_year')::INTEGER),
  available_from = COALESCE(available_from, (country_specific->>'available_from')::DATE),
  deposit = COALESCE(deposit, (country_specific->>'deposit')::NUMERIC),
  parking_spaces = COALESCE(parking_spaces, (country_specific->>'parking_spaces')::INTEGER)
WHERE country_specific IS NOT NULL
  AND country_specific != '{}'::jsonb
  AND (
    country_specific->>'condition' IS NOT NULL
    OR country_specific->>'heating_type' IS NOT NULL
    OR country_specific->>'furnished' IS NOT NULL
    OR country_specific->>'construction_type' IS NOT NULL
    OR country_specific->>'renovation_year' IS NOT NULL
    OR country_specific->>'available_from' IS NOT NULL
    OR country_specific->>'deposit' IS NOT NULL
    OR country_specific->>'parking_spaces' IS NOT NULL
  );

DO $$
BEGIN
  RAISE NOTICE 'Migration 009: Tier 1 universal fields added and backfilled';
END $$;
