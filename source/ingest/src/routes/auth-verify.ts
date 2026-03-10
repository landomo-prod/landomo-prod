/**
 * Auth Verify Route
 * Allows scrapers to verify their API key is still valid and see metadata.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config';

export async function authVerifyRoute(fastify: FastifyInstance) {
  fastify.get('/api/v1/auth/verify', async (request: FastifyRequest) => {
    // Auth middleware already validated the key and attached metadata
    const version = (request as any).apiKeyVersion as string;
    const expiresAt = (request as any).apiKeyExpiresAt as Date | null;

    const response: Record<string, unknown> = {
      valid: true,
      version,
      country: config.instance.country,
    };

    if (expiresAt) {
      response.expiresAt = expiresAt.toISOString();
      const remaining = expiresAt.getTime() - Date.now();
      response.expiresInDays = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    }

    return response;
  });
}
