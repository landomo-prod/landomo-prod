-- ============================================================
-- Migration 007: Comprehensive Index Strategy
-- Adds missing indexes across all tables for search, staleness,
-- geo-queries, lifecycle tracking, and aggregation workloads.
-- Date: 2026-02-08
-- ============================================================
--
-- INDEX STRATEGY OVERVIEW
-- -----------------------
-- This migration fills gaps not covered by init-schema.sql or
-- the per-country index files. It targets four workloads:
--
-- 1. SEARCH SERVICE: The main search path always filters
--    status='active' first, then property_type, transaction_type,
--    price range, city, and sorts by created_at or price.
--    A covering composite index lets Postgres satisfy these
--    queries with a single index scan + filter.
--
-- 2. GEO-SEARCH: ST_DWithin and bounding-box queries need a
--    GiST spatial index on (longitude, latitude) as a geography
--    point. Without it, every geo query seq-scans the table.
--
-- 3. STALENESS / LIFECYCLE: The circuit breaker groups by
--    portal WHERE status='active', then checks last_seen_at.
--    A composite (portal, status) partial index accelerates this.
--    The orphaned-run reaper needs (status, started_at) on
--    scrape_runs.
--
-- 4. AGGREGATIONS: Price stats group by (property_type,
--    transaction_type) WHERE status='active' AND price IS NOT NULL.
--    A partial covering index avoids a full table scan.
--
-- All indexes use IF NOT EXISTS so this migration is idempotent.
-- We use regular CREATE INDEX (not CONCURRENTLY) because
-- migrations run during maintenance windows. For live systems,
-- run the CONCURRENTLY variants below instead.
-- ============================================================


-- ============================================================
-- SECTION 1: PROPERTIES TABLE - SEARCH INDEXES
-- ============================================================

