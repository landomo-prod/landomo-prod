import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import * as crypto from 'crypto';
import { cacheLog } from '../logger';

let redisClient: RedisClientType | null = null;
let subscriberClient: RedisClientType | null = null;

export async function initializeRedis(): Promise<void> {
  cacheLog.info('Initializing Redis connection');

  redisClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
    password: config.redis.password,
  });

  redisClient.on('error', (err) => {
    cacheLog.error({ err }, 'Redis client error');
  });

  redisClient.on('connect', () => {
    cacheLog.info('Connected to Redis');
  });

  await redisClient.connect();
}

export async function initializeSubscriber(
  onModelUpdated: (country: string, category: string) => Promise<void>
): Promise<void> {
  cacheLog.info('Initializing Redis pub/sub subscriber');

  subscriberClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
    password: config.redis.password,
  });

  subscriberClient.on('error', (err) => {
    cacheLog.error({ err }, 'Redis subscriber error');
  });

  await subscriberClient.connect();

  await subscriberClient.pSubscribe('ml:model:updated:*', (_message, channel) => {
    // Channel format: ml:model:updated:{country}:{category}
    const parts = channel.split(':');
    const country = parts[3];
    const category = parts[4];
    if (country && category) {
      cacheLog.info({ country, category, channel }, 'Received model update notification');
      onModelUpdated(country, category).catch((err) => {
        cacheLog.error({ err, country, category }, 'Failed to handle model update');
      });
    }
  });

  cacheLog.info('Subscribed to model update channel');
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
  }
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  cacheLog.info('Redis connections closed');
}

export function generateCacheKey(prefix: string, data: unknown): string {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `${prefix}:${hash}`;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedisClient();
  await client.setEx(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    cacheLog.error({ key }, 'Error parsing cached value');
    return null;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(keys);
  }
}
