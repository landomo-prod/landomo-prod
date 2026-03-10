# Notification Service Architecture

## Full Architecture Diagram

```
                          ┌─────────────────────────────────┐
                          │  Scraper / Ingest Service        │
                          │  XADD property:changes:{country} │
                          └──────────────┬──────────────────┘
                                         │
                          ┌──────────────v──────────────────┐
                          │  Redis Stream                    │
                          │  property:changes:{country}      │
                          └──────────────┬──────────────────┘
                                         │
                          ┌──────────────v──────────────────┐
                          │  EventListener                   │
                          │  XREADGROUP GROUP ... BLOCK 5000 │
                          │  COUNT 100, consumer group       │
                          │  Parse + validate (Zod)          │
                          │  XACK after enqueue              │
                          └──────────────┬──────────────────┘
                                         │
                          ┌──────────────v──────────────────┐
                          │  BullMQ: notify-evaluate-{country}│
                          └──────────────┬──────────────────┘
                                         │
                          ┌──────────────v──────────────────┐
                          │  EvaluateWorker (concurrency: 1) │
                          │                                  │
                          │  WatchdogEvaluator.evaluate()    │
                          │    two-level index:              │
                          │    event_type → city → watchdogs │
                          │    filter matching (AND logic)   │
                          │                                  │
                          │  NotificationRouter.route()      │
                          │    dedup (Redis SET NX)          │
                          │    daily cap (Redis GET)         │
                          │    bulk Supabase insert          │
                          │    daily cap INCR after insert   │
                          └───────┬──────────────┬──────────┘
                                  │              │
                    instant       │              │  digest
                                  │              │
               ┌──────────────────v──┐   ┌──────v───────────────┐
               │ Supabase insert     │   │ Supabase insert      │
               │ (with IDs returned) │   │ (is_digest = true)   │
               └──────────┬─────────┘   └──────┬───────────────┘
                          │                     │
               ┌──────────v─────────┐           │ (stored until cron fires)
               │ BullMQ:            │           │
               │ notify-dispatch-   │   ┌───────v──────────────┐
               │ {country}          │   │ BullMQ:              │
               └──────────┬─────────┘   │ notify-digest-       │
                          │             │ {country}            │
               ┌──────────v─────────┐   │ (cron-triggered)     │
               │ DispatchWorker     │   └───────┬──────────────┘
               │ (concurrency: 20)  │           │
               │                    │   ┌───────v──────────────┐
               │ per-channel        │   │ DigestWorker         │
               │ circuit breaker    │   │ (concurrency: 1)     │
               │                    │   │                      │
               │ 3 attempts,        │   │ batch query          │
               │ exponential backoff│   │ per-watchdog cap: 50 │
               │                    │   │ mark-as-read         │
               │ delivery_log       │   └───────┬──────────────┘
               │ DLQ on failure     │           │
               └──┬──┬──┬──┬──┬────┘           │
                  │  │  │  │  │                │
      ┌───────┬──┘  │  │  │  └──┐      ┌──────┴──────┐
      v       v     v  v  v     v      v             v
   email  telegram  discord sms push  (same channels via sendDigest)
  (Resend) (Bot API) (webhook) (Twilio) (VAPID)
```

## 1. Event Ingestion

The `EventListener` class reads property change events from a Redis Stream using consumer groups, providing durable, at-least-once delivery that survives service restarts.

**Stream key:** `property:changes:{country}` (e.g., `property:changes:czech`)

**Consumer group:** Configurable via `REDIS_CONSUMER_GROUP` (default: `notification-service`). The group is created with `MKSTREAM` on startup. If it already exists, the `BUSYGROUP` error is silently ignored.

**Consumer name:** Defaults to `os.hostname()`, allowing multiple instances to share the same consumer group for horizontal scaling.

**Read loop:**

1. `XREADGROUP GROUP notification-service <consumer> COUNT 100 BLOCK 5000 STREAMS property:changes:{country} >`
2. On timeout (no messages within 5 seconds), loop continues.
3. Each message has a `payload` field containing JSON.
4. The JSON is parsed and validated against `BatchEventSchema` (Zod):
   - `country`, `portal`, `timestamp`, `batch_size`
   - `changes[]`: each with `property_id`, `portal_id`, `event_type`, `property_category`, `city`, `price`, `filter_snapshot`
5. Valid batches are enqueued to the BullMQ evaluate queue with 2 attempts and 1-second fixed backoff.
6. `XACK` is sent only after the batch is successfully enqueued (not after processing).

**Event types:** `new_listing`, `price_drop`, `price_increase`, `status_removed`, `reactivated`

**Error handling:** Invalid JSON or failed schema validation triggers an immediate XACK (the message is discarded with a warning log). Redis connection errors cause a 2-second backoff before retrying the read loop.

