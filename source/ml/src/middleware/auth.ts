import { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { config, ApiKeyEntry } from '../config';
import { authLog } from '../logger';

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const buf = Buffer.from(a);
    timingSafeEqual(buf, buf);
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function findMatchingKey(token: string): ApiKeyEntry | null {
  let matched: ApiKeyEntry | null = null;
  for (const entry of config.auth.apiKeys) {
    if (timingSafeCompare(token, entry.key)) {
      matched = entry;
    }
  }
  return matched;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.url === '/api/v1/health' || request.url === '/metrics') {
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    authLog.warn({ url: request.url, method: request.method }, 'Missing or invalid Authorization header');
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);
  const matched = findMatchingKey(token);

  if (!matched) {
    authLog.warn({ url: request.url, method: request.method }, 'Invalid API key');
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  if (matched.expiresAt && matched.expiresAt.getTime() < Date.now()) {
    authLog.warn({ url: request.url, keyVersion: matched.version }, 'Expired API key used');
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key has expired',
    });
    return;
  }

  request.log.info({ keyVersion: matched.version }, 'Authenticated request');
  (request as unknown as Record<string, unknown>).apiKeyVersion = matched.version;
  reply.header('X-API-Key-Version', matched.version);
}
