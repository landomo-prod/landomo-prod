/**
 * Boundary Routes
 *
 * GET /api/v1/boundaries/search - Search boundaries by name
 * POST /api/v1/boundaries/point-in-polygon - Find boundaries containing a point
 * GET /api/v1/boundaries/:id/properties - Get properties within a boundary
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { Pool } from 'pg';
import { routeLog } from '../logger';
import { getCountryPool } from '../database/multi-db-manager';

/**
 * Lazy-initialized pool for the geocoding database
 */
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

/**
 * Get polygon service configuration
 */
function getPolygonServiceConfig() {
  return {
    url: process.env.POLYGON_SERVICE_URL || 'http://polygon-service:3100',
    apiKey: process.env.POLYGON_SERVICE_API_KEY || '',
    timeout: parseInt(process.env.POLYGON_SERVICE_TIMEOUT || '30000', 10),
  };
}

/**
 * Call polygon service API
 */
async function callPolygonService(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
  const polygonConfig = getPolygonServiceConfig();

  if (!polygonConfig.apiKey) {
    throw new Error('POLYGON_SERVICE_API_KEY not configured');
  }

  try {
    const response = await axios({
      method,
      url: `${polygonConfig.url}${endpoint}`,
      headers: {
        'X-API-Key': polygonConfig.apiKey,
        'Content-Type': 'application/json',
      },
      data,
      timeout: polygonConfig.timeout,
    });

    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Polygon service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`Polygon service network error: ${error.message}`);
    } else {
      throw error;
    }
  }
}

export async function boundaryRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/boundaries/search
   *
   * Search boundaries by name
   */
  fastify.get<{
    Querystring: {
      name: string;
      adminLevel?: number;
      limit?: number;
    };
  }>(
    '/api/v1/boundaries/search',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1 },
            adminLevel: { type: 'number', minimum: 2, maximum: 12 },
            limit: { type: 'number', minimum: 1, maximum: 50 },
          },
          required: ['name'],
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { name: string; adminLevel?: number; limit?: number } }>, reply: FastifyReply) => {
      const { name, adminLevel, limit = 10 } = request.query;

      try {
        const params = new URLSearchParams({ name, limit: String(limit) });
        if (adminLevel) {
          params.append('adminLevel', String(adminLevel));
        }

        const result = await callPolygonService(`/api/v1/boundaries/search?${params.toString()}`);
        return reply.send(result);
      } catch (error) {
        routeLog.error({ err: error, name, adminLevel }, 'Boundary search error');
        return reply.status(500).send({
          error: 'Boundary search failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/v1/boundaries/point-in-polygon
   *
   * Find boundaries containing a point
   */
  fastify.post<{
    Body: {
      lat: number;
      lon: number;
      adminLevel?: number;
    };
  }>(
    '/api/v1/boundaries/point-in-polygon',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lon: { type: 'number', minimum: -180, maximum: 180 },
            adminLevel: { type: 'number', minimum: 2, maximum: 12 },
          },
          required: ['lat', 'lon'],
        },
      },
    },
    async (request: FastifyRequest<{ Body: { lat: number; lon: number; adminLevel?: number } }>, reply: FastifyReply) => {
      const { lat, lon, adminLevel } = request.body;

      try {
        const result = await callPolygonService('/api/v1/boundaries/point-in-polygon', 'POST', {
          lat,
          lon,
          adminLevel,
        });
        return reply.send(result);
      } catch (error) {
        routeLog.error({ err: error, lat, lon, adminLevel }, 'Point-in-polygon error');
        return reply.status(500).send({
          error: 'Point-in-polygon query failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/v1/boundaries/:id/properties
   *
   * Get properties within a boundary
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      country?: string;
      limit?: number;
      page?: number;
    };
  }>(
    '/api/v1/boundaries/:id/properties',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            page: { type: 'number', minimum: 1 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { country?: string; limit?: number; page?: number };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { country, limit = 20, page = 1 } = request.query;

      if (!country) {
        return reply.status(400).send({
          error: 'Country required',
          message: 'Please specify country query parameter',
        });
      }

      try {
        // Get database connection for country
        const pool = getCountryPool(country);
        if (!pool) {
          return reply.status(400).send({
            error: 'Invalid country',
            message: `Country ${country} not found`,
          });
        }

        const offset = (page - 1) * limit;

        // Query properties associated with this boundary
        const result = await pool.query(
          `
          SELECT
            p.id,
            p.title,
            p.price,
            p.currency,
            p.property_type,
            p.transaction_type,
            p.city,
            p.latitude,
            p.longitude,
            p.bedrooms,
            p.bathrooms,
            p.sqm,
            p.images,
            pbc.boundary_type,
            pbc.confidence
          FROM properties p
          INNER JOIN property_boundary_cache pbc ON p.id = pbc.property_id
          WHERE pbc.boundary_id = $1
          ORDER BY p.created_at DESC
          LIMIT $2 OFFSET $3
        `,
          [id, limit, offset]
        );

        const countResult = await pool.query(
          `
          SELECT COUNT(*) as total
          FROM property_boundary_cache
          WHERE boundary_id = $1
        `,
          [id]
        );

        const total = parseInt(countResult.rows[0]?.total || '0', 10);
        const totalPages = Math.ceil(total / limit);

        return reply.send({
          boundaryId: id,
          country,
          total,
          results: result.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        });
      } catch (error) {
        routeLog.error({ err: error, boundaryId: id, country }, 'Boundary properties query error');
        return reply.status(500).send({
          error: 'Query failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/v1/boundaries/districts
   *
   * Returns a GeoJSON FeatureCollection of district boundaries from the geocoding DB.
   * Query params:
   *   country     - ignored for now (geocoding DB is not country-partitioned), default 'czech'
   *   adminLevel  - OSM admin level, default 6 (districts in CZ)
   */
  fastify.get<{
    Querystring: {
      country?: string;
      adminLevel?: number;
    };
  }>(
    '/api/v1/boundaries/districts',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            adminLevel: { type: 'number', minimum: 2, maximum: 12 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { country?: string; adminLevel?: number } }>,
      reply: FastifyReply
    ) => {
      const { country = 'czech', adminLevel } = request.query;

      try {
        const pool = getGeocodingPool();

        const result = adminLevel
          ? await pool.query(
              `SELECT osm_relation_id, name, admin_level, ST_AsGeoJSON(geometry_full)::json AS geometry
               FROM boundaries
               WHERE admin_level = $1
               ORDER BY admin_level, name`,
              [adminLevel]
            )
          : await pool.query(
              `SELECT osm_relation_id, name, admin_level, ST_AsGeoJSON(geometry_full)::json AS geometry
               FROM boundaries
               ORDER BY admin_level, name`
            );

        const features = result.rows.map((row) => ({
          type: 'Feature' as const,
          geometry: row.geometry,
          properties: {
            name: row.name,
            adminLevel: row.admin_level,
            relationId: row.osm_relation_id,
          },
        }));

        return reply.send({
          type: 'FeatureCollection',
          features,
        });
      } catch (error) {
        routeLog.error({ err: error, country, adminLevel }, 'Districts GeoJSON query error');
        return reply.status(500).send({
          error: 'Districts query failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
