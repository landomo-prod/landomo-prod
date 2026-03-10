/**
 * Request ID Middleware
 * Sets X-Request-ID on response headers for end-to-end correlation.
 * The genReqId function in logger.ts already extracts X-Request-ID from
 * incoming request headers and assigns it to request.id.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * onRequest hook: returns X-Request-ID in the response so callers can correlate.
 */
export async function requestIdOnRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.header('X-Request-ID', request.id);
}
