import Redis from 'ioredis';

export interface QueueDepth {
  waiting: number;
  active: number;
  delayed: number;
  total: number;
}

const QUEUE_NAME = 'ingest-property';
const QUEUE_DEPTH_THRESHOLD = Number(process.env.QUEUE_DEPTH_THRESHOLD) || 5000;

let redis: Redis | null = null;
let connected = false;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    redis.on('connect', () => { connected = true; });
    redis.on('close', () => { connected = false; });
    redis.on('error', () => { connected = false; });
  }
  return redis;
}

/**
 * Ensure Redis connection is active. Returns false if cannot connect.
 */
async function ensureConnection(): Promise<boolean> {
  const client = getRedis();
  if (connected) return true;

  try {
    await client.connect();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current BullMQ queue depth for ingest-property queue.
 * Uses BullMQ key conventions: bull:{queueName}:wait, :active, :delayed
 */
export async function getQueueDepth(): Promise<QueueDepth | null> {
  const ok = await ensureConnection();
  if (!ok) return null;

  const client = getRedis();
  try {
    const [waiting, active, delayed] = await Promise.all([
      client.llen(`bull:${QUEUE_NAME}:wait`),
      client.llen(`bull:${QUEUE_NAME}:active`),
      client.zcard(`bull:${QUEUE_NAME}:delayed`),
    ]);

    return {
      waiting,
      active,
      delayed,
      total: waiting + active + delayed,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the system is under backpressure (queue depth exceeds threshold).
 * Returns null if Redis is unreachable (fail-open: don't block on Redis failure).
 */
export async function isBackpressured(): Promise<{ backpressured: boolean; depth: QueueDepth } | null> {
  const depth = await getQueueDepth();
  if (!depth) return null;

  return {
    backpressured: depth.total >= QUEUE_DEPTH_THRESHOLD,
    depth,
  };
}

export function getQueueThreshold(): number {
  return QUEUE_DEPTH_THRESHOLD;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
    connected = false;
  }
}
