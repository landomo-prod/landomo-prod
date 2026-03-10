-- Migration 018: Expand ALL remaining VARCHAR(50) columns
-- Comprehensive fix to eliminate all VARCHAR constraint errors
-- Expands all remaining VARCHAR(50) to VARCHAR(100) or VARCHAR(255) as appropriate

-- Core property fields (could have long descriptive values)
ALTER TABLE properties_new ALTER COLUMN property_type TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN condition TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN construction_type TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN heating_type TYPE VARCHAR(100);

-- Commercial fields
ALTER TABLE properties_new ALTER COLUMN comm_property_subtype TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN comm_condition TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN comm_construction_type TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN comm_heating_type TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN comm_cooling_type TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN comm_zoning TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN comm_internet_speed TYPE VARCHAR(100);

-- Land fields
ALTER TABLE properties_new ALTER COLUMN land_ownership_type TYPE VARCHAR(100);

-- Country-specific ownership fields (legal descriptions can be long)
ALTER TABLE properties_new ALTER COLUMN czech_ownership TYPE VARCHAR(255);
ALTER TABLE properties_new ALTER COLUMN czech_building_type TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN slovak_ownership TYPE VARCHAR(255);
ALTER TABLE properties_new ALTER COLUMN austrian_ownership TYPE VARCHAR(255);
ALTER TABLE properties_new ALTER COLUMN austrian_provision TYPE VARCHAR(255);
ALTER TABLE properties_new ALTER COLUMN german_ownership TYPE VARCHAR(255);
ALTER TABLE properties_new ALTER COLUMN german_provision TYPE VARCHAR(255);
ALTER TABLE properties_new ALTER COLUMN hungarian_ownership TYPE VARCHAR(255);

-- Agent contact info
ALTER TABLE properties_new ALTER COLUMN agent_phone TYPE VARCHAR(50);  -- Keep at 50, phones shouldn't exceed this

-- Verify no VARCHAR(50) columns remain (except agent_phone)
SELECT
  column_name,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'properties_new'
  AND character_maximum_length = 50
ORDER BY column_name;
