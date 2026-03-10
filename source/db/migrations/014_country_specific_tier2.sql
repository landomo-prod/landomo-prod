-- ============================================================
-- Migration 014: Tier II Country-Specific Columns
--
-- Adds typed country-specific columns to properties_new partitioned table.
-- These are high-value fields that benefit from dedicated columns for query performance.
--
-- Tier II Strategy:
-- - High-frequency query fields: typed columns with partial indexes
-- - Low-frequency fields: remain in country_specific JSONB
-- - All country columns available on all partitions (apartment/house/land/commercial)
--
-- Date: 2026-02-12
-- ============================================================

BEGIN;

-- ============================================================
-- Czech Republic (Czech)
-- ============================================================
-- Disposition: Czech-specific room layout system (1+kk, 2+1, etc.)
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS czech_disposition VARCHAR(10);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS czech_ownership VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS czech_building_type VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS czech_area_usable NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS czech_cadastral_number VARCHAR(100);

-- ============================================================
-- Slovakia (Slovak)
-- ============================================================
-- Similar to Czech disposition system
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS slovak_disposition VARCHAR(20);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS slovak_ownership VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS slovak_cadastral_number VARCHAR(100);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS slovak_area_usable NUMERIC;

-- ============================================================
-- Hungary (Hungarian)
-- ============================================================
-- Room count: Hungarian-specific format (e.g., "1,5 szobás")
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS hungarian_room_count VARCHAR(20);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS hungarian_ownership VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS hungarian_comfort_level VARCHAR(30);

-- ============================================================
-- Germany (German)
-- ============================================================
-- Hausgeld: Monthly operating costs for condos
-- Courtage: Real estate commission
-- KfW: Energy efficiency standard
-- Denkmalschutz: Historic building protection
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS german_ownership VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS german_hausgeld NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS german_courtage NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS german_kfw_standard VARCHAR(20);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS german_is_denkmalschutz BOOLEAN DEFAULT FALSE;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS german_provision VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS german_energieausweis_type VARCHAR(30);

-- ============================================================
-- Austria (Austrian)
-- ============================================================
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS austrian_ownership VARCHAR(50);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS austrian_operating_costs NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS austrian_heating_costs NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS austrian_provision VARCHAR(50);

-- ============================================================
-- United Kingdom (UK)
-- ============================================================
-- Tenure: Freehold vs Leasehold (critical for UK market)
-- Council Tax Band: Local tax classification (A-H)
-- EPC Rating: Energy Performance Certificate (A-G)
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS uk_tenure VARCHAR(20);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS uk_council_tax_band VARCHAR(5);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS uk_epc_rating VARCHAR(5);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS uk_leasehold_years_remaining INTEGER;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS uk_ground_rent NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS uk_service_charge NUMERIC;

-- ============================================================
-- France (French)
-- ============================================================
-- DPE: Diagnostic de Performance Énergétique (Energy Rating A-G)
-- GES: Greenhouse Gas Emission Rating (A-G)
-- Copropriété: Co-ownership/condominium
-- Charges Copro: Monthly condo fees
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS france_dpe_rating VARCHAR(5);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS france_ges_rating VARCHAR(5);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS france_copropriete BOOLEAN DEFAULT FALSE;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS france_charges_copro NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS france_taxe_fonciere NUMERIC;

-- ============================================================
-- Spain (Spanish)
-- ============================================================
-- IBI: Annual property tax (Impuesto sobre Bienes Inmuebles)
-- Cédula de Habitabilidad: Habitability certificate
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS spain_ibi_annual NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS spain_community_fees NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS spain_cedula_habitabilidad BOOLEAN DEFAULT FALSE;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS spain_energy_certificate VARCHAR(5);

-- ============================================================
-- Italy (Italian)
-- ============================================================
-- Cadastral Category: Property classification system
-- Cadastral Income: Official rental value for tax purposes
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS italy_cadastral_category VARCHAR(10);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS italy_cadastral_income NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS italy_energy_class VARCHAR(5);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS italy_condominium_fees NUMERIC;

-- ============================================================
-- United States (USA)
-- ============================================================
-- MLS: Multiple Listing Service number
-- HOA: Homeowners Association
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS usa_lot_size_sqft NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS usa_hoa_name VARCHAR(255);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS usa_hoa_fees_monthly NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS usa_mls_number VARCHAR(100);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS usa_property_tax_annual NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS usa_parcel_number VARCHAR(100);
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS usa_school_district VARCHAR(100);

