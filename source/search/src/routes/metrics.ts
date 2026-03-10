/**
 * Metrics Route
 *
 * GET /metrics - Prometheus-compatible metrics endpoint
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { promClient, collectDbPoolMetrics } from '../metrics';

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Refresh DB pool gauges before each scrape
    collectDbPoolMetrics();

    reply.header('Content-Type', promClient.register.contentType);
    const metrics = await promClient.register.metrics();
    return reply.send(metrics);
  });
}
