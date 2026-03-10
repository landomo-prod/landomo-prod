import { Worker, Job } from 'bullmq';
import { getChannel } from '../channels';
import { getSupabaseAdmin } from '../supabase-client';
import { NotificationPayload, ChannelConfig, SendResult } from '../channels/types';
import { config } from '../config';
import { logger } from '../logger';
import { dispatchedTotal } from '../metrics';
import { createBreaker } from '../circuit-breaker';

type DigestPeriod = 'hourly' | 'daily' | 'weekly';

interface DigestJobData {
  period: DigestPeriod;
}

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 100;

// Per-channel circuit breakers for digest sends (lazily created)
const digestBreakers = new Map<string, ReturnType<typeof createBreaker<SendResult>>>();

function getDigestBreaker(channelName: string) {
  let breaker = digestBreakers.get(channelName);
  if (!breaker) {
    breaker = createBreaker<SendResult>(
      async (payloads: NotificationPayload[], channelConfig: ChannelConfig, period: DigestPeriod) => {
        const channel = getChannel(channelName);
        if (!channel) throw new Error(`Unknown channel: ${channelName}`);
        const result = await channel.sendDigest(payloads, channelConfig, period);
        if (!result.success) throw new Error(result.error || 'sendDigest failed');
        return result;
      },
      `channel-digest-${channelName}`
    );
    digestBreakers.set(channelName, breaker);
  }
  return breaker;
}

