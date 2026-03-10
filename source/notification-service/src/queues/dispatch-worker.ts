import { Worker, Job, Queue } from 'bullmq';
import { getChannel } from '../channels';
import { NotificationPayload, ChannelConfig, SendResult } from '../channels/types';
import { getSupabaseAdmin } from '../supabase-client';
import { config } from '../config';
import { logger } from '../logger';
import { dispatchedTotal, dispatchDuration } from '../metrics';
import { createBreaker } from '../circuit-breaker';

interface DispatchJobData {
  notification_id: string;
  channel: string;
  payload: NotificationPayload;
}

// Per-channel circuit breakers (lazily created)
const channelBreakers = new Map<string, ReturnType<typeof createBreaker<SendResult>>>();

function getChannelBreaker(channelName: string) {
  let breaker = channelBreakers.get(channelName);
  if (!breaker) {
    breaker = createBreaker<SendResult>(
      async (payload: NotificationPayload, channelConfig: ChannelConfig) => {
        const channel = getChannel(channelName);
        if (!channel) throw new Error(`Unknown channel: ${channelName}`);
        const result = await channel.send(payload, channelConfig);
        if (!result.success) throw new Error(result.error || 'send failed');
        return result;
      },
      `channel-send-${channelName}`
    );
    channelBreakers.set(channelName, breaker);
  }
  return breaker;
}

export function startDispatchWorker(): Worker {
  const redisConnection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  };

  // Dead letter queue for permanently failed dispatches
  const dlq = new Queue(`notify-dispatch-dlq-${config.country}`, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { age: 604800, count: 5000 }, // 7 days
      removeOnFail: false,
    },
  });

  const worker = new Worker<DispatchJobData>(
    `notify-dispatch-${config.country}`,
    async (job: Job<DispatchJobData>) => {
      const { notification_id, channel: channelName, payload } = job.data;
      const startMs = Date.now();

      if (!getChannel(channelName)) {
        throw new Error(`Unknown channel: ${channelName}`);
      }

      // Get channel config for this user (if needed)
      const supabase = getSupabaseAdmin();
      let channelConfig = {};

      if (channelName !== 'in_app') {
        const { data } = await supabase
          .from('user_channels')
          .select('channel_config, verified')
          .eq('user_id', payload.user_id)
          .eq('channel_type', channelName)
          .single();

        if (!data || !data.verified) {
          logger.info(
            { channel: channelName, user_id: payload.user_id },
            'channel not configured/verified, skipping'
          );
          return { skipped: true, reason: 'not_verified' };
        }

        channelConfig = data.channel_config || {};
      }

      let result: SendResult;
      try {
        const breaker = getChannelBreaker(channelName);
        result = await breaker.fire(payload, channelConfig) as SendResult;
      } catch (err) {
        const msg = (err as Error).message || String(err);
        result = {
          success: false,
          error: msg.includes('Breaker is open') ? 'Circuit open' : msg,
        };
      }

      const durationSec = (Date.now() - startMs) / 1000;
      dispatchDuration.observe({ country: config.country, channel: channelName }, durationSec);

      // Log delivery
      await supabase.from('delivery_log').insert({
        notification_id,
        channel: channelName,
        status: result.success ? 'sent' : 'failed',
        external_id: result.external_id,
        error: result.error,
        attempts: job.attemptsMade + 1,
        sent_at: result.success ? new Date().toISOString() : null,
      });

      if (!result.success) {
        dispatchedTotal.inc({ country: config.country, channel: channelName, status: 'failed' });
        throw new Error(`Delivery failed: ${result.error}`);
      }

      dispatchedTotal.inc({ country: config.country, channel: channelName, status: 'success' });
      return { success: true, external_id: result.external_id };
    },
    {
      connection: redisConnection,
      concurrency: config.dispatch.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ job_id: job?.id, err: err.message }, 'dispatch job failed');

    // Move to DLQ after final attempt (3 attempts configured)
    if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
      logger.error(
        {
          job_id: job.id,
          attempts: job.attemptsMade,
          channel: job.data.channel,
          user_id: job.data.payload.user_id,
          notification_id: job.data.notification_id,
        },
        'dispatch permanently failed, moving to DLQ'
      );
      dlq.add('dead-letter', {
        originalJobId: job.id,
        ...job.data,
        error: err.message,
        failedAt: new Date().toISOString(),
        attempts: job.attemptsMade,
      }).catch((dlqErr) => {
        logger.error({ err: dlqErr.message }, 'failed to enqueue to DLQ');
      });
    }
  });

  return worker;
}
