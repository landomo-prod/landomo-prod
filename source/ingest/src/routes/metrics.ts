/**
 * Prometheus Metrics Route
 * GET /metrics - Exposes Prometheus-format metrics for scraping
 */

import { FastifyInstance } from 'fastify';
import { registry } from '../metrics';

export async function metricsRoute(fastify: FastifyInstance) {
  fastify.get('/metrics', async (_request, reply) => {
    const metrics = await registry.metrics();
    reply.header('Content-Type', registry.contentType).send(metrics);
  });
}
