import Redis from 'ioredis';
import { PropertyChangeEvent } from '@landomo/core';
import { Queue } from 'bullmq';
import { getSupabaseAdmin, WatchdogRow, NotificationInsert } from './supabase-client';
import { config } from './config';
import { logger } from './logger';
import { WatchdogMatch } from './watchdog-evaluator';
import { NotificationPayload } from './channels/types';
import { dispatchedTotal, dedupedTotal } from './metrics';
import { createBreaker } from './circuit-breaker';

const BULK_CHUNK_SIZE = 500;

// Circuit breaker for Supabase bulk inserts (with IDs returned)
const supabaseBulkInsertBreaker = createBreaker(
  async (rows: NotificationInsert[]): Promise<{ id: string }[]> => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('notifications').insert(rows).select('id');
    if (error) throw new Error(`Supabase bulk insert: ${error.message}`);
    return data as { id: string }[];
  },
  'supabase-bulk-insert-with-ids'
);

// Circuit breaker for Supabase bulk inserts (no IDs needed)
const supabaseBulkInsertNoIdBreaker = createBreaker(
  async (rows: NotificationInsert[]): Promise<null> => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw new Error(`Supabase bulk insert: ${error.message}`);
    return null;
  },
  'supabase-bulk-insert-no-ids'
);

interface PreparedMatch {
  match: WatchdogMatch;
  payload: NotificationPayload;
  row: NotificationInsert;
}

/**
 * Routes matched watchdog events to the appropriate delivery path:
 * - instant: create notification + enqueue dispatch jobs per channel
 * - hourly/daily/weekly: create notification marked for digest compilation
 */
export class NotificationRouter {
  private dispatchQueue: Queue;
  private redis: Redis;

  constructor(dispatchQueue: Queue, redis: Redis) {
    this.dispatchQueue = dispatchQueue;
    this.redis = redis;
  }

  async route(matches: WatchdogMatch[]): Promise<{ dispatched: number; deduped: number; capped: number; errors: number }> {
    let dispatched = 0;
    let deduped = 0;
    let capped = 0;
    let errors = 0;

    const instantMatches: PreparedMatch[] = [];
    const digestMatches: PreparedMatch[] = [];
    const triggeredWatchdogIds = new Set<string>();

    // Phase 1: Filter matches through dedup + daily cap, build rows
    for (const match of matches) {
      try {
        // Dedup: don't notify same user about same property + event within window
        const dedupKey = `dedup:${match.watchdog.user_id}:${match.change.property_id}:${match.change.event_type}`;
        const dedupTtl = Math.ceil(config.dispatch.deduplicationWindowMs / 1000);
        const isNew = await this.redis.set(dedupKey, '1', 'EX', dedupTtl, 'NX');
        if (!isNew) {
          deduped++;
          dedupedTotal.inc({ country: config.country });
          continue;
        }

        // Daily cap check (read-only — actual INCR deferred until after successful insert)
        const capKey = `notify:cap:${match.watchdog.id}:${new Date().toISOString().slice(0, 10)}`;
        const currentCount = parseInt((await this.redis.get(capKey)) || '0', 10);
        if (match.watchdog.max_notifications_per_day > 0 && currentCount >= match.watchdog.max_notifications_per_day) {
          capped++;
          continue;
        }

        const payload = this.buildPayload(match.watchdog, match.change);
        const isDigest = match.watchdog.frequency !== 'instant';

        const row: NotificationInsert = {
          user_id: payload.user_id,
          watchdog_id: payload.watchdog_id,
          event_type: payload.event_type,
          title: payload.title,
          message: payload.message,
          property_id: payload.property_id,
          property_snapshot: payload.property_snapshot,
          read: false,
          is_digest: isDigest,
        };

        const prepared: PreparedMatch = { match, payload, row };

        if (isDigest) {
          digestMatches.push(prepared);
        } else {
          instantMatches.push(prepared);
        }
      } catch (err) {
        logger.error(
          { watchdog_id: match.watchdog.id, err: (err as Error).message },
          'failed to prepare match'
        );
        errors++;
      }
    }

    // Phase 2: Bulk insert digest notifications (no IDs needed)
    for (let i = 0; i < digestMatches.length; i += BULK_CHUNK_SIZE) {
      const chunk = digestMatches.slice(i, i + BULK_CHUNK_SIZE);
      try {
        await supabaseBulkInsertNoIdBreaker.fire(chunk.map((p) => p.row));
        dispatched += chunk.length;
        // Increment daily caps now that insert succeeded
        for (const p of chunk) {
          const date = new Date().toISOString().slice(0, 10);
          const ck = `notify:cap:${p.match.watchdog.id}:${date}`;
          const capPipeline = this.redis.pipeline();
          capPipeline.incr(ck);
          capPipeline.expire(ck, 90000); // 25 hours
          await capPipeline.exec();
          dispatchedTotal.inc({ country: config.country, channel: 'digest', status: 'success' });
          triggeredWatchdogIds.add(p.match.watchdog.id);
        }
      } catch (err) {
        logger.error({ err: (err as Error).message, count: chunk.length }, 'failed bulk insert digest');
        errors += chunk.length;
      }
    }

    // Phase 3: Bulk insert instant notifications (need IDs for dispatch)
    for (let i = 0; i < instantMatches.length; i += BULK_CHUNK_SIZE) {
      const chunk = instantMatches.slice(i, i + BULK_CHUNK_SIZE);
      try {
        const ids = await supabaseBulkInsertBreaker.fire(chunk.map((p) => p.row)) as { id: string }[];

        // Increment daily caps now that insert succeeded
        for (const p of chunk) {
          const date = new Date().toISOString().slice(0, 10);
          const ck = `notify:cap:${p.match.watchdog.id}:${date}`;
          const capPipeline = this.redis.pipeline();
          capPipeline.incr(ck);
          capPipeline.expire(ck, 90000); // 25 hours
          await capPipeline.exec();
        }

        // Map returned IDs to payloads and collect dispatch jobs
        const dispatchPromises: Promise<unknown>[] = [];
        for (let j = 0; j < chunk.length; j++) {
          const notificationId = ids[j].id;
          const { match: m, payload } = chunk[j];
          payload.notification_id = notificationId;

          dispatched++;
          dispatchedTotal.inc({ country: config.country, channel: 'in_app', status: 'success' });
          triggeredWatchdogIds.add(m.watchdog.id);

          // Collect dispatch jobs for each non-in-app channel
          const externalChannels = m.watchdog.channels.filter((ch) => ch !== 'in_app');
          for (const channel of externalChannels) {
            dispatchPromises.push(
              this.dispatchQueue.add(
                `dispatch-${channel}`,
                { notification_id: notificationId, channel, payload },
                {
                  attempts: 3,
                  backoff: { type: 'exponential', delay: 2000 },
                  removeOnComplete: { age: 3600, count: 1000 },
                  removeOnFail: { age: 86400, count: 500 },
                }
              )
            );
          }
        }

        // Enqueue all dispatch jobs concurrently
        const dispatchResults = await Promise.allSettled(dispatchPromises);
        const dispatchFailures = dispatchResults.filter((r) => r.status === 'rejected');
        if (dispatchFailures.length > 0) {
          logger.error(
            { count: dispatchFailures.length },
            `[notification-router] ${dispatchFailures.length} dispatch jobs failed to enqueue`
          );
        }
      } catch (err) {
        logger.error({ err: (err as Error).message, count: chunk.length }, 'failed bulk insert instant');
        errors += chunk.length;
      }
    }

    // Batch update last_triggered_at for all watchdogs that were notified
    if (triggeredWatchdogIds.size > 0) {
      const ids = Array.from(triggeredWatchdogIds);
      const supabase = getSupabaseAdmin();
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        try {
          await supabase
            .from('watchdogs')
            .update({ last_triggered_at: new Date().toISOString() })
            .in('id', chunk);
        } catch (err) {
          logger.error(
            { err: (err as Error).message, count: chunk.length },
            'Failed to update last_triggered_at for watchdogs'
          );
        }
      }
    }

