import { FastifyInstance } from 'fastify';
import { triggerTrainingNow } from '../services/training-scheduler';
import { modelLog } from '../logger';

const log = modelLog.child({ module: 'training-route' });

export async function trainingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/v1/train', async (_request, reply) => {
    log.info('Manual training triggered via API');

    // Run async — don't block the request
    triggerTrainingNow().catch((err) => {
      log.error({ err }, 'Manual training cycle failed');
    });

    return reply.status(202).send({
      status: 'accepted',
      message: 'Training cycle started. Check logs for progress.',
    });
  });
}