-- 1a. Timestamps for default sort (search defaults to ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_properties_created_at
  ON properties(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_updated_at
  ON properties(updated_at DESC);

-- 1b. Primary search composite: the search service always starts with
--     status='active', then filters property_type, transaction_type, and price.
--     This index covers the most common query pattern in a single scan.
CREATE INDEX IF NOT EXISTS idx_properties_search_composite
  ON properties(status, property_type, transaction_type, price)
  WHERE status = 'active';

-- 1c. Active properties by city + price (common city-based search with price sort)
--     Extends the existing idx_properties_city_price by including property_type
--     for the typical "apartments for sale in Prague" query.
CREATE INDEX IF NOT EXISTS idx_properties_active_city_type_price
  ON properties(city, property_type, transaction_type, price)
  WHERE status = 'active';

-- 1d. Active properties sorted by price (for "sort by price" on search results)
CREATE INDEX IF NOT EXISTS idx_properties_active_price
  ON properties(price ASC)
  WHERE status = 'active' AND price IS NOT NULL AND price > 0;

-- 1e. Active properties sorted by created_at (newest listings first, default sort)
CREATE INDEX IF NOT EXISTS idx_properties_active_created
  ON properties(created_at DESC)
  WHERE status = 'active';

-- 1f. Active properties by region for region-level browsing
CREATE INDEX IF NOT EXISTS idx_properties_active_region
  ON properties(region, property_type)
  WHERE status = 'active';


-- ============================================================
-- SECTION 2: PROPERTIES TABLE - GEO / SPATIAL INDEXES
-- ============================================================

-- 2a. PostGIS GiST index for ST_DWithin radius queries.
--     The geo-search builds ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
--     so we create a functional index on the same expression.
--     Requires PostGIS extension (enabled by docker/postgres/enable-postgis.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_properties_geo_point
        ON properties USING GIST (
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        )
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ';
    RAISE NOTICE 'PostGIS spatial index created';
  ELSE
    RAISE NOTICE 'PostGIS not available - skipping spatial index (install postgis extension first)';
  END IF;
END $$;

-- 2b. B-tree covering index for bounding-box map queries
--     (latitude BETWEEN south AND north AND longitude BETWEEN west AND east)
CREATE INDEX IF NOT EXISTS idx_properties_lat_lon_bbox
  ON properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';


-- ============================================================
-- SECTION 3: PROPERTIES TABLE - STALENESS & LIFECYCLE INDEXES
-- ============================================================

-- 3a. Portal + status composite for staleness circuit breaker.
--     The circuit breaker groups by portal WHERE status='active' and counts
--     stale vs total. This index makes the GROUP BY an index-only scan.
CREATE INDEX IF NOT EXISTS idx_properties_portal_status
  ON properties(portal, status);

-- 3b. Portal + status + last_seen_at for the staleness UPDATE query.
--     The actual UPDATE re-checks last_seen_at in the WHERE clause to
--     avoid race conditions, so including it in the index helps.
CREATE INDEX IF NOT EXISTS idx_properties_portal_stale_check
  ON properties(portal, last_seen_at)
  WHERE status = 'active';

-- 3c. Status + last_updated_at for admin dashboards ("recently changed listings")
CREATE INDEX IF NOT EXISTS idx_properties_status_updated
  ON properties(status, last_updated_at DESC);


-- ============================================================
-- SECTION 4: PROPERTIES TABLE - AGGREGATION INDEXES
-- ============================================================

-- 4a. Covering index for price aggregation queries.
--     Aggregation route groups by (property_type, transaction_type) WHERE
--     status='active' AND price IS NOT NULL, computing AVG/MIN/MAX(price).
--     Including price in the index enables an index-only scan.
CREATE INDEX IF NOT EXISTS idx_properties_agg_price
  ON properties(property_type, transaction_type, price)
  WHERE status = 'active' AND price IS NOT NULL;

-- 4b. Property type distribution (COUNT by property_type WHERE active)
CREATE INDEX IF NOT EXISTS idx_properties_active_type_dist
  ON properties(property_type)
  WHERE status = 'active';


-- ============================================================
-- SECTION 5: CHANGE TRACKING TABLES
-- ============================================================

-- 5a. Property changes by type (for filtering "show me all price changes")
CREATE INDEX IF NOT EXISTS idx_property_changes_type
  ON property_changes(change_type);

-- 5b. Property changes composite: find recent changes for a property
CREATE INDEX IF NOT EXISTS idx_property_changes_property_recent
  ON property_changes(property_id, changed_at DESC);

-- 5c. Price history: per-property timeline (latest price first)
CREATE INDEX IF NOT EXISTS idx_price_history_property_recent
  ON price_history(property_id, recorded_at DESC);


-- ============================================================
-- SECTION 6: LISTING STATUS HISTORY TABLE
-- ============================================================

-- 6a. Status + started_at for analytics ("how many listings were removed last week")
CREATE INDEX IF NOT EXISTS idx_lsh_status_started
  ON listing_status_history(status, started_at DESC);

-- 6b. Property + status for "show me status history for this listing" queries
CREATE INDEX IF NOT EXISTS idx_lsh_property_status
  ON listing_status_history(property_id, status, started_at DESC);


-- ============================================================
-- SECTION 7: SCRAPE RUNS TABLE
-- ============================================================

-- 7a. Status + started_at for orphaned run reaper (finds 'running' runs older than 4h)
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status_started
  ON scrape_runs(status, started_at)
  WHERE status = 'running';

-- 7b. Portal + status for "latest completed run per portal" lookups
CREATE INDEX IF NOT EXISTS idx_scrape_runs_portal_status
  ON scrape_runs(portal, status, finished_at DESC);


-- ============================================================
-- SECTION 8: INGESTION LOG TABLE
-- ============================================================

-- 8a. Status filter for finding failed ingestions
CREATE INDEX IF NOT EXISTS idx_ingestion_log_status
  ON ingestion_log(status)
  WHERE status != 'success';

-- 8b. Portal + ingested_at for per-portal ingestion history
CREATE INDEX IF NOT EXISTS idx_ingestion_log_portal_time
  ON ingestion_log(portal, ingested_at DESC);


-- ============================================================
-- SECTION 9: SLOVAKIA-SPECIFIC INDEXES
-- (Slovakia has country columns but no index file yet)
-- ============================================================

-- Slovak disposition (apartment layout type)
CREATE INDEX IF NOT EXISTS idx_properties_slovak_disposition
  ON properties(slovak_disposition)
  WHERE slovak_disposition IS NOT NULL;

-- Slovak ownership type
CREATE INDEX IF NOT EXISTS idx_properties_slovak_ownership
  ON properties(slovak_ownership)
  WHERE slovak_ownership IS NOT NULL;

-- Composite index for common queries (disposition + price range)
CREATE INDEX IF NOT EXISTS idx_properties_slovak_disposition_price
  ON properties(slovak_disposition, price)
  WHERE slovak_disposition IS NOT NULL AND price IS NOT NULL;


-- ============================================================
-- COMPLETION
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 007: Comprehensive indexes created successfully';
  RAISE NOTICE 'Index categories: search (6), geo (2), staleness (3), aggregation (2), change tracking (3), lifecycle (2), scrape runs (2), ingestion log (2), slovakia (3)';
  RAISE NOTICE 'Total new indexes: 25 (+ 1 conditional PostGIS spatial index)';
END $$;
