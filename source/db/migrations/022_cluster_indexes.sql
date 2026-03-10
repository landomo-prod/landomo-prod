-- Migration 022: Cluster Indexes for Map Clustering Performance
--
-- Creates optimized indexes for map clustering queries:
-- 1. Geohash-based clustering (zoom 1-14)
-- 2. Grid-based clustering (zoom 15-16)
-- 3. Bounding box queries (zoom 17+)
--
-- NOTE: Uses CONCURRENTLY so cannot be inside a transaction block.
-- NOTE: Must create on partitions directly (not partitioned parent).
--
-- Expected performance improvements:
-- - Geohash clustering: <50ms (was 200-500ms)
-- - Grid clustering: <150ms (was 500-1000ms)
-- - Individual properties: <50ms (was 100-200ms)

-- ============================================================================
-- 1. GEOHASH COMPOSITE INDEXES (per partition)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apt_geohash_cluster
  ON properties_apartment (geohash, property_category, status, price)
  WHERE geohash IS NOT NULL AND status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_geohash_cluster
  ON properties_house (geohash, property_category, status, price)
  WHERE geohash IS NOT NULL AND status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_geohash_cluster
  ON properties_land (geohash, property_category, status, price)
  WHERE geohash IS NOT NULL AND status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comm_geohash_cluster
  ON properties_commercial (geohash, property_category, status, price)
  WHERE geohash IS NOT NULL AND status = 'active';

-- ============================================================================
-- 2. BOUNDING BOX INDEXES (per partition)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apt_bounds_cluster
  ON properties_apartment (latitude, longitude, property_category, status)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_bounds_cluster
  ON properties_house (latitude, longitude, property_category, status)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_bounds_cluster
  ON properties_land (latitude, longitude, property_category, status)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comm_bounds_cluster
  ON properties_commercial (latitude, longitude, property_category, status)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';

-- ============================================================================
-- 3. PRICE RANGE INDEXES (per partition)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apt_price_cluster
  ON properties_apartment (price) WHERE status = 'active' AND price IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_house_price_cluster
  ON properties_house (price) WHERE status = 'active' AND price IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_land_price_cluster
  ON properties_land (price) WHERE status = 'active' AND price IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comm_price_cluster
  ON properties_commercial (price) WHERE status = 'active' AND price IS NOT NULL;

-- ============================================================================
-- 4. UPDATE TABLE STATISTICS
-- ============================================================================
ANALYZE properties_apartment;
ANALYZE properties_house;
ANALYZE properties_land;
ANALYZE properties_commercial;

-- ============================================================================
-- ROLLBACK SCRIPT (for reference, not executed)
-- ============================================================================
-- DROP INDEX CONCURRENTLY IF EXISTS idx_apt_geohash_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_house_geohash_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_land_geohash_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_comm_geohash_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_apt_bounds_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_house_bounds_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_land_bounds_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_comm_bounds_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_apt_price_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_house_price_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_land_price_cluster;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_comm_price_cluster;
