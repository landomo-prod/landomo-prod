/**
 * Health Check Routes
 *
 * GET /api/v1/health - Health check endpoint
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { testConnections, getPoolStats } from '../database/multi-db-manager';
import { getCacheStats } from '../cache/redis-manager';

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/health
   *
   * Simple health check
   */
  fastify.get('/api/v1/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'search-service',
      version: '1.0.0'
    });
  });

  /**
   * GET /api/v1/health/detailed
   *
   * Detailed health check with database and cache status
   */
  fastify.get('/api/v1/health/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Test database connections
      const dbStatus = await testConnections();
      const dbHealthy = Object.values(dbStatus).every(status => status === true);

      // Get pool stats
      const poolStats = getPoolStats();

      // Get cache stats
      let cacheHealthy = true;
      let cacheStats = null;
      try {
        cacheStats = await getCacheStats();
      } catch (error) {
        cacheHealthy = false;
      }

      const overall = dbHealthy && cacheHealthy ? 'healthy' : 'degraded';

      return reply.status(200).send({
        status: overall,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'search-service',
        version: '1.0.0',
        components: {
          database: {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            connections: dbStatus,
            pool_stats: poolStats
          },
          cache: {
            status: cacheHealthy ? 'healthy' : 'unhealthy',
            stats: cacheStats
          }
        }
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
