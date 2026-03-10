-- ============================================================
-- Migration 010: Administrative Boundaries with PostGIS
-- Adds support for multi-level polygon storage with spatial indexing
-- Date: 2026-02-08
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

-- Enable PostGIS for spatial data types and functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- BOUNDARIES TABLE
-- ============================================================

-- Administrative boundaries with multi-level simplification
CREATE TABLE IF NOT EXISTS boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- OSM source tracking
  osm_relation_id BIGINT NOT NULL UNIQUE,       -- OSM relation ID
  osm_type VARCHAR(20) NOT NULL,                -- boundary, administrative, postal_code
  admin_level INTEGER,                          -- 2=country, 4=state/region, 6=county, 8=city, 9=district, 10=neighborhood

  -- Hierarchy relationships
  parent_id UUID REFERENCES boundaries(id) ON DELETE SET NULL,
  country_code VARCHAR(3) NOT NULL,             -- ISO 3166-1 alpha-3 (CZE, SVK, HUN, etc.)

  -- Primary name (default language for the country)
  name VARCHAR(255) NOT NULL,
  name_normalized VARCHAR(255),                 -- Lowercase, accent-stripped for matching

  -- Multi-language names (JSONB for flexibility)
  -- Format: {"en": "Prague", "cs": "Praha", "de": "Prag"}
  names JSONB DEFAULT '{}'::jsonb,

  -- Geometry with three levels of detail
  -- Full resolution geometry (original OSM data)
  geometry_full GEOMETRY(GEOMETRY, 4326),

  -- Simplified geometry (tolerance ~100m, for zoom levels 8-12)
  geometry_simplified GEOMETRY(GEOMETRY, 4326),

  -- Simple geometry (tolerance ~1km, for zoom levels 1-7, country/region views)
  geometry_simple GEOMETRY(MULTIPOLYGON, 4326),

  -- Precomputed bounding box for fast filtering
  bbox_min_lat NUMERIC(10, 7),
  bbox_min_lon NUMERIC(10, 7),
  bbox_max_lat NUMERIC(10, 7),
  bbox_max_lon NUMERIC(10, 7),

  -- Precomputed centroid for labels and point queries
  centroid_lat NUMERIC(10, 7),
  centroid_lon NUMERIC(10, 7),

  -- Area metrics (square kilometers)
  area_sqkm NUMERIC(12, 4),

  -- OSM tags (all key-value pairs from OSM)
  -- Useful tags: name:*, population, wikipedia, wikidata, postal_code, etc.
  osm_tags JSONB DEFAULT '{}'::jsonb,

  -- Postal code association (for postal_code boundaries)
  postal_code VARCHAR(20),

  -- Administrative type classification
  -- Examples: country, state, region, province, city, municipality, district, neighborhood
  boundary_type VARCHAR(50) NOT NULL,

  -- Data quality and status
  is_verified BOOLEAN DEFAULT FALSE,            -- Manual verification flag
  quality_score INTEGER DEFAULT 50,             -- 0-100, based on completeness and accuracy
  status VARCHAR(20) DEFAULT 'active',          -- active, deprecated, merged

  -- Metadata
  source VARCHAR(100) DEFAULT 'openstreetmap',  -- Source of geometry data
  last_updated_osm TIMESTAMPTZ,                 -- Last update timestamp from OSM
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_admin_level CHECK (admin_level BETWEEN 1 AND 12 OR admin_level IS NULL),
  CONSTRAINT valid_status CHECK (status IN ('active', 'deprecated', 'merged')),
  CONSTRAINT valid_quality_score CHECK (quality_score BETWEEN 0 AND 100),
  CONSTRAINT bbox_consistency CHECK (
    (bbox_min_lat IS NULL AND bbox_min_lon IS NULL AND bbox_max_lat IS NULL AND bbox_max_lon IS NULL) OR
    (bbox_min_lat IS NOT NULL AND bbox_min_lon IS NOT NULL AND bbox_max_lat IS NOT NULL AND bbox_max_lon IS NOT NULL AND
     bbox_min_lat <= bbox_max_lat AND bbox_min_lon <= bbox_max_lon)
  )
);

-- ============================================================
-- BOUNDARY RELATIONSHIPS TABLE
-- ============================================================

