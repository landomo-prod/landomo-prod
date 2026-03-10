/**
 * Redis-based Sliding Window Rate Limiter (Search Service)
 *
 * Per-IP rate limiting using a sorted set sliding window in Redis.
 * Returns standard rate limit headers on every response and 429 when exceeded.
 *
 * Limits:
 *   - POST /api/v1/search:     60 req/min per IP
 *   - POST /api/v1/search/geo: 30 req/min per IP
 *   - Other endpoints:          120 req/min per IP (default)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';

/** Rate limit configuration per endpoint pattern */
interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

/** Order matters: more specific routes must come first */
const RATE_LIMITS: Array<{ pattern: string; rule: RateLimitRule }> = [
  { pattern: '/api/v1/search/geo', rule: { windowMs: 60_000, maxRequests: 30 } },
  { pattern: '/api/v1/search', rule: { windowMs: 60_000, maxRequests: 60 } },
];

const DEFAULT_RULE: RateLimitRule = { windowMs: 60_000, maxRequests: 120 };

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
  for (const { pattern, rule } of RATE_LIMITS) {
    if (url.startsWith(pattern)) {
      return rule;
    }
  }
  return DEFAULT_RULE;
}

/**
 * Determine a short bucket name from the URL.
 */
function bucketName(url: string): string {
  if (url.startsWith('/api/v1/search/geo')) return 'geo';
  if (url.startsWith('/api/v1/search')) return 'search';
  if (url.startsWith('/api/v1/properties')) return 'property';
  if (url.startsWith('/api/v1/aggregations')) return 'aggregations';
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

  // Skip rate limiting when RATE_LIMIT_DISABLED env var is set (e.g. load tests)
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return;
  }

  // Fail open if Redis is unavailable
  if (!redisClient || !redisAvailable) {
    return;
  }

  const rule = resolveRule(request.url);
  const clientIp = request.headers['x-real-ip'] as string || request.ip;
  const bucket = bucketName(request.url);
  const key = `rl:search:${clientIp}:${bucket}`;
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const resetEpochSeconds = Math.ceil((now + rule.windowMs) / 1000);

  try {
    const pipeline = redisClient.multi();

    // Remove entries outside the current window
    pipeline.zRemRangeByScore(key, 0, windowStart);

    // Count entries in the current window
    pipeline.zCard(key);

    // Add the current request
    pipeline.zAdd(key, { score: now, value: `${now}:${Math.random().toString(36).slice(2, 8)}` });

    // Set TTL so keys self-clean
    pipeline.expire(key, Math.ceil(rule.windowMs / 1000) + 1);

    const results = await pipeline.exec();

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
        ip: clientIp,
      }, 'Rate limit exceeded for IP');

      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit of ${rule.maxRequests} requests per ${rule.windowMs / 1000}s exceeded`,
        retryAfter: retryAfterSeconds,
      });
    }
  } catch {
    // Fail open on Redis errors
  }
}
