/**
 * Boundaries API Routes
 * Polygon lookup and point-in-polygon queries
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../database/manager';
import pino from 'pino';
import { config } from '../config';

const logger = pino({
  level: config.logging.level,
  base: { service: 'polygon-service', module: 'routes' },
});

interface AreaResult {
  id: string;
  relationId: number;
  name: string;
  adminLevel: number | null;
  parentRelationId: number | null;
  geometry: any; // GeoJSON
  tags: Record<string, any>;
  names: Record<string, any>;
}

/**
 * Convert DB row to AreaResult format
 */
function rowToArea(row: any): AreaResult {
  return {
    id: row.id,
    relationId: row.osm_relation_id,
    name: row.name,
    adminLevel: row.admin_level,
    parentRelationId: row.parent_id,
    geometry: row.geometry,
    tags: row.osm_tags,
    names: row.names,
  };
}

export async function boundariesRoutes(fastify: FastifyInstance) {
  const db = getDatabase();

  /**
   * GET /api/v1/boundaries/:relationId
   * Get boundary by OSM relation ID
   */
  fastify.get<{
    Params: { relationId: string };
  }>('/api/v1/boundaries/:relationId', async (request, reply) => {
    const relationId = parseInt(request.params.relationId, 10);

    if (isNaN(relationId)) {
      return reply.code(400).send({ error: 'Invalid relation ID' });
    }

    try {
      // Query database
      const result = await db.query(`
        SELECT
          id,
          osm_relation_id,
          name,
          admin_level,
          parent_id,
          ST_AsGeoJSON(geometry_full)::jsonb as geometry,
          osm_tags,
          names
        FROM boundaries
        WHERE osm_relation_id = $1
      `, [relationId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Boundary not found' });
      }

      const area = rowToArea(result.rows[0]);

      return reply.send({ data: area });
    } catch (error) {
      logger.error({ relationId, error }, 'Error fetching boundary');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/boundaries/search
   * Search boundaries by name
   */
  fastify.get<{
    Querystring: {
      name: string;
      adminLevel?: string;
      limit?: string;
    };
  }>('/api/v1/boundaries/search', async (request, reply) => {
    const { name, adminLevel, limit = '10' } = request.query;

    if (!name) {
      return reply.code(400).send({ error: 'Name query parameter required' });
    }

    const adminLevelNum = adminLevel ? parseInt(adminLevel, 10) : undefined;
    const limitNum = parseInt(limit, 10);

    try {
      // Query database with fuzzy matching
      const query = adminLevelNum
        ? `
          SELECT
            id,
            osm_relation_id,
            name,
            admin_level,
            parent_id,
            ST_AsGeoJSON(geometry_full)::jsonb as geometry,
            osm_tags,
            names,
            similarity(name, $1) as sim
          FROM boundaries
          WHERE admin_level = $2
            AND similarity(name, $1) > 0.3
          ORDER BY sim DESC
          LIMIT $3
        `
        : `
          SELECT
            id,
            osm_relation_id,
            name,
            admin_level,
            parent_id,
            ST_AsGeoJSON(geometry_full)::jsonb as geometry,
            osm_tags,
            names,
            similarity(name, $1) as sim
          FROM boundaries
          WHERE similarity(name, $1) > 0.3
          ORDER BY sim DESC
          LIMIT $2
        `;

      const params = adminLevelNum
        ? [name, adminLevelNum, limitNum]
        : [name, limitNum];

      const result = await db.query(query, params);

      const areas = result.rows.map(rowToArea);

      return reply.send({ data: areas });
    } catch (error) {
      logger.error({ name, adminLevel, error }, 'Error searching boundaries');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/boundaries/point-in-polygon
   * Find which boundaries contain a point
   */
  fastify.post<{
    Body: {
      lat: number;
      lon: number;
      adminLevel?: number;
    };
  }>('/api/v1/boundaries/point-in-polygon', async (request, reply) => {
    const { lat, lon, adminLevel } = request.body;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return reply.code(400).send({ error: 'lat and lon must be numbers' });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return reply.code(400).send({ error: 'Invalid coordinates' });
    }

    try {
      // Query database using PostGIS ST_Contains
      const query = adminLevel
        ? `
          SELECT
            id,
            osm_relation_id,
            name,
            admin_level,
            parent_id,
            osm_tags,
            names
          FROM boundaries
          WHERE ST_Contains(geometry_full, ST_SetSRID(ST_MakePoint($1, $2), 4326))
            AND admin_level = $3
          ORDER BY admin_level DESC
        `
        : `
          SELECT
            id,
            osm_relation_id,
            name,
            admin_level,
            parent_id,
            osm_tags,
            names
          FROM boundaries
          WHERE ST_Contains(geometry_full, ST_SetSRID(ST_MakePoint($1, $2), 4326))
          ORDER BY admin_level DESC
        `;

      const params = adminLevel ? [lon, lat, adminLevel] : [lon, lat];

      const result = await db.query(query, params);

      const areas = result.rows.map(rowToArea);

      return reply.send({ data: areas });
    } catch (error) {
      logger.error({ lat, lon, adminLevel, error }, 'Error in point-in-polygon query');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/v1/boundaries/stats
   * Get database stats
   */
  fastify.get('/api/v1/boundaries/stats', async (request, reply) => {
    try {
      const result = await db.query(`
        SELECT
          COUNT(*) as total_areas,
          COUNT(DISTINCT admin_level) as admin_levels,
          MIN(admin_level) as min_admin_level,
          MAX(admin_level) as max_admin_level,
          COUNT(DISTINCT country_code) as total_countries
        FROM boundaries
      `);

      return reply.send({
        database: result.rows[0]
      });
    } catch (error) {
      logger.error({ error }, 'Error fetching stats');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