## 2. Watchdog Evaluation

The `WatchdogEvaluator` loads all active, non-muted watchdogs for the configured country into memory and rebuilds a two-level lookup index for fast matching.

**Data source:** Supabase `watchdogs` table, filtered by `country`, `active = true`, `muted = false`. Fetched with pagination (1000 rows per page) to handle Supabase row limits.

**Refresh cycle:** Every 5 minutes (configurable via `WATCHDOG_REFRESH_INTERVAL_MS`). A forced refresh is available via `POST /watchdogs/refresh`.

**Two-level index:**

```
byEventAndCity: Map<event_type, Map<city_key, WatchdogRow[]>>

Level 1: event_type (e.g., "new_listing", "price_drop")
Level 2: city_key (lowercase trimmed city, or "*" for no-city-filter watchdogs)
```

**Evaluation algorithm** (per property change event):

1. Look up the city map for the event's `event_type`.
2. Collect candidates from two buckets:
   - `"*"` (wildcard) -- watchdogs with no city filter, match all cities
   - The event's specific city key
3. For each candidate, run `matchesFilters()` against the event's `filter_snapshot`.

**Filter matching** (all AND logic -- every specified filter must match):

| Filter Field        | Match Logic                                                |
|---------------------|------------------------------------------------------------|
| `property_category` | Exact match                                                |
| `transaction_type`  | Exact match                                                |
| `city`              | Case-insensitive exact match                               |
| `region`            | Case-insensitive exact match                               |
| `price_min/max`     | Range check against event price                            |
| `bedrooms_min/max`  | Range check against snapshot bedrooms                      |
| `sqm_min/max`       | Range check against sqm / sqm_total / sqm_living / sqm_plot / area_plot_sqm (first non-null) |
| `disposition`       | Exact match (Czech-specific, e.g., "3+kk")                |
| `ownership`         | Exact match                                                |
| `building_type`     | Exact match                                                |
| `condition`         | Exact match                                                |
| `has_parking`, `has_garden`, `has_balcony`, `has_terrace`, `has_elevator`, `has_garage`, `has_basement` | If filter is `true`, property must have it |

## 3. Notification Routing

The `NotificationRouter` takes matched (watchdog, change) pairs and splits them into instant and digest paths. The routing happens in three phases:

**Phase 1: Dedup + daily cap filtering**

For each match:
1. Check deduplication (Redis `SET NX`, 1-hour TTL). Skip if duplicate.
2. Check daily cap (Redis `GET`). Skip if over limit.
3. Build `NotificationPayload` and `NotificationInsert` row.
4. Sort into `instantMatches[]` or `digestMatches[]` based on `watchdog.frequency`.

**Phase 2: Bulk insert digest notifications**

- Bulk insert into Supabase `notifications` table in chunks of 500.
- `is_digest = true` -- these rows are stored until the next digest cron fires.
- Daily cap is incremented (Redis `INCR` + 25-hour TTL) only after successful insert.

**Phase 3: Bulk insert instant notifications + dispatch**

- Bulk insert into Supabase `notifications` table in chunks of 500, returning `id` for each row.
- Daily cap is incremented after successful insert.
- For each notification, a dispatch job is enqueued per external channel (everything except `in_app`).
- Dispatch jobs use BullMQ with 3 attempts, exponential backoff (2s base), and 7-day retention.
- `last_triggered_at` is batch-updated on all triggered watchdogs.

**Bulk insert circuit breakers:** Two separate Opossum circuit breakers protect the Supabase bulk insert calls (one for inserts returning IDs, one without).

## 4. Dispatch

The `DispatchWorker` processes dispatch jobs at a concurrency of 20 (configurable via `DISPATCH_CONCURRENCY`).

**Per-job flow:**

1. Look up the user's channel configuration from `user_channels` table (Supabase).
2. If the channel is not configured or not verified for this user, skip with a log.
3. Send through the channel's `send()` method, wrapped in a per-channel circuit breaker.
4. Insert a row into `delivery_log` with status, external ID, error, and attempt count.
5. On success, increment the `notification_dispatched_total` Prometheus counter.
6. On failure, throw to trigger BullMQ retry.

**Channel implementations:**

| Channel   | Provider     | Config Required             | Rate Limits (per channel impl) |
|-----------|--------------|-----------------------------|-------------------------------|
| `in_app`  | Supabase     | None (always enabled)       | N/A                           |
| `email`   | Resend       | `RESEND_API_KEY`            | Per Resend plan               |
| `telegram`| Telegram Bot | `TELEGRAM_BOT_TOKEN`        | 30 msg/sec (Bot API limit)    |
| `discord` | Webhook      | User-provided webhook URL   | 30 req/min per webhook        |
| `sms`     | Twilio       | Account SID + Auth Token    | Per Twilio plan               |
| `web_push`| VAPID        | VAPID key pair              | Browser-dependent             |

