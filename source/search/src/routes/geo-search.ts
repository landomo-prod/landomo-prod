/**
 * Geo-Search Routes
 *
 * POST /api/v1/search/geo - Geographic radius search
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GeoSearchRequest } from '../types/search';
import { executeGeoSearch } from '../database/geo-search';
import { config } from '../config';
import { routeLog } from '../logger';

export async function geoSearchRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/search/geo
   *
   * Geographic radius search
   */
  fastify.post<{ Body: GeoSearchRequest }>(
    '/api/v1/search/geo',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
            radius_km: { type: 'number', minimum: 0.1, maximum: config.geo.maxRadiusKm },
            countries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Countries to search (optional)'
            },
            filters: {
              type: 'object',
              description: 'Additional filters'
            },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            page: {
              type: 'number',
              minimum: 1,
              description: 'Page number (1-based, default: 1)'
            },
            sort_by: {
              type: 'string',
              enum: ['price_asc', 'price_desc', 'date_newest', 'date_oldest'],
              description: 'Sort preset (default: distance)'
            }
          },
          required: ['latitude', 'longitude']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              center: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                }
              },
              radius_km: { type: 'number' },
              total: { type: 'number' },
              results: { type: 'array' },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                  hasNext: { type: 'boolean' },
                  hasPrev: { type: 'boolean' }
                }
              },
              query_time_ms: { type: 'number' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: GeoSearchRequest }>, reply: FastifyReply) => {
      const geoRequest = request.body;

      // Validate latitude/longitude
      if (geoRequest.latitude < -90 || geoRequest.latitude > 90) {
        return reply.status(400).send({
          error: 'Invalid latitude',
          message: 'Latitude must be between -90 and 90'
        });
      }

      if (geoRequest.longitude < -180 || geoRequest.longitude > 180) {
        return reply.status(400).send({
          error: 'Invalid longitude',
          message: 'Longitude must be between -180 and 180'
        });
      }

      // Set default radius if not provided
      if (!geoRequest.radius_km) {
        geoRequest.radius_km = config.geo.defaultRadiusKm;
      }

      // Validate radius
      if (geoRequest.radius_km > config.geo.maxRadiusKm) {
        return reply.status(400).send({
          error: 'Invalid radius',
          message: `Radius must be less than or equal to ${config.geo.maxRadiusKm} km`
        });
      }

      try {
        const results = await executeGeoSearch(geoRequest);
        return reply.status(200).send(results);
      } catch (error) {
        routeLog.error({ err: error }, 'Geo-search route error');
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