export function startDigestWorker(): Worker {
  const worker = new Worker<DigestJobData>(
    `notify-digest-${config.country}`,
    async (job: Job<DigestJobData>) => {
      const { period } = job.data;
      logger.info({ period }, 'running digest');

      const supabase = getSupabaseAdmin();

      const cutoff = new Date();
      if (period === 'hourly') {
        cutoff.setHours(cutoff.getHours() - 1);
      } else if (period === 'daily') {
        cutoff.setHours(cutoff.getHours() - 24);
      } else {
        cutoff.setDate(cutoff.getDate() - 7);
      }

      // 1. Paginated watchdog fetch (Supabase caps at 1000 rows)
      const allWatchdogs: any[] = [];
      let offset = 0;
      while (true) {
        const { data: page, error: wErr } = await supabase
          .from('watchdogs')
          .select('id, user_id, name, channels')
          .eq('country', config.country)
          .eq('frequency', period)
          .eq('active', true)
          .eq('muted', false)
          .range(offset, offset + PAGE_SIZE - 1);

        if (wErr) {
          throw new Error(`Failed to fetch watchdogs: ${wErr.message}`);
        }

        if (!page || page.length === 0) break;
        allWatchdogs.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      if (allWatchdogs.length === 0) {
        logger.info({ period }, 'no watchdogs found for digest period');
        return { processed: 0 };
      }

      logger.info({ period, watchdog_count: allWatchdogs.length }, 'fetched watchdogs');

      // 2. Batch fetch notifications for all watchdogs
      const watchdogIds = allWatchdogs.map((w) => w.id);
      const allNotifications: any[] = [];
      for (let i = 0; i < watchdogIds.length; i += CHUNK_SIZE) {
        const chunk = watchdogIds.slice(i, i + CHUNK_SIZE);
        const { data, error: nErr } = await supabase
          .from('notifications')
          .select('*')
          .in('watchdog_id', chunk)
          .eq('read', false)
          .eq('is_digest', true)
          .gte('created_at', cutoff.toISOString())
          .order('created_at', { ascending: false });

        if (nErr) {
          logger.error({ err: nErr.message, chunk_index: i }, 'failed to batch-fetch notifications');
          continue;
        }
        if (data) allNotifications.push(...data);
      }

      // Group notifications by watchdog_id
      const notificationsByWatchdog = new Map<string, any[]>();
      for (const n of allNotifications) {
        let arr = notificationsByWatchdog.get(n.watchdog_id);
        if (!arr) {
          arr = [];
          notificationsByWatchdog.set(n.watchdog_id, arr);
        }
        arr.push(n);
      }

      // Cap notifications per watchdog to prevent massive digest emails
      const MAX_PER_WATCHDOG = 50;
      for (const [wdId, notifications] of notificationsByWatchdog) {
        if (notifications.length > MAX_PER_WATCHDOG) {
          notificationsByWatchdog.set(wdId, notifications.slice(0, MAX_PER_WATCHDOG));
        }
      }

      // 3. Batch fetch user_channels for all unique users
      const uniqueUserIds = [...new Set(allWatchdogs.map((w) => w.user_id))];
      const allChannelConfigs: any[] = [];
      for (let i = 0; i < uniqueUserIds.length; i += CHUNK_SIZE) {
        const chunk = uniqueUserIds.slice(i, i + CHUNK_SIZE);
        const { data, error: cErr } = await supabase
          .from('user_channels')
          .select('user_id, channel_type, channel_config, verified')
          .in('user_id', chunk)
          .eq('verified', true);

        if (cErr) {
          logger.error({ err: cErr.message, chunk_index: i }, 'failed to batch-fetch user_channels');
          continue;
        }
        if (data) allChannelConfigs.push(...data);
      }

      // Group channels by user_id -> channel_type -> channel_config
      const channelsByUser = new Map<string, Map<string, any>>();
      for (const cc of allChannelConfigs) {
        let userMap = channelsByUser.get(cc.user_id);
        if (!userMap) {
          userMap = new Map();
          channelsByUser.set(cc.user_id, userMap);
        }
        userMap.set(cc.channel_type, cc.channel_config || {});
      }

      logger.info(
        { period, notifications: allNotifications.length, users_with_channels: channelsByUser.size },
        'batch data fetched'
      );

      // 4. Iterate watchdogs and send digests using pre-fetched data
      let totalSent = 0;
      const readNotificationIds: string[] = [];

      for (const watchdog of allWatchdogs) {
        const notifications = notificationsByWatchdog.get(watchdog.id);
        if (!notifications || notifications.length === 0) continue;

        // Convert to NotificationPayload[]
        const payloads: NotificationPayload[] = notifications.map((n: any) => ({
          notification_id: n.id,
          user_id: n.user_id,
          watchdog_id: n.watchdog_id,
          watchdog_name: watchdog.name || '',
          event_type: n.event_type,
          title: n.title,
          message: n.message,
          property_id: n.property_id,
          property_snapshot: n.property_snapshot || {},
        }));

        // Send digest through each channel configured on this watchdog
        const channelNames = Array.isArray(watchdog.channels) ? watchdog.channels : [];
        let anySendSucceeded = false;

        for (const channelName of channelNames) {
          if (!getChannel(channelName)) continue;

          // Look up channel config from pre-fetched data (skip for in_app)
          let channelConfig = {};
          if (channelName !== 'in_app') {
            const userChannels = channelsByUser.get(watchdog.user_id);
            if (!userChannels || !userChannels.has(channelName)) continue;
            channelConfig = userChannels.get(channelName);
          }

          let result: SendResult;
          try {
            const breaker = getDigestBreaker(channelName);
            result = await breaker.fire(payloads, channelConfig, period) as SendResult;
          } catch (err) {
            const msg = (err as Error).message || String(err);
            result = {
              success: false,
              error: msg.includes('Breaker is open') ? 'Circuit open' : msg,
            };
          }

          if (result.success) {
            anySendSucceeded = true;
            totalSent++;
            dispatchedTotal.inc({ country: config.country, channel: channelName, status: 'success' });
            logger.info(
              { period, watchdog_id: watchdog.id, watchdog_name: watchdog.name, channel: channelName, items: payloads.length },
              'digest sent'
            );
          } else {
            dispatchedTotal.inc({ country: config.country, channel: channelName, status: 'failed' });
            logger.error(
              { period, watchdog_id: watchdog.id, channel: channelName, err: result.error },
              'digest delivery failed'
            );
          }
        }

        // Collect notification IDs for batch mark-as-read
        if (anySendSucceeded) {
          for (const n of notifications) {
            readNotificationIds.push(n.id);
          }
        }
      }

      // 5. Batch mark notifications as read
      for (let i = 0; i < readNotificationIds.length; i += CHUNK_SIZE) {
        const chunk = readNotificationIds.slice(i, i + CHUNK_SIZE);
        const { error: uErr } = await supabase
          .from('notifications')
          .update({ read: true })
          .in('id', chunk);

        if (uErr) {
          logger.error({ err: uErr.message, chunk_index: i }, 'failed to batch-update notifications as read');
        }
      }

      logger.info({ period, total_sent: totalSent, marked_read: readNotificationIds.length }, 'digest complete');
      return { processed: totalSent };
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ job_id: job?.id, err: err.message }, 'digest job failed');
  });

  return worker;
}
