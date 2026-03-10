/**
 * Health Check Route
 */

import { FastifyInstance } from 'fastify';
import { checkPgBouncerHealth } from '../database/manager';

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/api/v1/health', async () => {
    const pgbouncerHealth = await checkPgBouncerHealth();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      ...(pgbouncerHealth && { pgbouncer: pgbouncerHealth }),
    };
  });
}
