/**
 * Redis-based Sliding Window Rate Limiter
 *
 * Per-API-key rate limiting using a sorted set sliding window in Redis.
 * Returns standard rate limit headers on every response and 429 when exceeded.
 *
 * Limits:
 *   - POST /api/v1/properties/bulk-ingest: 1000 req/min per API key
 *   - POST /api/v1/properties/ingest:      100 req/min per API key
 *   - POST /api/v1/checksums/compare:      6000 req/min per API key
 *   - POST /api/v1/checksums/update:       6000 req/min per API key
 *   - Other authenticated endpoints:        200 req/min per API key (default)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

/** Rate limit configuration per endpoint pattern */
interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMITS: Record<string, RateLimitRule> = {
  '/api/v1/properties/bulk-ingest': { windowMs: 60_000, maxRequests: 1000 },
  '/api/v1/properties/ingest': { windowMs: 60_000, maxRequests: 100 },
  '/api/v1/checksums/compare': { windowMs: 60_000, maxRequests: 6000 },
  '/api/v1/checksums/update': { windowMs: 60_000, maxRequests: 6000 },
  default: { windowMs: 60_000, maxRequests: 200 },
};

let redisClient: RedisClientType | null = null;
let redisAvailable = false;

/**
 * Initialize the Redis client for rate limiting.
 * Call once at startup. Rate limiting degrades gracefully if Redis is unavailable.
 */
export async function initRateLimitRedis(): Promise<void> {
  try {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 3_000,
        reconnectStrategy(retries) {
          if (retries > 5) return new Error('Max reconnect attempts reached');
          return Math.min(retries * 500, 3_000);
        },
      },
      password: config.redis.password || undefined,
    });

    redisClient.on('error', () => {
      redisAvailable = false;
    });
    redisClient.on('ready', () => {
      redisAvailable = true;
    });

    await redisClient.connect();
    redisAvailable = true;
  } catch {
    redisAvailable = false;
  }
}

/**
 * Resolve which rate limit rule applies to this request URL.
 */
function resolveRule(url: string): RateLimitRule {
  for (const [pattern, rule] of Object.entries(RATE_LIMITS)) {
    if (pattern !== 'default' && url.startsWith(pattern)) {
      return rule;
    }
  }
  return RATE_LIMITS.default;
}

/**
 * Build a Redis key for the rate limit bucket.
 * Format: rl:ingest:<apiKeyVersion>:<endpoint-bucket>
 */
function buildKey(request: FastifyRequest, bucketName: string): string {
  const keyVersion = (request as any).apiKeyVersion || 'unknown';
  return `rl:ingest:${keyVersion}:${bucketName}`;
}

/**
 * Determine a short bucket name from the URL so similar endpoints share a bucket.
 */
function bucketName(url: string): string {
  if (url.startsWith('/api/v1/properties/bulk-ingest')) return 'bulk-ingest';
  if (url.startsWith('/api/v1/properties/ingest')) return 'ingest';
  if (url.startsWith('/api/v1/checksums/compare')) return 'checksums-compare';
  if (url.startsWith('/api/v1/checksums/update')) return 'checksums-update';
  if (url.startsWith('/api/v1/scrape-runs')) return 'scrape-runs';
  return 'other';
}

/**
 * Set rate limit response headers.
 */
function setHeaders(reply: FastifyReply, limit: number, remaining: number, resetEpochSeconds: number): void {
  reply.header('X-RateLimit-Limit', String(limit));
  reply.header('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  reply.header('X-RateLimit-Reset', String(resetEpochSeconds));
}

/**
 * Rate limiter onRequest hook.
 *
 * Uses a Redis sorted set sliding window:
 *   - Each request adds a member with score = timestamp
 *   - Expired entries (outside the window) are removed
 *   - Count of remaining entries determines whether the limit is exceeded
 *
 * If Redis is unavailable, the request is allowed (fail-open).
 */
export async function rateLimiterHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip rate limiting for health and metrics endpoints
  if (request.url === '/api/v1/health' || request.url === '/metrics') {
    return;
  }

  // Fail open if Redis is unavailable
  if (!redisClient || !redisAvailable) {
    return;
  }

  const rule = resolveRule(request.url);
  const key = buildKey(request, bucketName(request.url));
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const resetEpochSeconds = Math.ceil((now + rule.windowMs) / 1000);

  try {
    // Use a pipeline for atomicity and performance
    const pipeline = redisClient.multi();

    // Remove entries outside the current window
    pipeline.zRemRangeByScore(key, 0, windowStart);

    // Count entries in the current window
    pipeline.zCard(key);

    // Add the current request
    pipeline.zAdd(key, { score: now, value: `${now}:${Math.random().toString(36).slice(2, 8)}` });

    // Set TTL so keys self-clean (window duration + 1s buffer)
    pipeline.expire(key, Math.ceil(rule.windowMs / 1000) + 1);

    const results = await pipeline.exec();

    // results[1] is the zCard result (count before adding the current request)
    const currentCount = (results[1] as number) || 0;
    const remaining = rule.maxRequests - currentCount - 1;

    setHeaders(reply, rule.maxRequests, remaining, resetEpochSeconds);

    if (currentCount >= rule.maxRequests) {
      const retryAfterSeconds = Math.ceil(rule.windowMs / 1000);
      reply.header('Retry-After', String(retryAfterSeconds));

      request.log.warn({
        reason: 'rate_limit_exceeded',
        key,
        currentCount,
        limit: rule.maxRequests,
        ip: request.ip,
      }, 'Rate limit exceeded for API key');

      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit of ${rule.maxRequests} requests per ${rule.windowMs / 1000}s exceeded`,
        retryAfter: retryAfterSeconds,
      });
    }
  } catch {
    // Fail open on Redis errors - do not block legitimate requests
  }
}