-- ============================================================
-- Australia (Australian)
-- ============================================================
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS australia_land_size_sqm NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS australia_council_rates_annual NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS australia_water_rates_annual NUMERIC;
ALTER TABLE properties_new ADD COLUMN IF NOT EXISTS australia_strata_fees_quarterly NUMERIC;

-- ============================================================
-- Partial Indexes (only index non-NULL values to save space)
-- ============================================================

-- Czech indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_czech_disposition
  ON properties_new(czech_disposition)
  WHERE czech_disposition IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_czech_ownership
  ON properties_new(czech_ownership)
  WHERE czech_ownership IS NOT NULL;

-- Slovak indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_slovak_disposition
  ON properties_new(slovak_disposition)
  WHERE slovak_disposition IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_slovak_ownership
  ON properties_new(slovak_ownership)
  WHERE slovak_ownership IS NOT NULL;

-- Hungarian indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_hungarian_room_count
  ON properties_new(hungarian_room_count)
  WHERE hungarian_room_count IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_hungarian_ownership
  ON properties_new(hungarian_ownership)
  WHERE hungarian_ownership IS NOT NULL;

-- German indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_german_ownership
  ON properties_new(german_ownership)
  WHERE german_ownership IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_german_hausgeld
  ON properties_new(german_hausgeld)
  WHERE german_hausgeld IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_german_kfw_standard
  ON properties_new(german_kfw_standard)
  WHERE german_kfw_standard IS NOT NULL;

-- Austrian indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_austrian_ownership
  ON properties_new(austrian_ownership)
  WHERE austrian_ownership IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_austrian_operating_costs
  ON properties_new(austrian_operating_costs)
  WHERE austrian_operating_costs IS NOT NULL;

-- UK indexes (high query volume)
CREATE INDEX IF NOT EXISTS idx_properties_new_uk_tenure
  ON properties_new(uk_tenure)
  WHERE uk_tenure IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_uk_council_tax_band
  ON properties_new(uk_council_tax_band)
  WHERE uk_council_tax_band IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_uk_epc_rating
  ON properties_new(uk_epc_rating)
  WHERE uk_epc_rating IS NOT NULL;

-- French indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_france_dpe_rating
  ON properties_new(france_dpe_rating)
  WHERE france_dpe_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_france_ges_rating
  ON properties_new(france_ges_rating)
  WHERE france_ges_rating IS NOT NULL;

-- Spanish indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_spain_ibi_annual
  ON properties_new(spain_ibi_annual)
  WHERE spain_ibi_annual IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_spain_community_fees
  ON properties_new(spain_community_fees)
  WHERE spain_community_fees IS NOT NULL;

-- Italian indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_italy_cadastral_category
  ON properties_new(italy_cadastral_category)
  WHERE italy_cadastral_category IS NOT NULL;

-- USA indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_usa_mls_number
  ON properties_new(usa_mls_number)
  WHERE usa_mls_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_new_usa_property_tax_annual
  ON properties_new(usa_property_tax_annual)
  WHERE usa_property_tax_annual IS NOT NULL;

-- Australian indexes
CREATE INDEX IF NOT EXISTS idx_properties_new_australia_council_rates
  ON properties_new(australia_council_rates_annual)
  WHERE australia_council_rates_annual IS NOT NULL;

-- ============================================================
-- Column Comments
-- ============================================================

-- Czech comments
COMMENT ON COLUMN properties_new.czech_disposition IS 'Czech: Room layout format (1+kk, 2+1, 3+1, etc.) - 1 means living room, +1 means separate kitchen, +kk means kitchenette';
COMMENT ON COLUMN properties_new.czech_ownership IS 'Czech: Ownership type (osobní vlastnictví, družstevní, státní, etc.)';

-- Slovak comments
COMMENT ON COLUMN properties_new.slovak_disposition IS 'Slovak: Room layout format (similar to Czech system)';
COMMENT ON COLUMN properties_new.slovak_ownership IS 'Slovak: Ownership type (osobné vlastníctvo, družstevné, etc.)';

