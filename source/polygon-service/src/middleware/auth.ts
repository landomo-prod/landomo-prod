/**
 * API Key Authentication Middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers['x-api-key'] as string;

  if (!apiKey) {
    return reply.code(401).send({ error: 'Missing API key' });
  }

  if (!config.auth.apiKeys.includes(apiKey)) {
    return reply.code(403).send({ error: 'Invalid API key' });
  }
}
