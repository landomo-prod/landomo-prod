/**
 * Bulk Property Ingestion Route
 * POST /api/v1/properties/bulk-ingest
 */

import { FastifyInstance } from 'fastify';
import { getInternalQueue } from '../queue/internal-queue';
import { getCoreDatabase } from '../database/manager';

interface BulkIngestBody {
  portal: string;
  country: string;
  properties: any[];
  scrape_run_id?: string;
}

export async function bulkIngestRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: BulkIngestBody }>(
    '/api/v1/properties/bulk-ingest',
    async (request, reply) => {
      const { portal, country, properties, scrape_run_id } = request.body;

      if (!portal || !country || !Array.isArray(properties)) {
        request.log.warn({ portal, country, isArray: Array.isArray(properties), ip: request.ip }, 'Rejected: missing required fields');
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Missing required fields',
          required: ['portal', 'country', 'properties (array)'],
        });
      }

      // Field format validation
      if (typeof portal !== 'string' || portal.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(portal)) {
        request.log.warn({ portal, ip: request.ip }, 'Rejected: invalid portal format');
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'portal must be an alphanumeric string (max 100 chars)',
        });
      }

      if (typeof country !== 'string' || country.length > 50 || !/^[a-z_]+$/.test(country)) {
        request.log.warn({ country, ip: request.ip }, 'Rejected: invalid country format');
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'country must be a lowercase string with only letters and underscores',
        });
      }

      if (properties.length === 0) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'Properties array cannot be empty',
        });
      }

      try {
        const queue = getInternalQueue();
        const requestId = request.id;

        // Deduplicate on HTTP request ID to prevent double-processing on network retries.
        // NOTE: scrape_run_id is per-run metadata (many batches share it) — never use it as dedup key.
        try {
          const db = getCoreDatabase(country);
          const dedupResult = await db.query(
            `SELECT 1 FROM ingestion_log WHERE request_id = $1 AND ingested_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
            [requestId]
          );
          if (dedupResult.rows.length > 0) {
            request.log.info({ portal, country, requestId }, 'Duplicate request skipped');
            return reply.status(200).send({
              status: 'already_processed',
              cached: true,
            });
          }
        } catch (dedupErr: any) {
          // Non-fatal: if dedup check fails, proceed with ingestion
          request.log.warn({ error: dedupErr.message }, 'Dedup check failed, proceeding');
        }

        // Create ONE batch job with all properties (not individual jobs per property)
        // This reduces Redis overhead and allows true batch processing in worker
        const timestamp = Date.now();
        const jobId = `batch-${portal}-${timestamp}-${requestId}`;

        await queue.add(
          'ingest-property-batch',
          {
            portal,
            country,
            properties, // Pass entire array to worker
            scrape_run_id,
            request_id: requestId,
            batch_size: properties.length,
          },
          {
            jobId,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: {
              age: 3600,
              count: 100,
            },
            removeOnFail: {
              age: 86400,
              count: 500,
            },
          }
        );

        request.log.info({ portal, country, count: properties.length, jobId }, 'Batch job queued');

        // Record dedup marker keyed on HTTP request ID to block retries of this exact request.
        {
          const db = getCoreDatabase(country);
          db.query(
            `INSERT INTO ingestion_log (portal, portal_listing_id, status, request_id)
             VALUES ($1, $2, 'success', $3)
             ON CONFLICT DO NOTHING`,
            [portal, requestId, requestId]
          ).catch((err: any) => {
            request.log.warn({ error: err.message }, 'Failed to write dedup marker (non-fatal)');
          });
        }

        return reply.status(202).send({
          status: 'accepted',
          message: `${properties.length} properties queued for batch ingestion`,
          job_id: jobId,
        });
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: 'Failed to queue properties for ingestion',
        });
      }
    }
  );
}
