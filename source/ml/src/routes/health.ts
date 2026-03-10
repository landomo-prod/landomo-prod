import { FastifyInstance } from 'fastify';
import { testConnections, getPoolStats } from '../database/multi-db-manager';
import { getRedisClient } from '../cache/redis-manager';
import { serverLog } from '../logger';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/v1/health', async (_request, reply) => {
    const checks: Record<string, boolean> = {};

    // Database connectivity
    try {
      const dbStatus = await testConnections();
      checks.database = Object.values(dbStatus).some(v => v);
      if (!checks.database) {
        checks.database = false;
      }
    } catch {
      checks.database = false;
    }

    // Redis connectivity
    try {
      const client = getRedisClient();
      await client.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const healthy = Object.values(checks).every(v => v);
    const statusCode = healthy ? 200 : 503;

    const response = {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      checks,
      pools: getPoolStats(),
    };

    if (!healthy) {
      serverLog.warn({ checks }, 'Health check failed');
    }

    return reply.status(statusCode).send(response);
  });
}
