/**
 * Boundary Resolver
 *
 * Resolves boundary UUIDs to GeoJSON geometry strings for use in ST_Contains queries.
 * Uses an in-process cache (boundaries don't change during a process lifetime).
 */

import { Pool } from 'pg';

let geocodingPool: Pool | null = null;

function getGeocodingPool(): Pool {
  if (!geocodingPool) {
    geocodingPool = new Pool({
      host: process.env.GEOCODING_DB_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.GEOCODING_DB_PORT || process.env.DB_PORT || '5432', 10),
      user: process.env.GEOCODING_DB_USER || process.env.DB_USER || 'landomo',
      password: process.env.GEOCODING_DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.GEOCODING_DB_NAME || 'landomo_geocoding',
      max: 5,
    });
  }
  return geocodingPool;
}

const geometryCache = new Map<string, string>();

/**
 * Resolve a boundary UUID to its simplified GeoJSON geometry string.
 * Returns null if the boundary doesn't exist.
 */
export async function resolveBoundaryGeometry(boundaryId: string): Promise<string | null> {
  const cached = geometryCache.get(boundaryId);
  if (cached) {
    return cached;
  }

  const pool = getGeocodingPool();
  const result = await pool.query(
    'SELECT ST_AsGeoJSON(COALESCE(geometry_simplified, geometry_full)) AS geojson FROM boundaries WHERE id = $1',
    [boundaryId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const geojson = result.rows[0].geojson;
  geometryCache.set(boundaryId, geojson);
  return geojson;
}