Each channel must implement the `NotificationChannel` interface:

```typescript
interface NotificationChannel {
  name: string;
  send(payload: NotificationPayload, config: ChannelConfig): Promise<SendResult>;
  sendDigest(payloads: NotificationPayload[], config: ChannelConfig, period: string): Promise<SendResult>;
  verify(config: ChannelConfig): Promise<{ valid: boolean; error?: string }>;
  getRateLimit(): { maxPerMinute: number; maxPerHour: number; maxPerDay: number };
}
```

**Dead Letter Queue (DLQ):**

After all 3 retry attempts are exhausted, the failed job is moved to `notify-dispatch-dlq-{country}` with the original payload, error message, timestamp, and attempt count. DLQ jobs are retained for 7 days.

## 5. Digest Compilation

The `DigestWorker` runs on three cron schedules and compiles pending notifications into batched digest messages.

**Schedules:**

| Period  | Cron            | Description            |
|---------|-----------------|------------------------|
| hourly  | `0 * * * *`     | Top of every hour      |
| daily   | `0 7 * * *`     | 07:00 UTC (08:00 CET)  |
| weekly  | `0 7 * * 1`     | Monday 07:00 UTC       |

**Compilation flow:**

1. Fetch all active, non-muted watchdogs matching the digest period (paginated, 1000 per page).
2. Batch-fetch unread `is_digest` notifications for those watchdogs, created after the cutoff time (1h / 24h / 7d).
3. Group notifications by `watchdog_id`. Cap at 50 per watchdog.
4. Batch-fetch verified `user_channels` for all unique user IDs.
5. For each watchdog with pending notifications:
   - Build `NotificationPayload[]` from stored notification rows.
   - Send via each channel's `sendDigest()` method (with per-channel circuit breaker).
6. Batch mark all successfully-sent notifications as `read = true` (chunks of 100).

## 6. Deduplication

Prevents the same user from receiving duplicate notifications about the same property event within a configurable window.

**Mechanism:** Redis `SET key value EX ttl NX`

**Key format:** `dedup:{user_id}:{property_id}:{event_type}`

**TTL:** 1 hour (configurable via `DEDUP_WINDOW_MS`)

**Behavior:** If the key already exists (SET NX returns null), the notification is suppressed. The `notification_deduped_total` Prometheus counter is incremented.

**Why this matters:** A property can appear in multiple scraper batches within the same hour (e.g., from different portals), and a user may have multiple watchdogs matching the same property. Without dedup, a single price drop could generate 5+ notifications for the same user.

## 7. Daily Caps

Limits the number of notifications a single watchdog can generate per calendar day.

**Mechanism:** Redis `INCR` + `EXPIRE`

**Key format:** `notify:cap:{watchdog_id}:{YYYY-MM-DD}`

**TTL:** 90,000 seconds (25 hours) -- ensures the key survives the full UTC day plus margin.

**Check flow:**

1. Before inserting a notification, `GET` the current count.
2. If `count >= watchdog.max_notifications_per_day` (and max > 0), skip the notification.
3. `INCR` the key only after the Supabase insert succeeds (prevents counting failed inserts).

**Default limit:** Set per-watchdog in the `watchdogs` table (`max_notifications_per_day` column). A value of 0 means unlimited.

## 8. Resilience Patterns

### Circuit Breakers

All external calls are wrapped in Opossum circuit breakers:

| Breaker Name                    | Protects                              |
|--------------------------------|---------------------------------------|
| `supabase-bulk-insert-with-ids` | Supabase insert (instant path)       |
| `supabase-bulk-insert-no-ids`   | Supabase insert (digest path)        |
| `channel-send-{name}`           | Per-channel instant dispatch          |
| `channel-digest-{name}`         | Per-channel digest dispatch           |

**Configuration** (shared defaults):

| Parameter                  | Value   |
|----------------------------|---------|
| Timeout                    | 10s     |
| Error threshold percentage | 50%     |
| Reset timeout              | 30s     |
| Volume threshold           | 5 calls |

When a breaker opens, all calls through it fail immediately with "Breaker is open" until the reset timeout elapses. The breaker then enters half-open state and allows a single probe call.

### Retry Strategy

| Queue     | Attempts | Backoff                  |
|-----------|----------|--------------------------|
| evaluate  | 2        | Fixed 1s                 |
| dispatch  | 3        | Exponential, 2s base     |
| digest    | 1        | None (cron will re-run)  |

### Graceful Shutdown

