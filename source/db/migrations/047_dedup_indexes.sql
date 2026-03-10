-- Dedup lookup index: price + coordinates on each partition
-- Used by inline dedup (findPotentialDuplicates strategy 1)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apartment_dedup
  ON properties_apartment (price, latitude, longitude, transaction_type)
  WHERE status = 'active' AND latitude IS NOT NULL AND canonical_property_id IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_dedup
  ON properties_house (price, latitude, longitude, transaction_type)
  WHERE status = 'active' AND latitude IS NOT NULL AND canonical_property_id IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_dedup
  ON properties_land (price, latitude, longitude, transaction_type)
  WHERE status = 'active' AND latitude IS NOT NULL AND canonical_property_id IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_commercial_dedup
  ON properties_commercial (price, latitude, longitude, transaction_type)
  WHERE status = 'active' AND latitude IS NOT NULL AND canonical_property_id IS NULL;

-- Index for cascade promotion lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_property_duplicates_canonical
  ON property_duplicates (canonical_id);
