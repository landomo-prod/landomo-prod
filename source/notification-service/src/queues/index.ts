import { Queue } from 'bullmq';
import { config } from '../config';

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export function createEvaluateQueue(): Queue {
  return new Queue(`notify-evaluate-${config.country}`, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 86400, count: 200 },
    },
  });
}

export function createDispatchQueue(): Queue {
  return new Queue(`notify-dispatch-${config.country}`, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400, count: 500 },
    },
  });
}

export function createDigestQueue(): Queue {
  return new Queue(`notify-digest-${config.country}`, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 86400, count: 100 },
    },
  });
}