On `SIGTERM` or `SIGINT`, the service shuts down in order:

1. Stop accepting HTTP requests (close Express server).
2. Stop the Redis Stream read loop (`EventListener.stop()`).
3. Disconnect the dedup Redis client.
4. Stop the watchdog refresh timer.
5. Close all BullMQ workers (drain in-flight jobs).
6. Close all BullMQ queues.
7. Exit with code 0.

### Stream ACK Ordering

Messages are acknowledged (`XACK`) only after the batch is successfully enqueued to BullMQ. If the service crashes between reading and acknowledging, the message will be redelivered to another consumer in the group (or the same consumer on restart). This provides at-least-once delivery semantics.

## 9. Scaling Characteristics

### Current Design Point

The service is designed for a single-instance-per-country deployment with low-to-moderate notification volumes.

### Memory Footprint

| Component               | Memory Usage                                            |
|--------------------------|---------------------------------------------------------|
| Watchdog index           | ~1 KB per watchdog (two Map copies of references)       |
| BullMQ workers           | Fixed overhead per worker (~5 MB)                       |
| Redis connections        | 3 connections (stream reader, dedup client, BullMQ)     |

At 10,000 watchdogs: ~10 MB for the in-memory index. At 100,000 watchdogs: ~100 MB.

### Redis Key Growth

| Key Pattern                                  | Count                          | TTL     |
|----------------------------------------------|--------------------------------|---------|
| `dedup:{user}:{property}:{event}`            | Up to users x properties/hour  | 1 hour  |
| `notify:cap:{watchdog}:{date}`               | Up to watchdogs x 1            | 25 hours|
| BullMQ job keys                              | Bounded by removeOnComplete    | 1-24h   |

At 10,000 users with 50 notifications/day: ~500K dedup keys (cycling hourly), ~50K cap keys. Each key is ~100 bytes. Total: ~55 MB of Redis memory.

### Bottlenecks by Scale

**1,000 users / 10,000 watchdogs:**
- No issues. Single instance handles this comfortably.
- Supabase bulk inserts in 500-row chunks clear quickly.

**10,000 users / 100,000 watchdogs:**
- Watchdog refresh takes longer (100 pages of 1000 rows each). Consider increasing refresh interval.
- Evaluation loop is O(changes x candidates-per-city). If a single city has 50,000 watchdogs, a batch of 100 changes produces 5M filter checks. Evaluation time may exceed 1 second.
- Mitigation: shard by property category or add a third index level.

**100,000 users / 1,000,000 watchdogs:**
- In-memory index exceeds 1 GB. Must move to a persistent index (Redis sorted sets or database-side evaluation).
- Supabase bulk inserts become the bottleneck. Consider direct PostgreSQL writes via connection pool.
- Consumer group with multiple instances helps with stream throughput but not with evaluation (each instance needs the full index or a partition of it).
- At this scale, redesign around a streaming evaluation engine (e.g., Flink, or a custom sharded evaluator).

## Sequence Diagram: Instant Notification Path

```
Scraper          Redis Stream      EventListener    EvaluateQueue    EvaluateWorker     NotificationRouter   Redis (dedup/cap)   Supabase           DispatchQueue    DispatchWorker     Channel (e.g. email)
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |--XADD payload--->|                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |<--XREADGROUP-----|                |                |                    |                   |                  |                   |                |                    |
  |                  |---messages------>|                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |--parse+validate|                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |--add job------>|                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |<--XACK-----------|                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |--process job-->|                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |--evaluate(changes)->                   |                  |                   |                |                    |
  |                  |                  |                |                |  index lookup       |                   |                  |                   |                |                    |
  |                  |                  |                |                |  filter matching    |                   |                  |                   |                |                    |
  |                  |                  |                |                |<--matches[]---------|                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |--route(matches)---->|                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |--SET NX dedup---->|                  |                   |                |                    |
  |                  |                  |                |                |                    |<--OK (new)--------|                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |--GET cap--------->|                  |                   |                |                    |
  |                  |                  |                |                |                    |<--count-----------|                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |--bulk insert (is_digest=false)------>|                   |                |                    |
  |                  |                  |                |                |                    |<--[{id: "..."}]---|------------------|                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |--INCR cap-------->|                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |--add dispatch job-|------------------|------------------>|                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |--update last_triggered_at----------->|                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |--process job-->|                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |--get user_channels->
  |                  |                  |                |                |                    |                   |                  |                   |                |<--channel_config----|
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |--send(payload)----->|
  |                  |                  |                |                |                    |                   |                  |                   |                |<--SendResult--------|
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
  |                  |                  |                |                |                    |                   |                  |                   |                |--insert delivery_log>
  |                  |                  |                |                |                    |                   |                  |                   |                |                    |
```
