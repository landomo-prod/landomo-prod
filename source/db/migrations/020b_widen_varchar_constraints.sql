-- Migration 020: Widen VARCHAR(10) constraints to VARCHAR(50)
-- Fix: "value too long for type character varying(10)" errors

BEGIN;

-- Widen currency (likely fine at 10, but make it 10 for consistency)
ALTER TABLE properties ALTER COLUMN currency TYPE VARCHAR(10);

-- Widen transaction_type (constrained to sale/rent, but widen for future)
ALTER TABLE properties ALTER COLUMN transaction_type TYPE VARCHAR(20);

-- Widen energy class fields (can be longer like "A+", "very good", etc.)
ALTER TABLE properties ALTER COLUMN apt_energy_class TYPE VARCHAR(50);
ALTER TABLE properties ALTER COLUMN house_energy_class TYPE VARCHAR(50);
ALTER TABLE properties ALTER COLUMN comm_energy_class TYPE VARCHAR(50);
ALTER TABLE properties ALTER COLUMN energy_rating TYPE VARCHAR(50);

-- Widen description_language (should be fine, but widen for safety)
ALTER TABLE properties ALTER COLUMN description_language TYPE VARCHAR(20);

-- Widen country-specific fields (can be arbitrary strings)
ALTER TABLE properties ALTER COLUMN czech_disposition TYPE VARCHAR(50);
ALTER TABLE properties ALTER COLUMN italy_cadastral_category TYPE VARCHAR(50);

-- Widen condition, heating_type, construction_type (Universal Tier 1 fields)
-- These were added in migration 009 but might have restrictive lengths
ALTER TABLE properties ALTER COLUMN condition TYPE VARCHAR(50);
ALTER TABLE properties ALTER COLUMN heating_type TYPE VARCHAR(50);
ALTER TABLE properties ALTER COLUMN construction_type TYPE VARCHAR(50);
ALTER TABLE properties ALTER COLUMN furnished TYPE VARCHAR(50);

COMMIT;
