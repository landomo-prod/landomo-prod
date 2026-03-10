/**
 * Property Ingestion Route
 * POST /api/v1/properties/ingest
 */

import { FastifyInstance } from 'fastify';
import { IngestionPayload } from '@landomo/core';
import { getInternalQueue } from '../queue/internal-queue';

export async function ingestRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: IngestionPayload }>('/api/v1/properties/ingest', async (request, reply) => {
    const { portal, portal_id, country, data } = request.body;

    // Quick validation
    if (!portal || !portal_id || !country || !data) {
      request.log.warn({ portal, portal_id, country, hasData: !!data, ip: request.ip }, 'Rejected: missing required fields');
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Missing required fields',
        required: ['portal', 'portal_id', 'country', 'data'],
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

    if (typeof portal_id !== 'string' || portal_id.length > 500) {
      request.log.warn({ portal_id: String(portal_id).substring(0, 50), ip: request.ip }, 'Rejected: invalid portal_id');
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'portal_id must be a string (max 500 chars)',
      });
    }

    if (typeof country !== 'string' || country.length > 50 || !/^[a-z_]+$/.test(country)) {
      request.log.warn({ country, ip: request.ip }, 'Rejected: invalid country format');
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'country must be a lowercase string with only letters and underscores',
      });
    }

    try {
      // Push to internal queue for batch processing
      const queue = getInternalQueue();
      await queue.add('ingest-property', { ...request.body, request_id: request.id }, {
        jobId: `${portal}:${portal_id}:${(data as any).property_category || 'unknown'}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      // Respond immediately (202 Accepted)
      return reply.status(202).send({
        status: 'accepted',
        message: 'Property queued for ingestion',
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to queue property for ingestion',
      });
    }
  });
}
