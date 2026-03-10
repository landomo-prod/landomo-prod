/**
 * API Versions Route
 * GET /api/versions - Returns supported API versions and their status
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getApiVersions } from '../middleware/api-version';

export async function apiVersionsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/versions', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send(getApiVersions());
  });
}
