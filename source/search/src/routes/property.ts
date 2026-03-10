/**
 * Property Routes
 *
 * GET /api/v1/properties/:id - Get property by ID
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import { getPropertyById } from '../database/multi-db-manager';
import { getCountryModule } from '../countries';
import {
  getCachedPropertyDetail,
  cachePropertyDetail
} from '../cache/cache-strategies';
import { routeLog } from '../logger';

function generateETag(data: any): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
}

interface PropertyParams {
  id: string;
}

interface PropertyQuery {
  country?: string;
}

export async function propertyRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/properties/:id
   *
   * Get a single property by ID
   * Requires country query parameter
   */
  fastify.get<{ Params: PropertyParams; Querystring: PropertyQuery }>(
    '/api/v1/properties/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }
          },
          required: ['id']
        },
        querystring: {
          type: 'object',
          properties: {
            country: { type: 'string', description: 'Country code' }
          },
          required: ['country']
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
            description: 'Property details'
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (
      request: FastifyRequest<{ Params: PropertyParams; Querystring: PropertyQuery }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { country } = request.query;

      if (!country) {
        return reply.status(400).send({
          error: 'Missing required query parameter: country'
        });
      }

      try {
        // Check cache first
        const cached = await getCachedPropertyDetail(country, id);
        if (cached) {
          routeLog.debug({ country, propertyId: id }, 'Cache hit for property');
          const etag = `"${generateETag(cached)}"`;
          if (request.headers['if-none-match'] === etag) {
            return reply.status(304).send();
          }
          return reply.status(200).header('ETag', etag).send(cached);
        }

        // Fetch from database
        const property = await getPropertyById(country, id);

        if (!property) {
          return reply.status(404).send({
            error: 'Property not found'
          });
        }

        // Transform result using country module
        const countryModule = getCountryModule(country);
        const transformed = countryModule.transformResult(property);

        // Cache the result
        await cachePropertyDetail(country, id, transformed);

        const etag = `"${generateETag(transformed)}"`;
        if (request.headers['if-none-match'] === etag) {
          return reply.status(304).send();
        }
        return reply.status(200).header('ETag', etag).send(transformed);
      } catch (error) {
        routeLog.error({ err: error, country, propertyId: id }, 'Error fetching property');
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
