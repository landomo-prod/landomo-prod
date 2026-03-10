/**
 * Metrics Middleware
 *
 * Fastify hook that instruments every request with duration and counter metrics.
 */

import { FastifyInstance } from 'fastify';
import { httpRequestsTotal, httpRequestDuration } from './index';

/**
 * Normalize route path to avoid high-cardinality labels.
 * Replaces UUID / numeric path segments with placeholders.
 */
function normalizePath(url: string): string {
  return url
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .split('?')[0];
}

export function registerMetricsMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request) => {
    (request as any)._metricsStart = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const start = (request as any)._metricsStart as bigint | undefined;
    if (!start) return;

    const route = normalizePath(request.url);
    // Skip the /metrics endpoint itself to avoid self-referencing noise
    if (route === '/metrics') return;

    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;

    httpRequestDuration.observe({ route }, durationSec);
    httpRequestsTotal.inc({
      route,
      method: request.method,
      status: String(reply.statusCode),
    });
  });
}
