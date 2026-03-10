/**
 * API Versions Route
 * GET /api/versions - Returns supported API versions and their status
 */

import { FastifyInstance } from 'fastify';
import { getApiVersions } from '../middleware/api-version';

export async function apiVersionsRoute(fastify: FastifyInstance) {
  fastify.get('/api/versions', async (_request, reply) => {
    return reply.status(200).send(getApiVersions());
  });
}
