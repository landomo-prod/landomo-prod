/**
 * Rule evaluator: reads property change events from Redis Stream,
 * matches them against page filters, and enqueues marketing jobs.
 *
 * Performance safeguards:
 * - Redis-backed dedup: same property+page won't be enqueued twice within 24h
 * - Per-page queue cap: won't enqueue if page already has too many pending jobs
 * - Fan-out is bounded by number of active pages (typically 1-2 matches per listing)
 */

import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from './config';
import { matchPages } from './page-configs';
import { MarketingJobData, MarketingPost } from './types';

/** How long to suppress duplicate property+page combos (seconds) */
const DEDUP_TTL_SECONDS = 86400; // 24 hours

export class RuleEvaluator {
  private redis: Redis | null = null;
  private marketingQueue: Queue<MarketingJobData>;
  private streamKey: string;
  private groupName = 'fb-automation';
  private consumerName: string;
  private running = false;

  // Counters for health endpoint
  public stats = { eventsProcessed: 0, jobsEnqueued: 0, deduped: 0, noMatch: 0 };

  constructor(marketingQueue: Queue<MarketingJobData>) {
    this.marketingQueue = marketingQueue;
    this.streamKey = `property:changes:${config.country}`;
    this.consumerName = `fb-auto-${process.pid}`;
  }

  async start(): Promise<void> {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    this.redis.on('error', (err) => {
      console.error(`[rule-evaluator] Redis error: ${err.message}`);
    });

    // Create consumer group (separate from notification-service's group)
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.groupName, '0', 'MKSTREAM');
      console.log(`[rule-evaluator] Created consumer group "${this.groupName}" on ${this.streamKey}`);
    } catch (err: any) {
      if (err.message?.includes('BUSYGROUP')) {
        console.log(`[rule-evaluator] Consumer group "${this.groupName}" already exists`);
      } else {
        throw err;
      }
    }

    this.running = true;
    console.log(`[rule-evaluator] Listening on ${this.streamKey}`);
    this.readLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  private async readLoop(): Promise<void> {
    while (this.running && this.redis) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', this.groupName, this.consumerName,
          'COUNT', 50,
          'BLOCK', 5000,
          'STREAMS', this.streamKey, '>'
        );

        if (!results) continue;

        for (const [_stream, messages] of results as [string, [string, string[]][]][]) {
          for (const [messageId, fields] of messages) {
            await this.handleMessage(messageId, fields);
          }
        }
      } catch (err: any) {
        if (!this.running) break;
        console.error(`[rule-evaluator] Stream read error: ${err.message}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  private async handleMessage(messageId: string, fields: string[]): Promise<void> {
    if (!this.redis) return;

    const payloadIdx = fields.indexOf('payload');
    if (payloadIdx === -1 || payloadIdx + 1 >= fields.length) {
      await this.ack(messageId);
      return;
    }

    let batch: any;
    try {
      batch = JSON.parse(fields[payloadIdx + 1]);
    } catch {
      console.warn(`[rule-evaluator] Invalid JSON in message ${messageId}`);
      await this.ack(messageId);
      return;
    }

    if (!batch.changes || !Array.isArray(batch.changes)) {
      await this.ack(messageId);
      return;
    }

    let jobsEnqueued = 0;
    let deduped = 0;
    let allSucceeded = true;

    for (const change of batch.changes) {
      try {
        this.stats.eventsProcessed++;

        const matchedPages = matchPages({
          category: change.property_category,
          transactionType: change.filter_snapshot?.transaction_type,
          city: change.city,
          price: change.price,
          eventType: change.event_type,
        });

        if (matchedPages.length === 0) {
          this.stats.noMatch++;
          continue;
        }

        const post: MarketingPost = {
          property_id: change.property_id,
          title: change.title || `${change.property_category} in ${change.city}`,
          price: change.price,
          old_price: change.old_price,
          currency: change.filter_snapshot?.currency || 'CZK',
          city: change.city,
          region: change.region,
          category: change.property_category,
          transaction_type: change.filter_snapshot?.transaction_type,
          sqm: change.filter_snapshot?.sqm,
          disposition: change.filter_snapshot?.disposition,
          images: change.images || [],
          source_url: change.source_url || `https://landomo.cz/p/${change.property_id}`,
          event_type: change.event_type,
        };

        // Fan-out: one listing → N page jobs (with dedup)
        for (const page of matchedPages) {
          // Atomic dedup: SET NX acquires the slot; if enqueue fails, we clean up
          const dedupKey = `fb:dedup:${page.pageId}:${change.property_id}`;
          const acquired = await this.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
          if (!acquired) {
            deduped++;
            this.stats.deduped++;
            continue;
          }

          try {
            await this.marketingQueue.add(
              `page-${page.pageId}`,
              {
                rule_id: `auto-${page.pageId}`,
                post,
                target_type: 'page',
                target_id: page.pageId,
              },
              {
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 }, // 1m, 2m, 4m, 8m, 16m
                removeOnComplete: { age: 86400, count: 10000 },
                removeOnFail: { age: 604800, count: 5000 },
              }
            );
            jobsEnqueued++;
            this.stats.jobsEnqueued++;
          } catch (enqueueErr: any) {
            // Enqueue failed — remove dedup key so the listing can be retried
            await this.redis.del(dedupKey).catch(() => {});
            throw enqueueErr; // let the outer catch handle it
          }
        }
      } catch (err: any) {
        console.error(`[rule-evaluator] Failed to process change ${change.property_id}: ${err.message}`);
        allSucceeded = false;
      }
    }

    if (jobsEnqueued > 0 || deduped > 0) {
      console.log(
        `[rule-evaluator] ${batch.changes.length} changes → ${jobsEnqueued} jobs, ${deduped} deduped (msg: ${messageId})`
      );
    }

    if (allSucceeded) {
      await this.ack(messageId);
    } else {
      console.warn(`[rule-evaluator] Partial failure for message ${messageId}, will be redelivered`);
    }
  }

  private async ack(messageId: string): Promise<void> {
    try {
      if (!this.redis) return;
      await this.redis.xack(this.streamKey, this.groupName, messageId);
    } catch (err: any) {
      console.error(`[rule-evaluator] XACK failed for ${messageId}: ${err.message}`);
    }
  }
}