    return { dispatched, deduped, capped, errors };
  }

  private buildPayload(watchdog: WatchdogRow, change: PropertyChangeEvent): NotificationPayload {
    const title = buildTitle(change);
    const message = buildMessage(change);

    return {
      notification_id: '', // Will be set after insert
      user_id: watchdog.user_id,
      watchdog_id: watchdog.id,
      watchdog_name: watchdog.name,
      event_type: change.event_type,
      title,
      message,
      property_id: change.property_id,
      property_snapshot: {
        ...change.filter_snapshot,
        price: change.price,
        old_price: change.old_price,
        city: change.city,
        source_url: change.source_url,
        images: change.images,
      },
    };
  }

}

/** Build a human-readable notification title from a property change event. */
export function buildTitle(change: PropertyChangeEvent): string {
  switch (change.event_type) {
    case 'new_listing':
      return `New ${change.property_category} in ${change.city}`;
    case 'price_drop': {
      const pct = change.old_price
        ? Math.round(((change.old_price - change.price) / change.old_price) * 100)
        : 0;
      return `Price dropped ${pct}% — ${change.city}`;
    }
    case 'price_increase':
      return `Price increased — ${change.city}`;
    case 'status_removed':
      return `Listing removed — ${change.city}`;
    case 'reactivated':
      return `Listing reactivated — ${change.city}`;
    default:
      return `Property update — ${change.city}`;
  }
}

/** Build a human-readable notification message from a property change event. */
export function buildMessage(change: PropertyChangeEvent): string {
  const priceStr = change.price.toLocaleString('cs-CZ');
  const currency = change.filter_snapshot.currency || 'CZK';

  switch (change.event_type) {
    case 'new_listing':
      return `New ${change.property_category} listed at ${priceStr} ${currency} in ${change.city}`;
    case 'price_drop': {
      const oldStr = change.old_price?.toLocaleString('cs-CZ') || '?';
      return `Price dropped from ${oldStr} to ${priceStr} ${currency}`;
    }
    case 'price_increase': {
      const oldStr = change.old_price?.toLocaleString('cs-CZ') || '?';
      return `Price increased from ${oldStr} to ${priceStr} ${currency}`;
    }
    case 'status_removed':
      return `A ${change.property_category} at ${priceStr} ${currency} was removed`;
    case 'reactivated':
      return `A ${change.property_category} at ${priceStr} ${currency} was reactivated`;
    default:
      return `Property updated: ${priceStr} ${currency}`;
  }
}
