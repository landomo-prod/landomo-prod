-- ============================================================
-- Multi-Tier Data Model Migration
-- Adds portal-specific and country-specific columns
-- Version: 1.0.0
-- Date: 2026-02-06
-- ============================================================

-- Add portal-specific metadata columns
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS portal_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS portal_features TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS portal_ui_config JSONB DEFAULT '{}'::jsonb;

-- Add country-specific columns (Czech Republic)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS czech_disposition VARCHAR(10),
ADD COLUMN IF NOT EXISTS czech_ownership VARCHAR(50);

-- Add country-specific columns (United Kingdom)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS uk_tenure VARCHAR(20),
ADD COLUMN IF NOT EXISTS uk_council_tax_band VARCHAR(5),
ADD COLUMN IF NOT EXISTS uk_epc_rating VARCHAR(5),
ADD COLUMN IF NOT EXISTS uk_leasehold_years_remaining INTEGER;

-- Add country-specific columns (United States)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS usa_lot_size_sqft NUMERIC,
ADD COLUMN IF NOT EXISTS usa_hoa_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS usa_mls_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS usa_property_tax_annual NUMERIC,
ADD COLUMN IF NOT EXISTS usa_parcel_number VARCHAR(100);

-- Add country-specific columns (France)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS france_dpe_rating VARCHAR(5),
ADD COLUMN IF NOT EXISTS france_ges_rating VARCHAR(5),
ADD COLUMN IF NOT EXISTS france_copropriete BOOLEAN;

-- Add country-specific columns (Spain)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS spain_ibi_annual NUMERIC,
ADD COLUMN IF NOT EXISTS spain_community_fees NUMERIC,
ADD COLUMN IF NOT EXISTS spain_cedula_habitabilidad BOOLEAN;

-- Add country-specific columns (Italy)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS italy_cadastral_category VARCHAR(10),
ADD COLUMN IF NOT EXISTS italy_cadastral_income NUMERIC;

-- Add country-specific columns (Australia)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS australia_land_size_sqm NUMERIC,
ADD COLUMN IF NOT EXISTS australia_council_rates_annual NUMERIC;

-- Create indexes for portal metadata
CREATE INDEX IF NOT EXISTS idx_properties_portal_metadata
  ON properties USING GIN(portal_metadata);

CREATE INDEX IF NOT EXISTS idx_properties_portal_features
  ON properties USING GIN(portal_features);

CREATE INDEX IF NOT EXISTS idx_properties_portal_ui_config
  ON properties USING GIN(portal_ui_config);

-- Note: Country-specific indexes should be created separately
-- using the per-country migration scripts (e.g., czech_indexes.sql)
-- to avoid creating unused indexes in databases that don't need them.
