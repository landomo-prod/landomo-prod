/**
 * Map Clustering Queries
 *
 * Implements three clustering strategies for different zoom levels:
 * 1. Geohash clustering (zoom 1-14) - Fast, cache-friendly
 * 2. Grid clustering (zoom 15-16) - PostGIS-powered, accurate
 * 3. Individual properties (zoom 17+) - Direct query, no clustering
 */

import { Pool } from 'pg';
import { PropertyFilters, buildFilterClauses } from './filter-builder';

export type { PropertyFilters };

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Cluster {
  clusterId: string;
  count: number;
  centerLat: number;
  centerLon: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  categoryCounts?: Record<string, number>;
  bounds?: BoundingBox;
}

export interface PropertyPreview {
  id: string;
  title: string;
  price: number;
  currency: string;
  propertyCategory: string;
  transactionType?: string;
  latitude: number;
  longitude: number;
  thumbnailUrl?: string;
  bedrooms?: number;
  sqm?: number;
}

/**
 * Get geohash precision based on zoom level
 * Lower zoom (country view) = lower precision (larger cells)
 * Higher zoom (city view) = higher precision (smaller cells)
 */
export function getGeohashPrecision(zoom: number): number {
  if (zoom <= 4)  return 2;  // ~1250km cells (country/continent)
  if (zoom <= 7)  return 3;  // ~156km cells (region)
  if (zoom <= 9)  return 4;  // ~39km cells (metro area)
  if (zoom <= 11) return 5;  // ~5km cells (district)
  if (zoom <= 13) return 6;  // ~1.2km cells (neighbourhood)
  return 7;                   // ~150m cells (street block)
}

/**
 * Get grid size based on zoom level (in degrees)
 * For PostGIS ST_SnapToGrid clustering
 */
export function getGridSize(zoom: number): number {
  if (zoom === 15) return 0.003;   // ~330m cells
  if (zoom === 16) return 0.0015;  // ~165m cells
  if (zoom === 17) return 0.0008;  // ~88m cells
  return 0.0004;                    // ~44m cells (zoom 18+)
}

// ─── Tile Coordinate Utilities ────────────────────────────────────────────────
// Standard Web Mercator tile math (same as Google Maps / OSM / Mapbox)

/**
 * Convert tile coordinates (z, x, y) to a WGS84 bounding box.
 * Each tile uniquely maps to a fixed geographic area — perfect for caching.
 */
export function tileToBBox(z: number, x: number, y: number): BoundingBox {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return {
    west:  (x / Math.pow(2, z)) * 360 - 180,
    east:  ((x + 1) / Math.pow(2, z)) * 360 - 180,
    north: (Math.atan(Math.sinh(n)) * 180) / Math.PI,
    south: (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * (y + 1)) / Math.pow(2, z))) * 180) / Math.PI,
  };
}

/**
 * Convert lat/lon to tile coordinates at a given zoom.
 */
export function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  return { x, y };
}

// Filter clause building is now in filter-builder.ts

/**
 * Geohash Clustering Strategy (Zoom 1-14)
 * Uses PostGIS ST_GeoHash() computed on-the-fly — no stored geohash column needed.
 * Precision scales with zoom: low zoom = coarse cells, high zoom = fine cells.
 */
