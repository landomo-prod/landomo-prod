/**
 * Health check routes
 */

import { FastifyInstance } from 'fastify';
import { testConnection } from '../database/manager';
import { config } from '../config';

export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /health
   * Basic health check
   */
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      service: 'polygon-service',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * GET /api/v1/health
   * Detailed health check with database status
   */
  fastify.get('/api/v1/health', async (request, reply) => {
    const dbHealthy = await testConnection();

    const health = {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'polygon-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
      },
      config: {
        database: config.database.database,
        port: config.server.port,
      }
    };

    return reply.code(dbHealthy ? 200 : 503).send(health);
  });
}
