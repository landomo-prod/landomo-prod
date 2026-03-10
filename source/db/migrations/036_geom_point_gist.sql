-- Migration 036: Add geom_point geometry column with GiST index for KNN geo-search
--
-- The geo-search service uses PostGIS KNN (<->) operator on a stored geometry column
-- for fast ordered GiST traversal. This is significantly faster than computing
-- ST_Distance at query time across all rows.
--
-- Adds geom_point geometry(Point,4326) to all partition tables, populates from
-- existing lat/lon, creates GiST indexes, and sets up a trigger for auto-population.

BEGIN;

-- ============================================================================
-- 1. ADD COLUMN TO EACH PARTITION
-- ============================================================================

ALTER TABLE properties_apartment  ADD COLUMN IF NOT EXISTS geom_point geometry(Point, 4326);
ALTER TABLE properties_house       ADD COLUMN IF NOT EXISTS geom_point geometry(Point, 4326);
ALTER TABLE properties_land        ADD COLUMN IF NOT EXISTS geom_point geometry(Point, 4326);
ALTER TABLE properties_commercial  ADD COLUMN IF NOT EXISTS geom_point geometry(Point, 4326);
ALTER TABLE properties_other       ADD COLUMN IF NOT EXISTS geom_point geometry(Point, 4326);

-- ============================================================================
-- 2. POPULATE FROM EXISTING LATITUDE/LONGITUDE
-- ============================================================================

UPDATE properties_apartment
SET geom_point = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom_point IS NULL;

UPDATE properties_house
SET geom_point = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom_point IS NULL;

UPDATE properties_land
SET geom_point = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom_point IS NULL;

UPDATE properties_commercial
SET geom_point = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom_point IS NULL;

UPDATE properties_other
SET geom_point = ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom_point IS NULL;

-- ============================================================================
-- 3. TRIGGER FUNCTION FOR AUTO-POPULATION ON INSERT/UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_populate_geom_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom_point := ST_SetSRID(ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326);
  ELSE
    NEW.geom_point := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. TRIGGERS ON EACH PARTITION
-- ============================================================================

DROP TRIGGER IF EXISTS trg_geom_point_apartment ON properties_apartment;
CREATE TRIGGER trg_geom_point_apartment
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_apartment
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geom_point();

DROP TRIGGER IF EXISTS trg_geom_point_house ON properties_house;
CREATE TRIGGER trg_geom_point_house
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_house
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geom_point();

DROP TRIGGER IF EXISTS trg_geom_point_land ON properties_land;
CREATE TRIGGER trg_geom_point_land
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_land
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geom_point();

DROP TRIGGER IF EXISTS trg_geom_point_commercial ON properties_commercial;
CREATE TRIGGER trg_geom_point_commercial
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_commercial
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geom_point();

DROP TRIGGER IF EXISTS trg_geom_point_other ON properties_other;
CREATE TRIGGER trg_geom_point_other
  BEFORE INSERT OR UPDATE OF latitude, longitude ON properties_other
  FOR EACH ROW EXECUTE FUNCTION fn_populate_geom_point();

COMMIT;

-- ============================================================================
-- 5. GIST INDEXES FOR KNN SEARCH
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run these after the COMMIT above.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apartment_geom_point
  ON properties_apartment USING GIST (geom_point)
  WHERE geom_point IS NOT NULL AND status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_geom_point
  ON properties_house USING GIST (geom_point)
  WHERE geom_point IS NOT NULL AND status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_geom_point
  ON properties_land USING GIST (geom_point)
  WHERE geom_point IS NOT NULL AND status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commercial_geom_point
  ON properties_commercial USING GIST (geom_point)
  WHERE geom_point IS NOT NULL AND status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_other_geom_point
  ON properties_other USING GIST (geom_point)
  WHERE geom_point IS NOT NULL AND status = 'active';
