/**
 * Cache Management Routes
 *
 * POST /api/v1/cache/invalidate - Invalidate cache for a country
 * GET  /api/v1/cache/stats      - Cache statistics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { invalidateCountryCaches } from '../cache/cache-strategies';
import { getCacheStats } from '../cache/redis-manager';
import { cacheLog } from '../logger';

interface InvalidateBody {
  country: string;
}

export async function cacheRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/cache/invalidate
   *
   * Invalidate cached data for a specific country.
   * Clears property, aggregation, filter, search, and geo caches.
   */
  fastify.post<{ Body: InvalidateBody }>(
    '/api/v1/cache/invalidate',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            country: {
              type: 'string',
              minLength: 1,
              description: 'Country code whose cache should be invalidated'
            }
          },
          required: ['country']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              country: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: InvalidateBody }>, reply: FastifyReply) => {
      const { country } = request.body;

      try {
        await invalidateCountryCaches(country);
        cacheLog.info({ country, source: 'api' }, 'Cache invalidated via API');
        return reply.status(200).send({
          status: 'invalidated',
          country
        });
      } catch (error) {
        cacheLog.error({ err: error, country }, 'Failed to invalidate cache');
        return reply.status(500).send({
          error: 'Failed to invalidate cache',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/v1/cache/stats
   *
   * Returns cache statistics: hit rate, key count, memory usage, etc.
   */
  fastify.get(
    '/api/v1/cache/stats',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              hitRate: { type: 'number' },
              keyspace: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  expires: { type: 'number' }
                }
              },
              memory: {
                type: 'object',
                properties: {
                  used: { type: 'string' },
                  peak: { type: 'string' }
                }
              },
              stats: {
                type: 'object',
                properties: {
                  hits: { type: 'number' },
                  misses: { type: 'number' },
                  evictedKeys: { type: 'number' }
                }
              },
              uptime: { type: 'number' }
            }
          }
        }
      }
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await getCacheStats();
        return reply.status(200).send(stats);
      } catch (error) {
        cacheLog.error({ err: error }, 'Failed to get cache stats');
        return reply.status(500).send({
          error: 'Failed to retrieve cache stats',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
