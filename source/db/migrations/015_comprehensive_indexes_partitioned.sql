-- ============================================================
-- Migration 015: Comprehensive Index Strategy for Partitioned Tables
--
-- Comprehensive indexing for properties_new category-partitioned table.
-- Adapts migration 007 strategy for partition-aware performance.
--
-- INDEX STRATEGY FOR PARTITIONED TABLES
-- --------------------------------------
-- 1. Base table indexes: Inherited by all partitions automatically
-- 2. Partition-specific indexes: Category-specific columns only
-- 3. Partial indexes: WHERE clauses reduce index size and improve selectivity
-- 4. Covering indexes: Include commonly queried columns to enable index-only scans
--
-- WORKLOAD TARGETS
-- ----------------
-- 1. SEARCH: Multi-filter queries with sort (status, category, type, price, city)
-- 2. GEO-SEARCH: ST_DWithin radius queries and bounding-box queries
-- 3. STALENESS: Portal-level circuit breaker and lifecycle tracking
-- 4. AGGREGATIONS: Price stats, category distribution, market analytics
-- 5. COUNTRY-SPECIFIC: Disposition, ownership, energy ratings, etc.
--
-- Date: 2026-02-12
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: BASE TABLE - COMMON SEARCH INDEXES
-- ============================================================