-- Track complex many-to-many relationships between boundaries
-- Examples: cities spanning multiple regions, overlapping postal codes
CREATE TABLE IF NOT EXISTS boundary_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_boundary_id UUID NOT NULL REFERENCES boundaries(id) ON DELETE CASCADE,
  child_boundary_id UUID NOT NULL REFERENCES boundaries(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,       -- contains, overlaps, adjacent, postal_coverage
  overlap_percentage NUMERIC(5, 2),             -- Percentage of child covered by parent (0-100)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_relationship UNIQUE (parent_boundary_id, child_boundary_id, relationship_type),
  CONSTRAINT no_self_relationship CHECK (parent_boundary_id <> child_boundary_id),
  CONSTRAINT valid_overlap CHECK (overlap_percentage IS NULL OR (overlap_percentage >= 0 AND overlap_percentage <= 100))
);

-- ============================================================
-- BOUNDARY ALIASES TABLE
-- ============================================================

-- Alternative names and historical names for boundaries
CREATE TABLE IF NOT EXISTS boundary_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boundary_id UUID NOT NULL REFERENCES boundaries(id) ON DELETE CASCADE,
  alias VARCHAR(255) NOT NULL,
  alias_normalized VARCHAR(255) NOT NULL,       -- Lowercase, accent-stripped
  alias_type VARCHAR(50) NOT NULL,              -- official, historical, colloquial, abbreviation
  language VARCHAR(10),                         -- ISO 639-1 language code
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_boundary_alias UNIQUE (boundary_id, alias, alias_type),
  CONSTRAINT valid_alias_type CHECK (alias_type IN ('official', 'historical', 'colloquial', 'abbreviation', 'postal'))
);

-- ============================================================
-- POSTAL CODE BOUNDARIES TABLE
-- ============================================================

-- Dedicated table for postal code boundaries (often complex and overlapping)
CREATE TABLE IF NOT EXISTS postal_code_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postal_code VARCHAR(20) NOT NULL,
  country_code VARCHAR(3) NOT NULL,

  -- Associated administrative boundary (city/district)
  primary_boundary_id UUID REFERENCES boundaries(id) ON DELETE SET NULL,

  -- Geometry (often more detailed than administrative boundaries)
  geometry GEOMETRY(MULTIPOLYGON, 4326),

  -- Bounding box
  bbox_min_lat NUMERIC(10, 7),
  bbox_min_lon NUMERIC(10, 7),
  bbox_max_lat NUMERIC(10, 7),
  bbox_max_lon NUMERIC(10, 7),

  -- Centroid for point queries
  centroid_lat NUMERIC(10, 7),
  centroid_lon NUMERIC(10, 7),

  -- Population estimate (useful for market sizing)
  population_estimate INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_postal_code UNIQUE (postal_code, country_code)
);

-- ============================================================
-- PROPERTY-BOUNDARY ASSOCIATIONS
-- ============================================================

