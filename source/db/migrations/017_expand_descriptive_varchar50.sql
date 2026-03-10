-- Migration 017: Expand VARCHAR(50) descriptive fields to VARCHAR(100)
-- Issue: Properties still failing with "value too long for type character varying(50)"
-- Root cause: Czech descriptive text can be longer than 50 characters
-- Solution: Expand all descriptive VARCHAR(50) columns to VARCHAR(100)

-- Apartment descriptive fields
ALTER TABLE properties_new
  ALTER COLUMN apt_property_subtype TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN apt_construction_type TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN apt_condition TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN apt_heating_type TYPE VARCHAR(100);

-- House descriptive fields
ALTER TABLE properties_new
  ALTER COLUMN house_property_subtype TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN house_construction_type TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN house_condition TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN house_heating_type TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN house_roof_type TYPE VARCHAR(100);

-- Land descriptive fields
ALTER TABLE properties_new
  ALTER COLUMN land_property_subtype TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_zoning TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_land_type TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_water_supply TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_sewage TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_electricity TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_gas TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_road_access TYPE VARCHAR(100);

ALTER TABLE properties_new
  ALTER COLUMN land_terrain TYPE VARCHAR(100);

-- Commercial descriptive fields (if exist)
-- Note: Check schema for commercial-specific VARCHAR(50) columns

-- Verify changes
SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'properties_apartment'
  AND character_maximum_length IN (50, 100)
  AND column_name LIKE 'apt_%'
ORDER BY character_maximum_length, column_name;
