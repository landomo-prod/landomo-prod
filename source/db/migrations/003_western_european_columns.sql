-- Migration: 003_western_european_columns.sql
-- Add country-specific indexed columns for Western European markets
-- Follows pattern from 002_central_european_columns.sql

BEGIN;

-- ============================================================================
-- France
-- ============================================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS france_dpe_rating VARCHAR(5);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS france_ges_rating VARCHAR(5);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS france_copropriete BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS france_charges_copro NUMERIC;

-- ============================================================================
-- Spain
-- ============================================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS spain_ibi_annual NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS spain_community_fees NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS spain_cedula_habitabilidad BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- United Kingdom
-- ============================================================================
ALTER TABLE properties ADD COLUMN IF NOT EXISTS uk_tenure VARCHAR(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS uk_council_tax_band VARCHAR(5);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS uk_epc_rating VARCHAR(5);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS uk_leasehold_years_remaining INTEGER;

-- ============================================================================
-- Indexes: Partial indexes on country-specific columns (WHERE NOT NULL saves space)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_properties_france_dpe_rating ON properties(france_dpe_rating) WHERE france_dpe_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_france_ges_rating ON properties(france_ges_rating) WHERE france_ges_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_spain_ibi_annual ON properties(spain_ibi_annual) WHERE spain_ibi_annual IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_spain_community_fees ON properties(spain_community_fees) WHERE spain_community_fees IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_uk_tenure ON properties(uk_tenure) WHERE uk_tenure IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_uk_council_tax_band ON properties(uk_council_tax_band) WHERE uk_council_tax_band IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_uk_epc_rating ON properties(uk_epc_rating) WHERE uk_epc_rating IS NOT NULL;

COMMIT;