-- Link properties to their containing boundaries for fast queries
CREATE TABLE IF NOT EXISTS property_boundary_cache (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  boundary_id UUID NOT NULL REFERENCES boundaries(id) ON DELETE CASCADE,
  boundary_type VARCHAR(50) NOT NULL,           -- country, region, city, district, neighborhood, postal_code
  confidence VARCHAR(20) DEFAULT 'high',        -- high, medium, low (based on point-in-polygon vs. address matching)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (property_id, boundary_id),
  CONSTRAINT valid_confidence CHECK (confidence IN ('high', 'medium', 'low'))
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Core lookup indexes
CREATE INDEX IF NOT EXISTS idx_boundaries_osm_relation ON boundaries(osm_relation_id);
CREATE INDEX IF NOT EXISTS idx_boundaries_country ON boundaries(country_code);
CREATE INDEX IF NOT EXISTS idx_boundaries_parent ON boundaries(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boundaries_admin_level ON boundaries(admin_level) WHERE admin_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boundaries_type ON boundaries(boundary_type);
CREATE INDEX IF NOT EXISTS idx_boundaries_status ON boundaries(status);

-- Name search indexes (for autocomplete and fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_boundaries_name ON boundaries(name);
CREATE INDEX IF NOT EXISTS idx_boundaries_name_normalized ON boundaries(name_normalized) WHERE name_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boundaries_names_gin ON boundaries USING GIN(names);
CREATE INDEX IF NOT EXISTS idx_boundaries_osm_tags_gin ON boundaries USING GIN(osm_tags);
CREATE INDEX IF NOT EXISTS idx_boundaries_name_trgm ON boundaries USING GIN(name gin_trgm_ops);

-- Composite index for common queries (country + type + name)
CREATE INDEX IF NOT EXISTS idx_boundaries_country_type_name
  ON boundaries(country_code, boundary_type, name)
  WHERE status = 'active';

-- Bounding box index for fast bbox filtering before spatial queries
CREATE INDEX IF NOT EXISTS idx_boundaries_bbox
  ON boundaries(bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon)
  WHERE bbox_min_lat IS NOT NULL;

-- Centroid index for nearest-boundary queries
CREATE INDEX IF NOT EXISTS idx_boundaries_centroid
  ON boundaries(centroid_lat, centroid_lon)
  WHERE centroid_lat IS NOT NULL;

-- Postal code index
CREATE INDEX IF NOT EXISTS idx_boundaries_postal_code
  ON boundaries(postal_code)
  WHERE postal_code IS NOT NULL;

-- Quality and verification indexes
CREATE INDEX IF NOT EXISTS idx_boundaries_quality
  ON boundaries(quality_score DESC)
  WHERE status = 'active';

-- Spatial indexes (GIST) for geometry columns
-- Full resolution geometry
CREATE INDEX IF NOT EXISTS idx_boundaries_geometry_full
  ON boundaries USING GIST(geometry_full)
  WHERE geometry_full IS NOT NULL;

-- Simplified geometry (most commonly used for map rendering)
CREATE INDEX IF NOT EXISTS idx_boundaries_geometry_simplified
  ON boundaries USING GIST(geometry_simplified)
  WHERE geometry_simplified IS NOT NULL;

-- Simple geometry (for country/region overview)
CREATE INDEX IF NOT EXISTS idx_boundaries_geometry_simple
  ON boundaries USING GIST(geometry_simple)
  WHERE geometry_simple IS NOT NULL;

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_boundary_relationships_parent
  ON boundary_relationships(parent_boundary_id);
CREATE INDEX IF NOT EXISTS idx_boundary_relationships_child
  ON boundary_relationships(child_boundary_id);
CREATE INDEX IF NOT EXISTS idx_boundary_relationships_type
  ON boundary_relationships(relationship_type);

-- Alias indexes
CREATE INDEX IF NOT EXISTS idx_boundary_aliases_boundary
  ON boundary_aliases(boundary_id);
CREATE INDEX IF NOT EXISTS idx_boundary_aliases_normalized
  ON boundary_aliases(alias_normalized);
CREATE INDEX IF NOT EXISTS idx_boundary_aliases_language
  ON boundary_aliases(language)
  WHERE language IS NOT NULL;

-- Postal code boundary indexes
CREATE INDEX IF NOT EXISTS idx_postal_boundaries_code
  ON postal_code_boundaries(postal_code);
CREATE INDEX IF NOT EXISTS idx_postal_boundaries_country
  ON postal_code_boundaries(country_code);
CREATE INDEX IF NOT EXISTS idx_postal_boundaries_composite
  ON postal_code_boundaries(postal_code, country_code);
CREATE INDEX IF NOT EXISTS idx_postal_boundaries_primary
  ON postal_code_boundaries(primary_boundary_id)
  WHERE primary_boundary_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_postal_boundaries_geometry
  ON postal_code_boundaries USING GIST(geometry)
  WHERE geometry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_postal_boundaries_bbox
  ON postal_code_boundaries(bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon)
  WHERE bbox_min_lat IS NOT NULL;

-- Property-boundary cache indexes
CREATE INDEX IF NOT EXISTS idx_property_boundary_cache_property
  ON property_boundary_cache(property_id);
CREATE INDEX IF NOT EXISTS idx_property_boundary_cache_boundary
  ON property_boundary_cache(boundary_id);
CREATE INDEX IF NOT EXISTS idx_property_boundary_cache_type
  ON property_boundary_cache(boundary_type);
CREATE INDEX IF NOT EXISTS idx_property_boundary_cache_confidence
  ON property_boundary_cache(property_id, boundary_type, confidence);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to normalize text (lowercase, remove accents)
CREATE OR REPLACE FUNCTION normalize_text(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(unaccent(text_input));
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback if unaccent extension not available
    RETURN lower(text_input);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find boundary containing a point
CREATE OR REPLACE FUNCTION find_boundary_by_point(
  lat NUMERIC,
  lon NUMERIC,
  boundary_type_filter VARCHAR DEFAULT NULL,
  country_filter VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  boundary_id UUID,
  boundary_name VARCHAR,
  boundary_type VARCHAR,
  admin_level INTEGER,
  country_code VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.boundary_type,
    b.admin_level,
    b.country_code
  FROM boundaries b
  WHERE
    b.status = 'active'
    AND b.geometry_simplified IS NOT NULL
    AND ST_Contains(
      b.geometry_simplified,
      ST_SetSRID(ST_MakePoint(lon, lat), 4326)
    )
    AND (boundary_type_filter IS NULL OR b.boundary_type = boundary_type_filter)
    AND (country_filter IS NULL OR b.country_code = country_filter)
  ORDER BY
    b.admin_level DESC NULLS LAST,  -- More specific (higher admin_level) first
    b.area_sqkm ASC NULLS LAST;     -- Smaller area first (more specific)
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get hierarchy path for a boundary
CREATE OR REPLACE FUNCTION get_boundary_hierarchy(boundary_uuid UUID)
RETURNS TABLE (
  level INTEGER,
  boundary_id UUID,
  boundary_name VARCHAR,
  boundary_type VARCHAR,
  admin_level INTEGER
) AS $$
WITH RECURSIVE hierarchy AS (
  -- Base case: start with the given boundary
  SELECT
    0 AS level,
    b.id,
    b.name,
    b.boundary_type,
    b.admin_level,
    b.parent_id
  FROM boundaries b
  WHERE b.id = boundary_uuid

  UNION ALL

  -- Recursive case: get parent
  SELECT
    h.level + 1,
    b.id,
    b.name,
    b.boundary_type,
    b.admin_level,
    b.parent_id
  FROM boundaries b
  INNER JOIN hierarchy h ON b.id = h.parent_id
  WHERE h.level < 10  -- Prevent infinite loops
)
SELECT
  level,
  id AS boundary_id,
  name AS boundary_name,
  boundary_type,
  admin_level
FROM hierarchy
ORDER BY level DESC;  -- Top-down (country -> region -> city -> district)
$$ LANGUAGE sql STABLE;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_boundaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_boundaries_updated_at
  BEFORE UPDATE ON boundaries
  FOR EACH ROW
  EXECUTE FUNCTION update_boundaries_updated_at();

CREATE TRIGGER trigger_postal_boundaries_updated_at
  BEFORE UPDATE ON postal_code_boundaries
  FOR EACH ROW
  EXECUTE FUNCTION update_boundaries_updated_at();

CREATE TRIGGER trigger_property_boundary_cache_updated_at
  BEFORE UPDATE ON property_boundary_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_boundaries_updated_at();

-- Auto-populate normalized names
CREATE OR REPLACE FUNCTION populate_normalized_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name_normalized = normalize_text(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_boundaries_normalize_name
  BEFORE INSERT OR UPDATE OF name ON boundaries
  FOR EACH ROW
  EXECUTE FUNCTION populate_normalized_name();

-- Auto-populate normalized alias
CREATE OR REPLACE FUNCTION populate_normalized_alias()
RETURNS TRIGGER AS $$
BEGIN
  NEW.alias_normalized = normalize_text(NEW.alias);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_boundary_aliases_normalize
  BEFORE INSERT OR UPDATE OF alias ON boundary_aliases
  FOR EACH ROW
  EXECUTE FUNCTION populate_normalized_alias();

-- ============================================================
-- COMPLETION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 010: Boundaries schema created successfully';
  RAISE NOTICE 'PostGIS extension enabled';
  RAISE NOTICE 'Tables: boundaries, boundary_relationships, boundary_aliases, postal_code_boundaries, property_boundary_cache';
  RAISE NOTICE 'Spatial indexes created for multi-level geometries';
  RAISE NOTICE 'Helper functions: normalize_text, find_boundary_by_point, get_boundary_hierarchy';
END $$;
