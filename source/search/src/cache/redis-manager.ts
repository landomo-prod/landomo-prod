/**
 * Redis Cache Manager
 *
 * Manages Redis connections, caching strategies, and pub/sub for
 * cache invalidation.
 */

import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import * as crypto from 'crypto';
import { cacheLog } from '../logger';

let redisClient: RedisClientType | null = null;
let subscriberClient: RedisClientType | null = null;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  cacheLog.info('Initializing Redis connection');

  redisClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port
    },
    password: config.redis.password
  });

  redisClient.on('error', (err) => {
    cacheLog.error({ err }, 'Redis client error');
  });

  redisClient.on('connect', () => {
    cacheLog.info('Connected to Redis');
  });

  await redisClient.connect();
}

/**
 * Initialize Redis pub/sub subscriber for cache invalidation.
 * Subscribes to `property:updated:*` channels and invalidates
 * the corresponding country caches automatically.
 */
export async function initializeSubscriber(
  onInvalidate: (country: string) => Promise<void>
): Promise<void> {
  cacheLog.info('Initializing Redis pub/sub subscriber');

  subscriberClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port
    },
    password: config.redis.password
  });

  subscriberClient.on('error', (err) => {
    cacheLog.error({ err }, 'Redis subscriber error');
  });

  await subscriberClient.connect();

  // Debounce per-country invalidations: coalesce rapid events into one wipe every 60s.
  // Without this, a running scraper publishes dozens of events/minute and the search
  // cache never survives long enough to be useful.
  const INVALIDATION_DEBOUNCE_MS = 300_000; // 5 min — matches search cache TTL
  const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>();

  const channelPattern = `${config.cache.invalidationChannel}:*`;
  await subscriberClient.pSubscribe(channelPattern, (_message, channel) => {
    // Channel format: property:updated:<country>
    const parts = channel.split(':');
    const country = parts[parts.length - 1];
    if (country) {
      if (pendingInvalidations.has(country)) {
        // Already scheduled — reset timer to debounce further
        clearTimeout(pendingInvalidations.get(country)!);
      }
      const timer = setTimeout(() => {
        pendingInvalidations.delete(country);
        cacheLog.info({ country, channel }, 'Received cache invalidation via pub/sub');
        onInvalidate(country).catch((err) => {
          cacheLog.error({ err, country }, 'Failed to invalidate cache from pub/sub');
        });
      }, INVALIDATION_DEBOUNCE_MS);
      pendingInvalidations.set(country, timer);
    }
  });

  cacheLog.info({ channelPattern }, 'Subscribed to cache invalidation channel');
}

/**
 * Get Redis client
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
    cacheLog.info('Redis subscriber connection closed');
  }
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    cacheLog.info('Redis connection closed');
  }
}

/**
 * Generate cache key from object
 */
export function generateCacheKey(prefix: string, data: any): string {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `${prefix}:${hash}`;
}

/**
 * Cache a value with TTL
 */
export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds: number
): Promise<void> {
  const client = getRedisClient();
  const serialized = JSON.stringify(value);
  await client.setEx(key, ttlSeconds, serialized);
}

/**
 * Get cached value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    cacheLog.error({ err: error }, 'Error parsing cached value');
    return null;
  }
}

/**
 * Delete cached value
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

/**
 * Delete multiple cached values by pattern.
 * Uses SCAN instead of KEYS to avoid blocking the Redis event loop.
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  let cursor = 0;
  const keysToDelete: string[] = [];

  do {
    const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = result.cursor;
    keysToDelete.push(...result.keys);
  } while (cursor !== 0);

  if (keysToDelete.length > 0) {
    await client.del(keysToDelete);
  }
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
  const client = getRedisClient();
  const exists = await client.exists(key);
  return exists === 1;
}

/**
 * Get detailed cache statistics including hit rate, key count, and memory usage.
 */