export async function getGeohashClusters(
  pool: Pool,
  bounds: BoundingBox,
  zoom: number,
  filters?: PropertyFilters,
  precisionDelta: number = 0,
  maxClusters: number = 80
): Promise<Cluster[]> {
  const precision = Math.max(1, getGeohashPrecision(zoom) + precisionDelta);
  const limit = maxClusters;
  // $1: precision, $2-$5: west,south,east,north (ST_MakeEnvelope) — filters start at $6
  const filterClauses = buildFilterClauses(filters, 6);

  const sql = `
    SELECT
      cluster_id,
      COUNT(*)::int AS count,
      AVG(latitude)::numeric(10,6)  AS center_lat,
      AVG(longitude)::numeric(10,6) AS center_lon,
      AVG(price)::numeric           AS avg_price,
      MIN(price)::numeric           AS min_price,
      MAX(price)::numeric           AS max_price,
      MIN(latitude)::numeric        AS min_lat,
      MAX(latitude)::numeric        AS max_lat,
      MIN(longitude)::numeric       AS min_lon,
      MAX(longitude)::numeric       AS max_lon,
      jsonb_object_agg(property_category, cat_count) FILTER (WHERE cat_count > 0) AS category_counts
    FROM (
      SELECT
        LEFT(
          ST_GeoHash(geom_point, $1),
          $1
        )                                                          AS cluster_id,
        latitude,
        longitude,
        price,
        property_category,
        COUNT(*) OVER (
          PARTITION BY
            LEFT(ST_GeoHash(geom_point, $1), $1),
            property_category
        )                                                          AS cat_count
      FROM properties
      WHERE
        geom_point IS NOT NULL
        AND status   = 'active'
        AND geom_point && ST_MakeEnvelope($2, $3, $4, $5, 4326)
        ${filterClauses.sql}
    ) sub
    GROUP BY cluster_id
    HAVING COUNT(*) >= 1
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  const params = [
    precision,
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
    ...filterClauses.params,
  ];

  const result = await pool.query(sql, params);

  return result.rows.map((row) => ({
    clusterId: row.cluster_id,
    count: row.count,
    centerLat: parseFloat(row.center_lat),
    centerLon: parseFloat(row.center_lon),
    avgPrice: parseFloat(row.avg_price) || 0,
    minPrice: parseFloat(row.min_price) || 0,
    maxPrice: parseFloat(row.max_price) || 0,
    categoryCounts: row.category_counts || {},
    bounds: {
      north: parseFloat(row.max_lat),
      south: parseFloat(row.min_lat),
      east:  parseFloat(row.max_lon),
      west:  parseFloat(row.min_lon),
    },
  }));
}

/**
 * Grid Clustering Strategy (Zoom 15-16)
 * PostGIS ST_SnapToGrid clustering — no pgcrypto needed, cluster ID derived from grid coords.
 */
export async function getGridClusters(
  pool: Pool,
  bounds: BoundingBox,
  zoom: number,
  filters?: PropertyFilters
): Promise<Cluster[]> {
  const gridSize = getGridSize(zoom);
  // $1: gridSize, $2-$5: west,south,east,north (ST_MakeEnvelope) — filters start at $6
  const filterClauses = buildFilterClauses(filters, 6);

  const sql = `
    SELECT
      cluster_id,
      COUNT(*)::int                                                    AS count,
      ST_Y(ST_Centroid(ST_Collect(geom)))::numeric(10,6)              AS center_lat,
      ST_X(ST_Centroid(ST_Collect(geom)))::numeric(10,6)              AS center_lon,
      AVG(price)::numeric                                              AS avg_price,
      MIN(price)::numeric                                              AS min_price,
      MAX(price)::numeric                                              AS max_price,
      ST_YMin(ST_Extent(geom))::numeric                               AS min_lat,
      ST_YMax(ST_Extent(geom))::numeric                               AS max_lat,
      ST_XMin(ST_Extent(geom))::numeric                               AS min_lon,
      ST_XMax(ST_Extent(geom))::numeric                               AS max_lon,
      jsonb_object_agg(property_category, cat_count) FILTER (WHERE cat_count > 0) AS category_counts
    FROM (
      SELECT
        'g:' || round(ST_X(ST_SnapToGrid(geom_point, $1))::numeric, 6) || ':' || round(ST_Y(ST_SnapToGrid(geom_point, $1))::numeric, 6) AS cluster_id,
        geom_point AS geom,
        price,
        property_category,
        COUNT(*) OVER (
          PARTITION BY
            ST_SnapToGrid(geom_point, $1),
            property_category
        ) AS cat_count
      FROM properties
      WHERE
        geom_point IS NOT NULL
        AND status   = 'active'
        AND geom_point && ST_MakeEnvelope($2, $3, $4, $5, 4326)
        ${filterClauses.sql}
    ) sub
    GROUP BY cluster_id
    HAVING COUNT(*) >= 1
    ORDER BY count DESC
    LIMIT 80
  `;

  const params = [
    gridSize,
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
    ...filterClauses.params,
  ];

  const result = await pool.query(sql, params);

  return result.rows.map((row) => ({
    clusterId: row.cluster_id,
    count: row.count,
    centerLat: parseFloat(row.center_lat),
    centerLon: parseFloat(row.center_lon),
    avgPrice: parseFloat(row.avg_price) || 0,
    minPrice: parseFloat(row.min_price) || 0,
    maxPrice: parseFloat(row.max_price) || 0,
    categoryCounts: row.category_counts || {},
    bounds: {
      north: parseFloat(row.max_lat),
      south: parseFloat(row.min_lat),
      east:  parseFloat(row.max_lon),
      west:  parseFloat(row.min_lon),
    },
  }));
}

/**
 * Individual Properties Strategy (Zoom 17+)
 * Direct property query with no clustering, for street-level map views
 */
export async function getIndividualProperties(
  pool: Pool,
  bounds: BoundingBox,
  filters?: PropertyFilters
): Promise<PropertyPreview[]> {
  // $1-$4: west,south,east,north (ST_MakeEnvelope) — filters start at $5
  const filterClauses = buildFilterClauses(filters, 5);

  const sql = `
    SELECT
      id,
      title,
      price,
      currency,
      property_category,
      transaction_type,
      latitude,
      longitude,
      images,
      -- Category-specific bedrooms
      CASE property_category
        WHEN 'apartment' THEN apt_bedrooms
        WHEN 'house' THEN house_bedrooms
        ELSE NULL
      END as bedrooms,
      -- Category-specific sqm
      CASE property_category
        WHEN 'apartment' THEN apt_sqm
        WHEN 'house' THEN house_sqm_living
        WHEN 'land' THEN land_area_plot_sqm
        WHEN 'commercial' THEN comm_floor_area
      END as sqm
    FROM properties
    WHERE
      geom_point IS NOT NULL
      AND status = 'active'
      AND geom_point && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      ${filterClauses.sql}
    ORDER BY price DESC
    LIMIT 100
  `;

  const params = [
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
    ...filterClauses.params,
  ];

  const result = await pool.query(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    currency: row.currency,
    propertyCategory: row.property_category,
    transactionType: row.transaction_type,
    latitude: parseFloat(row.latitude),
    longitude: parseFloat(row.longitude),
    thumbnailUrl: row.images?.[0],
    bedrooms: row.bedrooms,
    sqm: row.sqm ? parseFloat(row.sqm) : undefined,
  }));
}

/**
 * DBSCAN Clustering Strategy (Supercluster algorithm in PostGIS)
 *
 * Uses ST_ClusterDBSCAN with an epsilon derived from Supercluster's pixel-radius formula:
 *   epsilon_meters = 60px * 40,075,016.686m / (512px * 2^zoom) = 4,696,291 / 2^zoom
 *
 * Operates in EPSG:3857 (Web Mercator) so the epsilon is visually uniform across
 * all latitudes — identical to Supercluster's normalized Mercator space.
 *
 * minpoints=2: isolated points get cluster_id=NULL and are returned as individual markers,
 * matching Supercluster's default behavior exactly.
 */
export async function getDBSCANClusters(
  pool: Pool,
  bounds: BoundingBox,
  zoom: number,
  filters?: PropertyFilters,
  epsScale: number = 1,
  maxClusters: number = 80
): Promise<{ clusters: Cluster[]; properties: PropertyPreview[] }> {
  // $1-$4: west,south,east,north, $5: zoom, $6: eps_scale — filters start at $7
  const filterClauses = buildFilterClauses(filters, 7);

  const sql = `
    WITH filtered AS (
      SELECT
        id, price, currency, property_category, transaction_type, latitude, longitude, geom_point,
        images, title, apt_bedrooms, house_bedrooms,
        apt_sqm, house_sqm_living, land_area_plot_sqm, comm_floor_area
      FROM properties
      WHERE
        geom_point IS NOT NULL
        AND status = 'active'
        AND geom_point && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        ${filterClauses.sql}
    ),
    clustered AS (
      SELECT
        *,
        ST_ClusterDBSCAN(
          ST_Transform(geom_point, 3857),
          eps       := (4696291.0 / power(2, $5::float8)) * $6::float8,
          minpoints := 2
        ) OVER () AS cluster_id
      FROM filtered
    ),
    clusters_agg AS (
      SELECT
        'cluster'::text AS feature_type,
        cluster_id::text AS id,
        COUNT(*)::int AS count,
        AVG(latitude)::numeric(10,6) AS center_lat,
        AVG(longitude)::numeric(10,6) AS center_lon,
        AVG(price)::numeric AS avg_price,
        MIN(price)::numeric AS min_price,
        MAX(price)::numeric AS max_price,
        MIN(latitude)::numeric AS min_lat,
        MAX(latitude)::numeric AS max_lat,
        MIN(longitude)::numeric AS min_lon,
        MAX(longitude)::numeric AS max_lon,
        jsonb_object_agg(property_category, cat_count)
          FILTER (WHERE cat_count > 0) AS category_counts,
        NULL::text AS title, NULL::text AS currency,
        NULL::text AS prop_category, NULL::text AS txn_type, NULL::numeric AS point_price,
        NULL::int AS bedrooms, NULL::numeric AS sqm, NULL::jsonb AS images
      FROM (
        SELECT cluster_id, latitude, longitude, price, property_category,
          COUNT(*) OVER (PARTITION BY cluster_id, property_category) AS cat_count
        FROM clustered WHERE cluster_id IS NOT NULL
      ) sub
      GROUP BY cluster_id
    ),
    individuals AS (
      SELECT
        'point'::text AS feature_type,
        id::text AS id,
        1::int AS count,
        latitude::numeric(10,6) AS center_lat,
        longitude::numeric(10,6) AS center_lon,
        price::numeric AS avg_price,
        price::numeric AS min_price,
        price::numeric AS max_price,
        latitude::numeric AS min_lat, latitude::numeric AS max_lat,
        longitude::numeric AS min_lon, longitude::numeric AS max_lon,
        NULL::jsonb AS category_counts,
        title::text, currency::text,
        property_category::text AS prop_category,
        transaction_type::text AS txn_type,
        price::numeric AS point_price,
        CASE property_category
          WHEN 'apartment' THEN apt_bedrooms
          WHEN 'house' THEN house_bedrooms ELSE NULL
        END AS bedrooms,
        CASE property_category
          WHEN 'apartment' THEN apt_sqm
          WHEN 'house' THEN house_sqm_living
          WHEN 'land' THEN land_area_plot_sqm
          WHEN 'commercial' THEN comm_floor_area
        END AS sqm,
        images::jsonb
      FROM clustered WHERE cluster_id IS NULL
    )
    SELECT * FROM clusters_agg
    UNION ALL
    SELECT * FROM individuals
    ORDER BY count DESC
    LIMIT ${Math.min(maxClusters * 6, 500)}
  `;

  const params = [
    bounds.west, bounds.south, bounds.east, bounds.north,
    zoom,
    epsScale,
    ...filterClauses.params,
  ];

  const result = await pool.query(sql, params);

  const clusters: Cluster[] = [];
  const properties: PropertyPreview[] = [];

  for (const row of result.rows) {
    if (row.feature_type === 'cluster') {
      clusters.push({
        clusterId:      row.id,
        count:          row.count,
        centerLat:      parseFloat(row.center_lat),
        centerLon:      parseFloat(row.center_lon),
        avgPrice:       parseFloat(row.avg_price) || 0,
        minPrice:       parseFloat(row.min_price) || 0,
        maxPrice:       parseFloat(row.max_price) || 0,
        categoryCounts: row.category_counts || {},
        bounds: {
          north: parseFloat(row.max_lat),
          south: parseFloat(row.min_lat),
          east:  parseFloat(row.max_lon),
          west:  parseFloat(row.min_lon),
        },
      });
    } else {
      properties.push({
        id:               row.id,
        title:            row.title,
        price:            parseFloat(row.point_price),
        currency:         row.currency,
        propertyCategory: row.prop_category,
        transactionType:  row.txn_type,
        latitude:         parseFloat(row.center_lat),
        longitude:        parseFloat(row.center_lon),
        thumbnailUrl:     row.images?.[0],
        bedrooms:         row.bedrooms ?? undefined,
        sqm:              row.sqm ? parseFloat(row.sqm) : undefined,
      });
    }
  }

  return { clusters, properties };
}

// ─── Viewport-Proportional Clustering ────────────────────────────────────────
// Reference: 400×900 viewport = 360,000 px² → ~10 clusters
// Scale linearly: maxClusters = viewportArea / 36,000, clamped [5, 80]
// DBSCAN epsilon scales inversely with sqrt(viewportArea) so smaller viewports
// get a larger merge radius → fewer, bigger clusters.

const REFERENCE_AREA = 1920 * 1080; // "standard" viewport for default params
const PX_PER_CLUSTER = 36000;       // 360,000 px² / 10 clusters

function computeViewportParams(viewportWidth?: number, viewportHeight?: number) {
  if (!viewportWidth || !viewportHeight || viewportWidth <= 0 || viewportHeight <= 0) {
    return { maxClusters: 80, epsScale: 1, precisionDelta: 0 };
  }
  const area = viewportWidth * viewportHeight;
  const maxClusters = Math.max(5, Math.min(80, Math.round(area / PX_PER_CLUSTER)));
  // Scale DBSCAN eps: larger scale → bigger merge radius → fewer clusters
  const epsScale = Math.sqrt(REFERENCE_AREA / area);
  // Reduce geohash precision by 1 for small viewports (< 20 target clusters)
  const precisionDelta = maxClusters < 20 ? -1 : 0;
  return { maxClusters, epsScale, precisionDelta };
}

/**
 * Main clustering function - selects strategy based on zoom level
 *
 * Zoom 1-9:   Geohash (fast, coarse, cache-friendly for wide views)
 * Zoom 10-16: DBSCAN (Supercluster-equivalent radius clustering in PostGIS)
 * Zoom 17+:   Individual pins if sparse, DBSCAN fallback if dense
 *
 * viewportWidth/viewportHeight: pixel dimensions of the map container.
 * Cluster density scales proportionally: ~10 clusters for 400×900px,
 * ~30 for 1200×900px, ~58 for 1920×1080px.
 */
export async function getClusters(
  pool: Pool,
  bounds: BoundingBox,
  zoom: number,
  filters?: PropertyFilters,
  viewportWidth?: number,
  viewportHeight?: number,
): Promise<{ clusters?: Cluster[]; properties?: PropertyPreview[]; strategy: string }> {
  const vp = computeViewportParams(viewportWidth, viewportHeight);
  const MAX_INDIVIDUAL_PINS = Math.min(vp.maxClusters * 2, 100);

  if (zoom <= 13) {
    const clusters = await getGeohashClusters(pool, bounds, zoom, filters, vp.precisionDelta, vp.maxClusters);
    return { clusters, strategy: 'geohash' };
  } else if (zoom <= 16) {
    const result = await getDBSCANClusters(pool, bounds, zoom, filters, vp.epsScale, vp.maxClusters);
    return {
      clusters: result.clusters.length > 0 ? result.clusters : undefined,
      properties: result.properties.length > 0 ? result.properties : undefined,
      strategy: 'dbscan',
    };
  } else {
    const properties = await getIndividualProperties(pool, bounds, filters);
    if (properties.length <= MAX_INDIVIDUAL_PINS) {
      return { properties, strategy: 'individual' };
    }
    const result = await getDBSCANClusters(pool, bounds, zoom, filters, vp.epsScale, vp.maxClusters);
    return {
      clusters: result.clusters.length > 0 ? result.clusters : undefined,
      properties: result.properties.length > 0 ? result.properties : undefined,
      strategy: 'dbscan',
    };
  }
}
