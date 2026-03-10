-- Migration 019: Final expansion of all remaining VARCHAR(50) columns
-- Root cause: Some Czech energy class/disposition values exceed 50 characters
-- Solution: Expand ALL remaining VARCHAR(50) to VARCHAR(100) minimum

-- Expand energy class fields to VARCHAR(100) (some Czech energy descriptions can be long)
ALTER TABLE properties_new ALTER COLUMN apt_energy_class TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN house_energy_class TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN comm_energy_class TYPE VARCHAR(100);
ALTER TABLE properties_new ALTER COLUMN energy_rating TYPE VARCHAR(100);

-- Expand Czech disposition to VARCHAR(100) (some complex dispositions exceed 50 chars)
ALTER TABLE properties_new ALTER COLUMN czech_disposition TYPE VARCHAR(100);

-- Expand Italy cadastral category to VARCHAR(100)
ALTER TABLE properties_new ALTER COLUMN italy_cadastral_category TYPE VARCHAR(100);

-- Keep agent_phone at VARCHAR(50) - this should never exceed 50

-- Verify: Should only have agent_phone left at VARCHAR(50)
SELECT
  column_name,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'properties_new'
  AND character_maximum_length = 50
ORDER BY column_name;
