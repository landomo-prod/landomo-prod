-- Migration 038: Add district column to properties
-- Stores the admin level 6 district name (looked up via polygon service at ingest time)

ALTER TABLE properties ADD COLUMN IF NOT EXISTS district VARCHAR(100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apartment_district ON properties_apartment(district) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_district ON properties_house(district) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_district ON properties_land(district) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commercial_district ON properties_commercial(district) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_other_district ON properties_other(district) WHERE status = 'active';
