/**
 * Map Tile Routes
 *
 * Google Maps-style tile-based clustering:
 *
 *   GET  /api/v1/map/tiles/:z/:x/:y          — cluster tile (cacheable, deterministic)
 *   POST /api/v1/map/clusters                  — bbox + zoom (flexible, for non-tile clients)
 *
 * Tile coordinates follow the standard Web Mercator scheme used by all major map libraries
 * (Google Maps, Mapbox, Leaflet, Apple Maps). Each (z, x, y) triplet maps to a fixed
 * geographic area, giving us a near-100% cache hit rate for repeated map interactions.
 *
 * Strategy by zoom:
 *   z ≤ 14  →  geohash clustering  (country → neighborhood scale, PostGIS ST_GeoHash)
 *   z 15-16 →  grid clustering     (block scale, PostGIS ST_SnapToGrid)
 *   z ≥ 17  →  individual pins     (street level, max 1000 properties)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getClusters,
  tileToBBox,
  BoundingBox,
  PropertyFilters,
} from '../database/cluster-queries';
import { getCountryPool } from '../database/multi-db-manager';
import { cacheGet, cacheSet, generateCacheKey } from '../cache/redis-manager';
import { routeLog } from '../logger';

// Tile cluster cache TTL — tiles change slowly, 5 min is safe
const TILE_CACHE_TTL = 300;

// Single-flight: deduplicate concurrent identical tile requests on cache miss
const inFlightTiles = new Map<string, Promise<any>>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFilters(raw: Record<string, any> = {}): PropertyFilters {
  const f: PropertyFilters = {};
  if (raw.property_category) {
    f.propertyCategory = Array.isArray(raw.property_category)
      ? raw.property_category
      : [raw.property_category];
  }
  if (raw.property_type)             f.propertyType    = raw.property_type;
  if (raw.transaction_type)         f.transactionType = raw.transaction_type;
  if (raw.price_min !== undefined)   f.priceMin        = Number(raw.price_min);
  if (raw.price_max !== undefined)   f.priceMax        = Number(raw.price_max);
  if (raw.bedrooms_min !== undefined) f.bedroomsMin    = Number(raw.bedrooms_min);
  if (raw.bedrooms_max !== undefined) f.bedroomsMax    = Number(raw.bedrooms_max);
  if (raw.sqm_min !== undefined)     f.sqmMin          = Number(raw.sqm_min);
  if (raw.sqm_max !== undefined)     f.sqmMax          = Number(raw.sqm_max);
  if (raw.has_parking !== undefined)  f.hasParking      = raw.has_parking === true || raw.has_parking === 'true';
  if (raw.has_elevator !== undefined) f.hasElevator     = raw.has_elevator === true || raw.has_elevator === 'true';
  if (raw.has_garden !== undefined)   f.hasGarden       = raw.has_garden === true || raw.has_garden === 'true';
  return f;
}

async function executeClusters(
  country: string,
  zoom: number,
  bounds: BoundingBox,
  filters: PropertyFilters,
  cacheKey: string,
  viewportWidth?: number,
  viewportHeight?: number
) {
  // Check Redis cache first
  const cached = await cacheGet<any>(cacheKey);
  if (cached) return { ...cached, cached: true };

  // Single-flight: concurrent identical cache-miss requests share one DB query
  if (inFlightTiles.has(cacheKey)) {
    const result = await inFlightTiles.get(cacheKey)!;
    return { ...result, cached: true };
  }

  const computePromise = _computeClusters(country, zoom, bounds, filters, cacheKey, viewportWidth, viewportHeight)
    .finally(() => inFlightTiles.delete(cacheKey));
  inFlightTiles.set(cacheKey, computePromise);
  return computePromise;
}

async function _computeClusters(
  country: string,
  zoom: number,
  bounds: BoundingBox,
  filters: PropertyFilters,
  cacheKey: string,
  viewportWidth?: number,
  viewportHeight?: number
) {
  const startTime = Date.now();
  const pool = getCountryPool(country);
  const result = await getClusters(pool, bounds, zoom, filters, viewportWidth, viewportHeight);

  const response = {
    strategy: result.strategy,
    zoom,
    bounds,
    clusters:    result.clusters,
    properties:  result.properties,
    total:       (result.clusters?.reduce((s, c) => s + c.count, 0) ?? 0)
                 + (result.properties?.length ?? 0),
    query_time_ms: Date.now() - startTime,
    cached: false,
  };

  // Cache result (fire and forget)
  cacheSet(cacheKey, response, TILE_CACHE_TTL).catch(() => {});

  return response;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function mapRoutes(fastify: FastifyInstance) {

  /**
   * GET /api/v1/map/tiles/:z/:x/:y
   *
   * Standard slippy-map tile endpoint. Tile coordinates (z/x/y) map to a fixed
   * bounding box — identical to how Google Maps / Mapbox / Leaflet request tiles.
   *
   * Query params:
   *   country            (required) — e.g. "czech"
   *   property_category  (optional) — apartment | house | land | commercial
   *   transaction_type   (optional) — sale | rent
   *   price_min / price_max
   *   bedrooms_min / bedrooms_max
   *   has_parking / has_elevator / has_garden
   *
   * Cache key: tile coords + filter hash → deterministic, near-100% hit rate
   */
  fastify.get<{
    Params: { z: string; x: string; y: string };
    Querystring: Record<string, any>;
  }>(
    '/api/v1/map/tiles/:z/:x/:y',
    {
      schema: {
        params: {
          type: 'object',
          required: ['z', 'x', 'y'],
          properties: {
            z: { type: 'string', pattern: '^[0-9]+$' },
            x: { type: 'string', pattern: '^[0-9]+$' },
            y: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { z: string; x: string; y: string }; Querystring: Record<string, any> }>, reply: FastifyReply) => {
      const z = parseInt(request.params.z, 10);
      const x = parseInt(request.params.x, 10);
      const y = parseInt(request.params.y, 10);
      const { country, ...filterRaw } = request.query as Record<string, any>;

      if (!country) {
        return reply.status(400).send({ error: 'country query param is required' });
      }
      if (z < 0 || z > 22) {
        return reply.status(400).send({ error: 'Zoom must be 0-22' });
      }

      const filters = parseFilters(filterRaw);
      const bounds  = tileToBBox(z, x, y);

      // Cache key: tile coords + filter hash — deterministic
      const cacheKey = `map:tile:${z}:${x}:${y}:${country}:${generateCacheKey('f', filters)}`;

      try {
        const result = await executeClusters(country, z, bounds, filters, cacheKey);

        // Cache-Control header so CDN / browser can cache tile responses
        if (result.cached) {
          reply.header('X-Cache', 'HIT');
        } else {
          reply.header('X-Cache', 'MISS');
        }
        reply.header('Cache-Control', `public, max-age=${TILE_CACHE_TTL}`);

        return reply.status(200).send(result);
      } catch (error: any) {
        if (error?.message?.includes('No database connection')) {
          return reply.status(400).send({ error: `Unsupported country: ${country}` });
        }
        routeLog.error({ err: error, z, x, y, country }, 'Map tile error');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /api/v1/map/clusters
   *
   * Flexible viewport-based clustering for clients that send bounding boxes
   * instead of tile coordinates (e.g. custom map implementations).
   *
   * The bounding box is snapped to the nearest tile grid to maximise cache reuse.
   *
   * Body:
   * {
   *   country: "czech",
   *   zoom: 12,
   *   bounds: { north, south, east, west },
   *   filters: { property_category, transaction_type, price_min, ... }
   * }
   */
  fastify.post<{
    Body: {
      country: string;
      zoom: number;
      bounds: BoundingBox;
      filters?: Record<string, any>;
      viewport_width?: number;
      viewport_height?: number;
    };
  }>(
    '/api/v1/map/clusters',
    {
      schema: {
        body: {
          type: 'object',
          required: ['country', 'zoom', 'bounds'],
          properties: {
            country: { type: 'string' },
            zoom:    { type: 'number', minimum: 0, maximum: 22 },
            bounds:  {
              type: 'object',
              required: ['north', 'south', 'east', 'west'],
              properties: {
                north: { type: 'number', minimum: -90,  maximum: 90  },
                south: { type: 'number', minimum: -90,  maximum: 90  },
                east:  { type: 'number', minimum: -180, maximum: 180 },
                west:  { type: 'number', minimum: -180, maximum: 180 },
              },
            },
            filters: { type: 'object' },
            viewport_width:  { type: 'number', minimum: 1, maximum: 10000 },
            viewport_height: { type: 'number', minimum: 1, maximum: 10000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { country, zoom, bounds, filters: rawFilters = {}, viewport_width, viewport_height } = request.body;
      const filters = parseFilters(rawFilters);

      // Snap viewport edges outward to tile grid for better cache hit rate
      const tileSize = 360 / Math.pow(2, zoom);
      const snapped: BoundingBox = {
        west:  Math.floor(bounds.west  / tileSize) * tileSize,
        east:  Math.ceil(bounds.east   / tileSize) * tileSize,
        south: Math.floor(bounds.south / tileSize) * tileSize,
        north: Math.ceil(bounds.north  / tileSize) * tileSize,
      };

      // Bucket viewport into 100px steps so cache keys don't fragment per pixel
      const vpW = viewport_width ? Math.round(viewport_width / 100) * 100 : 0;
      const vpH = viewport_height ? Math.round(viewport_height / 100) * 100 : 0;
      const cacheKey = `map:bbox:${zoom}:${country}:${generateCacheKey('b', snapped)}:${generateCacheKey('f', filters)}:vp${vpW}x${vpH}`;

      try {
        const result = await executeClusters(country, zoom, snapped, filters, cacheKey, viewport_width, viewport_height);
        reply.header('X-Cache', result.cached ? 'HIT' : 'MISS');
        return reply.status(200).send(result);
      } catch (error: any) {
        if (error?.message?.includes('No database connection')) {
          return reply.status(400).send({ error: `Unsupported country: ${country}` });
        }
        routeLog.error({ err: error, zoom, country }, 'Map clusters error');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
