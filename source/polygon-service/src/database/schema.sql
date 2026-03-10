-- ============================================================
-- Polygon Service Schema
-- Administrative boundaries from OpenStreetMap
-- ============================================================

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Administrative boundaries (areas)
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- OSM identifiers
  relation_id BIGINT NOT NULL UNIQUE,

  -- Geometry (PostGIS)
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,

  -- Administrative info
  name VARCHAR(255) NOT NULL,
  admin_level INTEGER,

  -- OSM tags (JSONB for flexible querying)
  tags JSONB,

  -- Name variations for i18n
  names JSONB,

  -- Hierarchy
  parent_relation_id BIGINT,
  sub_relation_ids BIGINT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Spatial index on geometry
  CONSTRAINT valid_geometry CHECK (ST_IsValid(geom))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_areas_relation_id ON areas(relation_id);
CREATE INDEX IF NOT EXISTS idx_areas_admin_level ON areas(admin_level);
CREATE INDEX IF NOT EXISTS idx_areas_parent_relation_id ON areas(parent_relation_id);
CREATE INDEX IF NOT EXISTS idx_areas_name ON areas(name);
CREATE INDEX IF NOT EXISTS idx_areas_updated_at ON areas(updated_at);

-- GiST spatial index for geometric queries
CREATE INDEX IF NOT EXISTS idx_areas_geom ON areas USING GIST(geom);

-- GIN index for JSONB tags
CREATE INDEX IF NOT EXISTS idx_areas_tags ON areas USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_areas_names ON areas USING GIN(names);

-- Full-text search on name
CREATE INDEX IF NOT EXISTS idx_areas_name_trgm ON areas USING GIN(name gin_trgm_ops);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_areas_updated_at ON areas;
CREATE TRIGGER trigger_update_areas_updated_at
  BEFORE UPDATE ON areas
  FOR EACH ROW
  EXECUTE FUNCTION update_areas_updated_at();

-- View for simplified area lookups
CREATE OR REPLACE VIEW areas_simple AS
SELECT
  id,
  relation_id,
  name,
  admin_level,
  parent_relation_id,
  ST_AsGeoJSON(geom)::jsonb as geometry,
  tags,
  names,
  created_at,
  updated_at
FROM areas;

-- Comment on table
COMMENT ON TABLE areas IS 'Administrative boundaries from OpenStreetMap Overpass API';
COMMENT ON COLUMN areas.relation_id IS 'OSM relation ID';
COMMENT ON COLUMN areas.geom IS 'PostGIS MULTIPOLYGON geometry (EPSG:4326)';
COMMENT ON COLUMN areas.admin_level IS 'OSM admin_level (2=country, 3=state, 4=region, 6=district, 8=municipality, etc.)';
COMMENT ON COLUMN areas.parent_relation_id IS 'OSM relation ID of parent area (determined by admin_level hierarchy)';
COMMENT ON COLUMN areas.sub_relation_ids IS 'OSM relation IDs of child areas';