export async function getCacheStats(): Promise<{
  hitRate: number;
  keyspace: { total: number; expires: number };
  memory: { used: string; peak: string };
  stats: { hits: number; misses: number; evictedKeys: number };
  uptime: number;
}> {
  const client = getRedisClient();

  const [statsInfo, memoryInfo, keyspaceInfo, serverInfo] = await Promise.all([
    client.info('stats'),
    client.info('memory'),
    client.info('keyspace'),
    client.info('server'),
  ]);

  function parseInfo(info: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        parsed[key] = value;
      }
    });
    return parsed;
  }

  const stats = parseInfo(statsInfo);
  const memory = parseInfo(memoryInfo);
  const keyspace = parseInfo(keyspaceInfo);
  const server = parseInfo(serverInfo);

  const hits = parseInt(stats.keyspace_hits || '0', 10);
  const misses = parseInt(stats.keyspace_misses || '0', 10);
  const total = hits + misses;
  const hitRate = total > 0 ? hits / total : 0;

  // Parse db0 keyspace: "keys=123,expires=45,avg_ttl=1234"
  let totalKeys = 0;
  let expiringKeys = 0;
  for (const [key, value] of Object.entries(keyspace)) {
    if (key.startsWith('db')) {
      const parts = value.split(',');
      for (const part of parts) {
        const [k, v] = part.split('=');
        if (k === 'keys') totalKeys += parseInt(v, 10);
        if (k === 'expires') expiringKeys += parseInt(v, 10);
      }
    }
  }

  return {
    hitRate: Math.round(hitRate * 10000) / 10000,
    keyspace: { total: totalKeys, expires: expiringKeys },
    memory: {
      used: memory.used_memory_human || 'unknown',
      peak: memory.used_memory_peak_human || 'unknown',
    },
    stats: {
      hits,
      misses,
      evictedKeys: parseInt(stats.evicted_keys || '0', 10),
    },
    uptime: parseInt(server.uptime_in_seconds || '0', 10),
  };
}

/**
 * Flush entire cache (use with caution!)
 */
export async function cacheFlushAll(): Promise<void> {
  const client = getRedisClient();
  await client.flushAll();
  cacheLog.warn('Cache flushed');
}

/**
 * Cross-process cache stampede prevention.
 *
 * On a cache miss, only ONE process computes the result while others wait
 * for the cache to be populated. This prevents N simultaneous DB queries for
 * the same uncached key across N search instances.
 *
 * Flow:
 * 1. Try to acquire a Redis SET NX lock for this key.
 * 2. If acquired:  run compute(), cache the result, release lock.
 * 3. If not acquired: poll the cache every 100 ms (up to 2 s) for the result
 *    written by the lock holder. Fall back to compute() if the lock holder
 *    never writes (crash / eviction).
 */
export async function cacheGetOrCompute<T>(
  cacheKey: string,
  getCached: () => Promise<T | null>,
  compute: () => Promise<T>,
  cacheResult: (result: T) => Promise<void>,
  lockTtlMs = 8_000,
  pollIntervalMs = 100,
  pollMaxMs = 2_000,
): Promise<T> {
  const client = getRedisClient();
  const lockKey = `lock:${cacheKey}`;
  const lockToken = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const acquired = await client.set(lockKey, lockToken, { NX: true, PX: lockTtlMs });

  if (acquired) {
    try {
      const result = await compute();
      await cacheResult(result);
      return result;
    } finally {
      // Release only if we still own the lock (guard against TTL expiry)
      const current = await client.get(lockKey);
      if (current === lockToken) {
        await client.del(lockKey);
      }
    }
  }

  // Another process holds the lock — poll cache until the result appears
  const deadline = Date.now() + pollMaxMs;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    const cached = await getCached();
    if (cached !== null) {
      return cached;
    }
  }

  // Lock holder timed out or crashed — fall back to running the compute ourselves
  cacheLog.warn({ cacheKey }, 'Distributed lock wait timed out, running compute as fallback');
  return compute();
}
