/**
 * Search Routes
 *
 * POST /api/v1/search - Main search endpoint
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SearchRequest } from '../types/search';
import { executeSearch, validateSearchRequest } from '../core/search-engine';
import { routeLog } from '../logger';

export async function searchRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/search
   *
   * Main search endpoint for property queries
   */
  fastify.post<{ Body: SearchRequest }>(
    '/api/v1/search',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            countries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Countries to search (or ["*"] for all)'
            },
            filters: {
              type: 'object',
              description: 'Search filters'
            },
            sort: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                order: { type: 'string', enum: ['asc', 'desc'] }
              }
            },
            sort_by: {
              type: 'string',
              enum: ['price_asc', 'price_desc', 'date_newest', 'date_oldest'],
              description: 'Sort preset (overrides sort object)'
            },
            page: {
              type: 'number',
              minimum: 1,
              description: 'Page number (1-based, default: 1)'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Items per page (default: 20, max: 100)'
            },
            pagination: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                offset: { type: 'number' }
              },
              description: 'Legacy pagination (prefer page/limit instead)'
            }
          },
          required: ['filters']
        },
        response: {
          200: {
            type: 'object',
            properties: {
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
              aggregations: { type: 'object' },
              query_time_ms: { type: 'number' },
              countries_queried: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: SearchRequest }>, reply: FastifyReply) => {
      const searchRequest = request.body;

      // Validate request
      const validation = validateSearchRequest(searchRequest);
      if (!validation.valid) {
        return reply.status(400).send({
          error: 'Invalid search request',
          errors: validation.errors
        });
      }

      try {
        const results = await executeSearch(searchRequest);
        return reply.status(200).send(results);
      } catch (error) {
        routeLog.error({ err: error }, 'Search error');
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