-- 1a. Timestamps for default sort
CREATE INDEX IF NOT EXISTS idx_properties_new_created_desc
  ON properties_new(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_new_updated_desc
  ON properties_new(updated_at DESC);

-- 1b. Primary search composite: category-aware search path
--     Query pattern: WHERE status='active' AND property_category='apartment'
--                    AND transaction_type='sale' AND price BETWEEN X AND Y
CREATE INDEX IF NOT EXISTS idx_properties_new_search_composite
  ON properties_new(status, property_category, transaction_type, price)
  WHERE status = 'active';

-- 1c. City-based search with category filter (most common search pattern)
--     Query pattern: "2-bedroom apartments for sale in Prague"
CREATE INDEX IF NOT EXISTS idx_properties_new_city_search
  ON properties_new(city, property_category, transaction_type, price)
  WHERE status = 'active';

-- 1d. Region-based browsing
CREATE INDEX IF NOT EXISTS idx_properties_new_region_category
  ON properties_new(region, property_category, transaction_type)
  WHERE status = 'active';

-- 1e. Active properties sorted by price (price-based sort)
CREATE INDEX IF NOT EXISTS idx_properties_new_active_price_asc
  ON properties_new(price ASC)
  WHERE status = 'active' AND price IS NOT NULL AND price > 0;

-- 1f. Active properties sorted by created_at (newest listings first)
CREATE INDEX IF NOT EXISTS idx_properties_new_active_created_desc
  ON properties_new(created_at DESC)
  WHERE status = 'active';

-- 1g. Country-based search (all properties in a country)
CREATE INDEX IF NOT EXISTS idx_properties_new_country_category
  ON properties_new(country, property_category, status, price)
  WHERE status = 'active';

-- ============================================================
-- SECTION 2: BASE TABLE - GEO / SPATIAL INDEXES
-- ============================================================

-- 2a. PostGIS GiST index for ST_DWithin radius queries
--     Enables "find properties within 5km of this location" queries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_properties_new_geo_point
        ON properties_new USING GIST (
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        )
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = ''active''
    ';
    RAISE NOTICE 'PostGIS spatial index created on properties_new';
  ELSE
    RAISE NOTICE 'PostGIS not available - skipping spatial index (install postgis extension first)';
  END IF;
END $$;

-- 2b. B-tree covering index for bounding-box map queries
--     Query pattern: latitude BETWEEN south AND north AND longitude BETWEEN west AND east
CREATE INDEX IF NOT EXISTS idx_properties_new_lat_lon_bbox
  ON properties_new(latitude, longitude, property_category)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';

-- 2c. Geohash index for fast geospatial clustering
CREATE INDEX IF NOT EXISTS idx_properties_new_geohash_active
  ON properties_new(geohash, property_category)
  WHERE geohash IS NOT NULL AND status = 'active';

-- ============================================================
-- SECTION 3: BASE TABLE - STALENESS & LIFECYCLE INDEXES
-- ============================================================

-- 3a. Portal + status composite for staleness circuit breaker
--     Query pattern: GROUP BY portal WHERE status='active'
CREATE INDEX IF NOT EXISTS idx_properties_new_portal_status
  ON properties_new(portal, status);

-- 3b. Portal + last_seen_at for staleness UPDATE query
--     The staleness job marks active listings as removed if not seen in 72h
CREATE INDEX IF NOT EXISTS idx_properties_new_portal_stale_check
  ON properties_new(portal, last_seen_at)
  WHERE status = 'active';

-- 3c. Status + last_updated_at for admin dashboards
CREATE INDEX IF NOT EXISTS idx_properties_new_status_updated_desc
  ON properties_new(status, last_updated_at DESC);

-- 3d. First seen tracking (new listings dashboard)
CREATE INDEX IF NOT EXISTS idx_properties_new_first_seen_desc
  ON properties_new(first_seen_at DESC)
  WHERE status = 'active';

-- ============================================================
-- SECTION 4: BASE TABLE - AGGREGATION INDEXES
-- ============================================================

-- 4a. Price aggregation by category and transaction type
--     Query pattern: SELECT AVG(price) GROUP BY property_category, transaction_type
CREATE INDEX IF NOT EXISTS idx_properties_new_agg_price
  ON properties_new(property_category, transaction_type, price)
  WHERE status = 'active' AND price IS NOT NULL;

-- 4b. Category distribution (COUNT by property_category)
CREATE INDEX IF NOT EXISTS idx_properties_new_category_dist
  ON properties_new(property_category, status);

-- 4c. Portal statistics (properties per portal)
CREATE INDEX IF NOT EXISTS idx_properties_new_portal_stats
  ON properties_new(portal, property_category, status);

-- ============================================================
-- SECTION 5: PARTITION-SPECIFIC - APARTMENT INDEXES
-- ============================================================

-- 5a. Bedroom-based apartment search (most common filter)
CREATE INDEX IF NOT EXISTS idx_apt_bedrooms_price
  ON properties_apartment(apt_bedrooms, price)
  WHERE apt_bedrooms IS NOT NULL AND status = 'active';

-- 5b. Apartment size + bedrooms composite (common combination)
CREATE INDEX IF NOT EXISTS idx_apt_sqm_bedrooms
  ON properties_apartment(apt_sqm, apt_bedrooms)
  WHERE apt_sqm IS NOT NULL AND apt_bedrooms IS NOT NULL AND status = 'active';

-- 5c. Apartment floor composite (floor + elevator availability)
CREATE INDEX IF NOT EXISTS idx_apt_floor_elevator
  ON properties_apartment(apt_floor, apt_has_elevator)
  WHERE apt_floor IS NOT NULL AND status = 'active';

-- 5d. Apartment property subtype (studio, penthouse, loft, etc.)
CREATE INDEX IF NOT EXISTS idx_apt_subtype_price
  ON properties_apartment(apt_property_subtype, price)
  WHERE apt_property_subtype IS NOT NULL AND status = 'active';

-- 5e. Apartment amenity filters (common filter combinations)
CREATE INDEX IF NOT EXISTS idx_apt_amenities
  ON properties_apartment(apt_has_parking, apt_has_balcony, apt_has_elevator)
  WHERE status = 'active';

-- ============================================================
-- SECTION 6: PARTITION-SPECIFIC - HOUSE INDEXES
-- ============================================================

-- 6a. House bedroom + plot size composite
CREATE INDEX IF NOT EXISTS idx_house_bedrooms_plot
  ON properties_house(house_bedrooms, house_sqm_plot)
  WHERE house_bedrooms IS NOT NULL AND house_sqm_plot IS NOT NULL AND status = 'active';

-- 6b. House living area + plot area (common combination)
CREATE INDEX IF NOT EXISTS idx_house_areas
  ON properties_house(house_sqm_living, house_sqm_plot)
  WHERE house_sqm_living IS NOT NULL AND house_sqm_plot IS NOT NULL AND status = 'active';

-- 6c. House amenity filters (garden, pool, garage)
CREATE INDEX IF NOT EXISTS idx_house_amenities
  ON properties_house(house_has_garden, house_has_pool, house_has_garage)
  WHERE status = 'active';

-- 6d. House property subtype (villa, cottage, townhouse, etc.)
CREATE INDEX IF NOT EXISTS idx_house_subtype_price
  ON properties_house(house_property_subtype, price)
  WHERE house_property_subtype IS NOT NULL AND status = 'active';

-- ============================================================
-- SECTION 7: PARTITION-SPECIFIC - LAND INDEXES
-- ============================================================

-- 7a. Land area + zoning composite (primary land filters)
CREATE INDEX IF NOT EXISTS idx_land_area_zoning
  ON properties_land(land_area_plot_sqm, land_zoning)
  WHERE land_area_plot_sqm IS NOT NULL AND status = 'active';

-- 7b. Land utilities composite (water, electricity, sewage)
CREATE INDEX IF NOT EXISTS idx_land_utilities
  ON properties_land(land_water_supply, land_electricity, land_sewage)
  WHERE status = 'active';

-- 7c. Land building permit + zoning (development potential)
CREATE INDEX IF NOT EXISTS idx_land_permit_zoning
  ON properties_land(land_building_permit, land_zoning)
  WHERE land_building_permit IS NOT NULL AND status = 'active';

-- 7d. Land property subtype (agricultural, residential, commercial, forest)
CREATE INDEX IF NOT EXISTS idx_land_subtype_price
  ON properties_land(land_property_subtype, price)
  WHERE land_property_subtype IS NOT NULL AND status = 'active';

-- ============================================================
-- SECTION 8: PARTITION-SPECIFIC - COMMERCIAL INDEXES
-- ============================================================

-- 8a. Commercial floor area + zoning (primary commercial filters)
CREATE INDEX IF NOT EXISTS idx_comm_area_zoning
  ON properties_commercial(comm_floor_area, comm_zoning)
  WHERE comm_floor_area IS NOT NULL AND status = 'active';

-- 8b. Commercial parking + floor area (common combination)
CREATE INDEX IF NOT EXISTS idx_comm_parking_area
  ON properties_commercial(comm_parking_spaces, comm_floor_area)
  WHERE comm_parking_spaces IS NOT NULL AND status = 'active';

-- 8c. Commercial amenities (elevator, HVAC, security)
CREATE INDEX IF NOT EXISTS idx_comm_amenities
  ON properties_commercial(comm_has_elevator, comm_has_hvac, comm_has_security_system)
  WHERE status = 'active';

-- 8d. Commercial property subtype (office, retail, industrial, warehouse)
CREATE INDEX IF NOT EXISTS idx_comm_subtype_price
  ON properties_commercial(comm_property_subtype, price)
  WHERE comm_property_subtype IS NOT NULL AND status = 'active';

-- ============================================================
-- SECTION 9: COUNTRY-SPECIFIC COMPOSITE INDEXES
-- ============================================================

-- Czech disposition + ownership (common search combination)
CREATE INDEX IF NOT EXISTS idx_properties_new_czech_composite
  ON properties_new(czech_disposition, czech_ownership, property_category)
  WHERE czech_disposition IS NOT NULL AND status = 'active';

-- Slovak disposition + ownership
CREATE INDEX IF NOT EXISTS idx_properties_new_slovak_composite
  ON properties_new(slovak_disposition, slovak_ownership, property_category)
  WHERE slovak_disposition IS NOT NULL AND status = 'active';

-- UK tenure + EPC rating (critical UK filters)
CREATE INDEX IF NOT EXISTS idx_properties_new_uk_composite
  ON properties_new(uk_tenure, uk_epc_rating, property_category)
  WHERE uk_tenure IS NOT NULL AND status = 'active';

-- French DPE + GES ratings (mandatory French energy ratings)
CREATE INDEX IF NOT EXISTS idx_properties_new_france_energy
  ON properties_new(france_dpe_rating, france_ges_rating, property_category)
  WHERE france_dpe_rating IS NOT NULL AND status = 'active';

-- German KfW standard + Denkmalschutz (German-specific filters)
CREATE INDEX IF NOT EXISTS idx_properties_new_german_special
  ON properties_new(german_kfw_standard, german_is_denkmalschutz, property_category)
  WHERE german_kfw_standard IS NOT NULL AND status = 'active';

-- USA MLS number (unique identifier for lookups)
CREATE INDEX IF NOT EXISTS idx_properties_new_usa_mls
  ON properties_new(usa_mls_number)
  WHERE usa_mls_number IS NOT NULL;

-- ============================================================
-- SECTION 10: JSONB INDEXES (Tier II and Tier III)
-- ============================================================

-- 10a. Location JSONB for flexible location queries
CREATE INDEX IF NOT EXISTS idx_properties_new_location_gin
  ON properties_new USING GIN (location);

-- 10b. Country-specific JSONB for flexible country field queries
CREATE INDEX IF NOT EXISTS idx_properties_new_country_specific_gin
  ON properties_new USING GIN (country_specific);

-- 10c. Portal metadata for portal-specific queries
CREATE INDEX IF NOT EXISTS idx_properties_new_portal_metadata_gin
  ON properties_new USING GIN (portal_metadata);

-- 10d. Portal features array (amenity searches in Tier III)
CREATE INDEX IF NOT EXISTS idx_properties_new_portal_features_gin
  ON properties_new USING GIN (portal_features);

-- 10e. Features array (standard amenity searches)
CREATE INDEX IF NOT EXISTS idx_properties_new_features_gin
  ON properties_new USING GIN (features);

-- ============================================================
-- SECTION 11: UNIQUE CONSTRAINT INDEXES
-- ============================================================

-- 11a. Enforce portal uniqueness at DB level (already in base table via UNIQUE constraint)
--      This comment documents that idx on (portal, portal_id, property_category) exists via constraint

-- 11b. Canonical property ID for deduplication (future)
CREATE INDEX IF NOT EXISTS idx_properties_new_canonical
  ON properties_new(canonical_property_id)
  WHERE canonical_property_id IS NOT NULL;

-- ============================================================
-- SECTION 12: PERFORMANCE OPTIMIZATION - COVERING INDEXES
-- ============================================================

-- 12a. Search result covering index (frequently accessed columns)
--      Enables index-only scans for search results without touching main table
CREATE INDEX IF NOT EXISTS idx_properties_new_search_covering
  ON properties_new(property_category, transaction_type, city, price, created_at DESC)
  INCLUDE (title, status, latitude, longitude)
  WHERE status = 'active';

-- 12b. Map view covering index (geo queries with basic property info)
CREATE INDEX IF NOT EXISTS idx_properties_new_map_covering
  ON properties_new(latitude, longitude)
  INCLUDE (property_category, price, title, status)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status = 'active';

-- ============================================================
-- COMPLETION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 015: Comprehensive indexes created for partitioned tables';
  RAISE NOTICE '📊 Index categories:';
  RAISE NOTICE '   - Common search: 7 indexes';
  RAISE NOTICE '   - Geo/spatial: 3 indexes (+ 1 PostGIS conditional)';
  RAISE NOTICE '   - Staleness/lifecycle: 4 indexes';
  RAISE NOTICE '   - Aggregation: 3 indexes';
  RAISE NOTICE '   - Apartment-specific: 5 indexes';
  RAISE NOTICE '   - House-specific: 4 indexes';
  RAISE NOTICE '   - Land-specific: 4 indexes';
  RAISE NOTICE '   - Commercial-specific: 4 indexes';
  RAISE NOTICE '   - Country-specific: 6 composite indexes';
  RAISE NOTICE '   - JSONB: 5 GIN indexes';
  RAISE NOTICE '   - Covering: 2 indexes (index-only scans)';
  RAISE NOTICE '📈 Total: 47 new indexes (+ 1 conditional PostGIS)';
  RAISE NOTICE '⚡ Features: Partition pruning, partial indexes, covering indexes';
  RAISE NOTICE '🎯 Performance: Index-only scans, reduced index size, optimal query plans';
END $$;

COMMIT;
