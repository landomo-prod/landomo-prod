import Redis from 'ioredis';
import { PropertyBatchEvent } from '@landomo/core';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { config } from './config';
import { logger } from './logger';
import { eventsReceivedTotal } from './metrics';

const PropertyFilterSnapshotSchema = z.object({
  property_category: z.enum(['apartment', 'house', 'land', 'commercial', 'other']),
  transaction_type: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  sqm: z.number().optional(),
  floor: z.number().optional(),
  sqm_living: z.number().optional(),
  sqm_plot: z.number().optional(),
  area_plot_sqm: z.number().optional(),
  sqm_total: z.number().optional(),
  disposition: z.string().optional(),
  ownership: z.string().optional(),
  building_type: z.string().optional(),
  condition: z.string().optional(),
  has_parking: z.boolean().optional(),
  has_garden: z.boolean().optional(),
  has_pool: z.boolean().optional(),
  has_balcony: z.boolean().optional(),
  has_terrace: z.boolean().optional(),
  has_elevator: z.boolean().optional(),
  has_garage: z.boolean().optional(),
  has_basement: z.boolean().optional(),
}).passthrough();

const PropertyChangeEventSchema = z.object({
  property_id: z.string(),
  portal_id: z.string(),
  event_type: z.enum(['new_listing', 'price_drop', 'price_increase', 'status_removed', 'reactivated']),
  property_category: z.enum(['apartment', 'house', 'land', 'commercial', 'other']),
  city: z.string(),
  region: z.string().optional(),
  price: z.number(),
  old_price: z.number().optional(),
  title: z.string().optional(),
  source_url: z.string().optional(),
  images: z.array(z.string()).optional(),
  filter_snapshot: PropertyFilterSnapshotSchema,
});

const BatchEventSchema = z.object({
  country: z.string(),
  portal: z.string(),
  timestamp: z.number(),
  batch_size: z.number(),
  changes: z.array(PropertyChangeEventSchema),
});

/**
 * Reads from Redis Stream `property:changes:{country}` using a consumer group
 * and enqueues batch events for watchdog evaluation.
 *
 * Replaces the old Pub/Sub approach so that messages are durable and
 * survive restarts without loss.
 */
export class EventListener {
  private redis: Redis | null = null;
  private evaluateQueue: Queue;
  private streamKey: string;
  private groupName: string;
  private consumerName: string;
  private running = false;

  constructor(evaluateQueue: Queue) {
    this.evaluateQueue = evaluateQueue;
    this.streamKey = `property:changes:${config.country}`;
    this.groupName = config.redis.consumerGroup;
    this.consumerName = config.redis.consumerName;
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
      logger.error({ err: err.message }, 'redis connection error');
    });

    // Create consumer group (ignore BUSYGROUP if it already exists)
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.groupName, '0', 'MKSTREAM');
      logger.info({ group: this.groupName, stream: this.streamKey }, 'created consumer group');
    } catch (err: any) {
      if (err.message && err.message.includes('BUSYGROUP')) {
        logger.info({ group: this.groupName, stream: this.streamKey }, 'consumer group already exists');
      } else {
        throw err;
      }
    }

    this.running = true;
    logger.info({ group: this.groupName, consumer: this.consumerName }, 'starting stream reader');

    // Start the read loop (non-blocking — runs in background)
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
        // XREADGROUP GROUP <group> <consumer> COUNT 100 BLOCK 5000 STREAMS <key> >
        const results = await this.redis.xreadgroup(
          'GROUP',
          this.groupName,
          this.consumerName,
          'COUNT',
          100,
          'BLOCK',
          5000,
          'STREAMS',
          this.streamKey,
          '>'
        );

        if (!results) continue; // timeout, no new messages

        for (const [_stream, messages] of results as [string, [string, string[]][]][]) {
          for (const [messageId, fields] of messages) {
            await this.handleMessage(messageId, fields);
          }
        }
      } catch (err: any) {
        if (!this.running) break; // shutting down
        logger.error({ err: err.message }, 'stream read error');
        // Back off before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private async handleMessage(messageId: string, fields: string[]): Promise<void> {
    // ioredis returns fields as flat array: ['payload', '...json...']
    const payloadIndex = fields.indexOf('payload');
    if (payloadIndex === -1 || payloadIndex + 1 >= fields.length) {
      logger.warn({ message_id: messageId }, 'message missing payload field, acking');
      await this.ack(messageId);
      return;
    }

    const raw = fields[payloadIndex + 1];

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      logger.warn({ message_id: messageId, raw: raw.slice(0, 200) }, 'invalid JSON in stream message, skipping');
      await this.ack(messageId);
      return;
    }

    const parsed = BatchEventSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn({ message_id: messageId, error: parsed.error.message }, 'invalid event payload, skipping');
      await this.ack(messageId);
      return;
    }

    const event = parsed.data as PropertyBatchEvent;

    if (!event.changes || event.changes.length === 0) {
      await this.ack(messageId);
      return;
    }

    // Track events received by portal and event type
    for (const change of event.changes) {
      eventsReceivedTotal.inc({ country: config.country, portal: event.portal, event_type: change.event_type });
    }

    logger.info({ portal: event.portal, changes: event.changes.length, message_id: messageId }, 'received batch');

    await this.evaluateQueue.add(
      'evaluate-batch',
      event,
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 200 },
      }
    );

    // ACK only after successfully enqueuing
    await this.ack(messageId);
  }

  private async ack(messageId: string): Promise<void> {
    try {
      await this.redis!.xack(this.streamKey, this.groupName, messageId);
    } catch (err: any) {
      logger.error({ message_id: messageId, err: err.message }, 'failed to XACK message');
    }
  }
}
