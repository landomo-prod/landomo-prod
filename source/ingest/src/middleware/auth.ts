/**
 * API Key Authentication Middleware
 * Supports versioned keys with expiry tracking.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { config, ApiKeyEntry } from '../config';
import { authLog } from '../logger';

/**
 * Timing-safe comparison of two strings.
 * Prevents timing attacks by ensuring comparison takes constant time
 * regardless of where strings differ.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against self to burn the same time, then return false
    const buf = Buffer.from(a);
    timingSafeEqual(buf, buf);
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Find the matching API key entry using timing-safe comparison.
 * Returns the matched entry or null.
 */
export function findMatchingKey(token: string): ApiKeyEntry | null {
  let matched: ApiKeyEntry | null = null;
  // Always iterate all keys to avoid timing leaks
  for (const entry of config.auth.apiKeys) {
    if (timingSafeCompare(token, entry.key)) {
      matched = entry;
    }
  }
  return matched;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth for health, metrics, and version discovery endpoints
  if (request.url === '/api/v1/health' || request.url === '/metrics' || request.url === '/api/versions') {
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    authLog.warn({ url: request.url, method: request.method }, 'Missing or invalid Authorization header');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.substring(7);
  const matched = findMatchingKey(token);

  if (!matched) {
    authLog.warn({ url: request.url, method: request.method }, 'Invalid API key');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  // Check expiry
  if (matched.expiresAt && matched.expiresAt.getTime() < Date.now()) {
    authLog.warn({ url: request.url, keyVersion: matched.version }, 'Expired API key used');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key has expired',
    });
  }

  // Log which key version was used (never log the key itself)
  request.log.info({ keyVersion: matched.version, country: config.instance.country }, 'Authenticated request');

  // Attach key metadata to request for downstream use
  (request as any).apiKeyVersion = matched.version;
  (request as any).apiKeyExpiresAt = matched.expiresAt;

  // Set response header with key version
  reply.header('X-API-Key-Version', matched.version);
}
