-- Enable PostGIS Extension on All Country Databases
-- This script enables PostGIS for geographic search functionality
-- Run this script with a database admin user

-- Enable PostGIS on landomo_australia
\c landomo_australia
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_uk
\c landomo_uk
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_usa
\c landomo_usa
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_czech
\c landomo_czech
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_france
\c landomo_france
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_spain
\c landomo_spain
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_italy
\c landomo_italy
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_slovakia
\c landomo_slovakia
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_germany
\c landomo_germany
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_hungary
\c landomo_hungary
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Enable PostGIS on landomo_austria
\c landomo_austria
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();

-- Add geography column to properties table (if not exists)
-- Run these commands after schema is created

-- For all databases, add location_point column
\c landomo_australia
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_uk
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_usa
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_czech
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_france
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_spain
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_italy
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_slovakia
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_germany
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_hungary
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

\c landomo_austria
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

-- Populate location_point from existing lat/lon (example for one database)
\c landomo_australia
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location_point IS NULL;

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point)
  WHERE location_point IS NOT NULL;

-- Repeat for other databases
\c landomo_uk
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_usa
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_czech
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_france
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_spain
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_italy
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_slovakia
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_germany
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_hungary
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

\c landomo_austria
UPDATE properties
SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location_point IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_location_point
  ON properties USING GIST(location_point) WHERE location_point IS NOT NULL;

-- Verify installation
\c landomo_australia
SELECT COUNT(*) as total_properties,
       COUNT(location_point) as with_location
FROM properties;
