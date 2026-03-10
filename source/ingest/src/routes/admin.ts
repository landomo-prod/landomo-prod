/**
 * Admin Routes
 * Protected endpoints for triggering maintenance operations.
 */

import { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { config } from '../config';

export async function adminRoute(fastify: FastifyInstance) {
  // POST /api/v1/admin/dedup-backfill — trigger one-time dedup backfill
  fastify.post('/api/v1/admin/dedup-backfill', async (request, reply) => {
    const queueName = `dedup-backfill-${config.instance.country}`;
    const queue = new Queue(queueName, {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
    });

    try {
      const job = await queue.add('dedup-backfill', {
        country: config.instance.country,
      });

      return reply.status(202).send({
        status: 'accepted',
        message: 'Dedup backfill job queued',
        jobId: job.id,
      });
    } finally {
      await queue.close();
    }
  });
}