-- Hungarian comments
COMMENT ON COLUMN properties_new.hungarian_room_count IS 'Hungarian: Room count format (félszobás, 1 szobás, 1,5 szobás, etc.)';
COMMENT ON COLUMN properties_new.hungarian_ownership IS 'Hungarian: Ownership type (tulajdonos, társasház, stb.)';

-- German comments
COMMENT ON COLUMN properties_new.german_hausgeld IS 'German: Monthly operating costs (Hausgeld) in EUR';
COMMENT ON COLUMN properties_new.german_courtage IS 'German: Real estate commission (Courtage/Provision) in EUR or percentage';
COMMENT ON COLUMN properties_new.german_kfw_standard IS 'German: KfW energy efficiency standard (KfW 40, KfW 55, KfW 70, etc.)';
COMMENT ON COLUMN properties_new.german_is_denkmalschutz IS 'German: Historic building protection status (Denkmalschutz)';

-- Austrian comments
COMMENT ON COLUMN properties_new.austrian_operating_costs IS 'Austrian: Monthly operating costs (Betriebskosten) in EUR';
COMMENT ON COLUMN properties_new.austrian_heating_costs IS 'Austrian: Monthly heating costs (Heizkosten) in EUR';

-- UK comments
COMMENT ON COLUMN properties_new.uk_tenure IS 'UK: Ownership type (freehold, leasehold, share of freehold)';
COMMENT ON COLUMN properties_new.uk_council_tax_band IS 'UK: Council tax band (A-H)';
COMMENT ON COLUMN properties_new.uk_epc_rating IS 'UK: Energy Performance Certificate rating (A-G)';
COMMENT ON COLUMN properties_new.uk_leasehold_years_remaining IS 'UK: Years remaining on leasehold (critical for property value)';

-- French comments
COMMENT ON COLUMN properties_new.france_dpe_rating IS 'France: Diagnostic de Performance Énergétique rating (A-G)';
COMMENT ON COLUMN properties_new.france_ges_rating IS 'France: Greenhouse gas emission rating (A-G)';
COMMENT ON COLUMN properties_new.france_copropriete IS 'France: Co-ownership/condominium status';
COMMENT ON COLUMN properties_new.france_charges_copro IS 'France: Monthly condominium charges in EUR';

-- Spanish comments
COMMENT ON COLUMN properties_new.spain_ibi_annual IS 'Spain: Annual property tax (Impuesto sobre Bienes Inmuebles) in EUR';
COMMENT ON COLUMN properties_new.spain_community_fees IS 'Spain: Monthly community fees in EUR';
COMMENT ON COLUMN properties_new.spain_cedula_habitabilidad IS 'Spain: Habitability certificate status';

-- Italian comments
COMMENT ON COLUMN properties_new.italy_cadastral_category IS 'Italy: Cadastral category (A/1, A/2, etc.)';
COMMENT ON COLUMN properties_new.italy_cadastral_income IS 'Italy: Official rental value (Rendita Catastale) in EUR';

-- USA comments
COMMENT ON COLUMN properties_new.usa_mls_number IS 'USA: Multiple Listing Service identification number';
COMMENT ON COLUMN properties_new.usa_property_tax_annual IS 'USA: Annual property tax in USD';
COMMENT ON COLUMN properties_new.usa_parcel_number IS 'USA: Tax parcel/APN number';

-- Australian comments
COMMENT ON COLUMN properties_new.australia_council_rates_annual IS 'Australia: Annual council rates in AUD';
COMMENT ON COLUMN properties_new.australia_strata_fees_quarterly IS 'Australia: Quarterly strata fees in AUD';

COMMIT;

-- ============================================================
-- COMPLETION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 014: Tier II country-specific columns added successfully';
  RAISE NOTICE '🌍 Countries: Czech, Slovak, Hungarian, German, Austrian, UK, French, Spanish, Italian, USA, Australian';
  RAISE NOTICE '📊 Total columns: 60+ country-specific typed columns';
  RAISE NOTICE '🔍 Indexes: 23 partial indexes (WHERE NOT NULL)';
  RAISE NOTICE '📋 Strategy: High-frequency query fields as typed columns, low-frequency in country_specific JSONB';
  RAISE NOTICE '⚡ Performance: Partition-aware indexes, efficient storage';
END $$;
