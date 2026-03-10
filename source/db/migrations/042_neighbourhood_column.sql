-- Migration 042: Add neighbourhood column to properties
-- Stores the admin level 9/10 neighbourhood name (looked up via Pelias/polygon service at ingest time)

ALTER TABLE properties ADD COLUMN IF NOT EXISTS neighbourhood VARCHAR(150);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apartment_neighbourhood ON properties_apartment(neighbourhood) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_neighbourhood ON properties_house(neighbourhood) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_neighbourhood ON properties_land(neighbourhood) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commercial_neighbourhood ON properties_commercial(neighbourhood) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_other_neighbourhood ON properties_other(neighbourhood) WHERE status = 'active';
