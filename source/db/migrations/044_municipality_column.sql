-- ============================================================
-- Migration 044: Add municipality column to properties
--
-- Stores the admin level 8 municipality name from polygon service.
-- ALTER on parent propagates to all 5 partitions.
--
-- Date: 2026-02-28
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS municipality VARCHAR(150);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apartment_municipality
  ON properties_apartment(municipality) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_municipality
  ON properties_house(municipality) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_municipality
  ON properties_land(municipality) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commercial_municipality
  ON properties_commercial(municipality) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_other_municipality
  ON properties_other(municipality) WHERE status = 'active';
