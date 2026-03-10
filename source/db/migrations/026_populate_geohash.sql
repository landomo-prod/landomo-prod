-- Migration 026: Populate geohash column from lat/lon coordinates
--
-- Uses PostGIS ST_GeoHash to generate geohash values for all properties.
-- Creates a trigger to auto-populate on INSERT/UPDATE.
--
-- Prerequisites: PostGIS extension must be installed (migration 022 or manual)

BEGIN;

-- ============================================================================
-- 1. POPULATE EXISTING PROPERTIES WITH GEOHASH
-- ============================================================================
-- ST_GeoHash(geometry, maxchars) generates a geohash string.
-- Precision 12 gives ~3.7cm accuracy - more than enough for property clustering.

UPDATE properties_new
SET geohash = ST_GeoHash(ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326), 12)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND (geohash IS NULL OR geohash = '');

-- ============================================================================
-- 2. CREATE TRIGGER FUNCTION FOR AUTO-POPULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_populate_geohash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geohash := ST_GeoHash(
      ST_SetSRID(ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326),
      12
    );
  ELSE
    NEW.geohash := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. CREATE TRIGGERS ON EACH PARTITION
-- ============================================================================
-- Triggers must be on partitions, not the parent table.

DROP TRIGGER IF EXISTS trg_geohash_apartment ON properties_apartment;
CREATE TRIGGER trg_geohash_apartment
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_apartment
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geohash();

DROP TRIGGER IF EXISTS trg_geohash_house ON properties_house;
CREATE TRIGGER trg_geohash_house
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_house
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geohash();

DROP TRIGGER IF EXISTS trg_geohash_land ON properties_land;
CREATE TRIGGER trg_geohash_land
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_land
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geohash();

DROP TRIGGER IF EXISTS trg_geohash_commercial ON properties_commercial;
CREATE TRIGGER trg_geohash_commercial
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_commercial
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geohash();

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  total_with_coords BIGINT;
  total_with_geohash BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_with_coords
  FROM properties_new
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

  SELECT COUNT(*) INTO total_with_geohash
  FROM properties_new
  WHERE geohash IS NOT NULL AND geohash != '';

  RAISE NOTICE 'Properties with coordinates: %', total_with_coords;
  RAISE NOTICE 'Properties with geohash: %', total_with_geohash;

  IF total_with_coords > 0 AND total_with_geohash < total_with_coords THEN
    RAISE WARNING 'Geohash gap: % properties have coords but no geohash',
      total_with_coords - total_with_geohash;
  ELSE
    RAISE NOTICE 'All properties with coordinates have geohash values';
  END IF;
END $$;

COMMIT;
