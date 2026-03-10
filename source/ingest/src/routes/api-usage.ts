/**
 * API Usage Analytics Route
 *
 * Provides usage statistics from api_access_log for monitoring
 * and developer-facing analytics.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { getCoreDatabase } from '../database/manager';
import { config } from '../config';

interface UsageQuery {
  hours?: string;
}

export async function apiUsageRoute(fastify: FastifyInstance) {
  /**
   * GET /api/v1/usage/summary
   * Returns aggregated API usage stats for the current country instance.
   */
  fastify.get('/api/v1/usage/summary', async (request: FastifyRequest<{ Querystring: UsageQuery }>) => {
    const hours = Math.min(parseInt(request.query.hours || '24', 10), 720);
    const country = config.instance.country;
    const db = getCoreDatabase(country);

    const [totalResult, byEndpoint, byStatus, byKey, topIps] = await Promise.all([
      // Total requests in window
      db.query(
        `SELECT COUNT(*) as total,
                AVG(response_time_ms)::int as avg_response_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::int as p95_response_ms,
                COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
                COUNT(*) FILTER (WHERE status_code = 429) as rate_limited_count
         FROM api_access_log
         WHERE timestamp > NOW() - INTERVAL '1 hour' * $1`,
        [hours]
      ),

      // Requests by endpoint
      db.query(
        `SELECT endpoint, method, COUNT(*) as count,
                AVG(response_time_ms)::int as avg_ms
         FROM api_access_log
         WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
         GROUP BY endpoint, method
         ORDER BY count DESC
         LIMIT 20`,
        [hours]
      ),

      // Requests by status code
      db.query(
        `SELECT status_code, COUNT(*) as count
         FROM api_access_log
         WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
         GROUP BY status_code
         ORDER BY status_code`,
        [hours]
      ),

      // Requests by API key version
      db.query(
        `SELECT api_key_prefix, api_key_version, COUNT(*) as count,
                MAX(timestamp) as last_seen
         FROM api_access_log
         WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
           AND api_key_prefix IS NOT NULL
         GROUP BY api_key_prefix, api_key_version
         ORDER BY count DESC`,
        [hours]
      ),

      // Top client IPs
      db.query(
        `SELECT client_ip, COUNT(*) as count,
                COUNT(*) FILTER (WHERE status_code IN (401, 403)) as auth_failures
         FROM api_access_log
         WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
         GROUP BY client_ip
         ORDER BY count DESC
         LIMIT 10`,
        [hours]
      ),
    ]);

    const total = totalResult.rows[0];

    return {
      country,
      window: { hours, from: new Date(Date.now() - hours * 3600000).toISOString() },
      summary: {
        totalRequests: parseInt(total.total, 10),
        avgResponseMs: total.avg_response_ms,
        p95ResponseMs: total.p95_response_ms,
        errorCount: parseInt(total.error_count, 10),
        rateLimitedCount: parseInt(total.rate_limited_count, 10),
        errorRate: total.total > 0
          ? ((parseInt(total.error_count, 10) / parseInt(total.total, 10)) * 100).toFixed(2) + '%'
          : '0%',
      },
      byEndpoint: byEndpoint.rows,
      byStatusCode: byStatus.rows,
      byApiKey: byKey.rows,
      topClientIps: topIps.rows,
    };
  });

  /**
   * GET /api/v1/usage/hourly
   * Returns hourly request counts for charting.
   */
  fastify.get('/api/v1/usage/hourly', async (request: FastifyRequest<{ Querystring: UsageQuery }>) => {
    const hours = Math.min(parseInt(request.query.hours || '24', 10), 168);
    const country = config.instance.country;
    const db = getCoreDatabase(country);

    const result = await db.query(
      `SELECT date_trunc('hour', timestamp) as hour,
              COUNT(*) as requests,
              COUNT(*) FILTER (WHERE status_code >= 400) as errors,
              AVG(response_time_ms)::int as avg_ms
       FROM api_access_log
       WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
       GROUP BY hour
       ORDER BY hour`,
      [hours]
    );

    return {
      country,
      window: { hours },
      hourly: result.rows,
    };
  });
}
