-- Migration 016: Expand VARCHAR(10) constraints to prevent data truncation
-- Issue: Properties failing with "value too long for type character varying(10)"
-- Solution: Expand problematic VARCHAR(10) columns to VARCHAR(50) or VARCHAR(100)

-- Expand energy class columns (can have values like "A++", "B1", "Not specified", etc.)
-- Must alter parent table (properties_new) not partitions
ALTER TABLE properties_new
  ALTER COLUMN apt_energy_class TYPE VARCHAR(50);

ALTER TABLE properties_new
  ALTER COLUMN house_energy_class TYPE VARCHAR(50);

ALTER TABLE properties_new
  ALTER COLUMN comm_energy_class TYPE VARCHAR(50);

ALTER TABLE properties_new
  ALTER COLUMN energy_rating TYPE VARCHAR(50);

-- Expand Czech disposition (can have values like "1+kk", "2+1", "Atypický", etc.)
ALTER TABLE properties_new
  ALTER COLUMN czech_disposition TYPE VARCHAR(50);

-- Expand Italy cadastral category (can have longer Italian administrative codes)
ALTER TABLE properties_new
  ALTER COLUMN italy_cadastral_category TYPE VARCHAR(50);

-- Expand description language (though unlikely to be issue, future-proof it)
ALTER TABLE properties_new
  ALTER COLUMN description_language TYPE VARCHAR(20);

-- Note: currency and transaction_type stay VARCHAR(10) as they're strictly controlled
-- currency: max 3 chars (EUR, USD, CZK)
-- transaction_type: max 4 chars (sale, rent) with CHECK constraint

-- Verify changes
SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'properties_apartment'
  AND column_name IN (
    'apt_energy_class',
    'energy_rating',
    'czech_disposition',
    'italy_cadastral_category',
    'description_language'
  )
ORDER BY column_name;
