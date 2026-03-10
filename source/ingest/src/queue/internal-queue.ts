/**
 * Internal Queue for Batch Processing
 *
 * Queue name is per-country to prevent cross-country job routing
 * when multiple country workers share the same Redis instance.
 */

import { Queue } from 'bullmq';
import { config } from '../config';

const QUEUE_NAME = `ingest-property-${config.instance.country}`;

let queue: Queue | null = null;

export function getInternalQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 1000,
          age: 86400, // 24 hours
        },
        removeOnFail: {
          count: 500,
          age: 86400, // 24 hours
        },
      },
    });
  }

  return queue;
}

export async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
