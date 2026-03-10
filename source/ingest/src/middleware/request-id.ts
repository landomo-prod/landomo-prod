/**
 * Request ID Middleware
 * Extracts X-Request-ID from incoming headers (set by nginx or upstream caller),
 * falls back to Fastify's generated request ID, and returns it in the response.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * onRequest hook: ensures request.id is available (already set by genReqId in logger.ts)
 * and stores it for easy access throughout the request lifecycle.
 */
export async function requestIdOnRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Fastify's genReqId (in logger.ts) already extracts X-Request-ID or generates one.
  // We just need to make sure it's returned in the response headers.
  reply.header('X-Request-ID', request.id);
}
