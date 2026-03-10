/**
 * Metrics Middleware
 * Auto-instruments HTTP request duration and counts
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { httpRequestsTotal, httpRequestDurationSeconds } from './index';

/**
 * Normalize a URL path to a route label (collapse IDs to :id).
 * e.g. /api/v1/scrape-runs/abc-123/complete -> /api/v1/scrape-runs/:id/complete
 */
function normalizeRoute(url: string): string {
  return url
    .split('?')[0]
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id'
    );
}

export async function metricsOnRequest(request: FastifyRequest) {
  (request as any)._metricsStartTime = process.hrtime.bigint();
}

export async function metricsOnResponse(request: FastifyRequest, reply: FastifyReply) {
  const startTime = (request as any)._metricsStartTime as bigint | undefined;
  if (!startTime) return;

  const route = normalizeRoute(request.url);
  const durationNs = Number(process.hrtime.bigint() - startTime);
  const durationSec = durationNs / 1e9;

  httpRequestDurationSeconds.observe({ route }, durationSec);
  httpRequestsTotal.inc({
    route,
    method: request.method,
    status: String(reply.statusCode),
  });
}
