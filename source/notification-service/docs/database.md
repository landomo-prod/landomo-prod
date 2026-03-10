# Notification Service — Database Schema

All tables live in the per-country database (e.g. `landomo_cz`) and are protected by
Row-Level Security. The service also uses Redis for deduplication, rate limiting,
event streaming, and job queues.

---

## Tables

### user_channels

Stores per-user delivery channel configurations. Each user may have at most one
configuration per channel type.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | Primary key, `gen_random_uuid()` |
| `user_id` | `UUID` | FK `auth.users(id)` ON DELETE CASCADE |
| `channel_type` | `TEXT` | CHECK: `email`, `telegram`, `discord`, `sms`, `push` |
| `channel_config` | `JSONB` | Channel-specific settings (see below) |
| `verified` | `BOOLEAN` | `FALSE` until the user confirms ownership |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |

**Constraints**

- `UNIQUE (user_id, channel_type)` — one config per channel per user.

**RLS policy** — users can only `SELECT`, `INSERT`, `UPDATE`, `DELETE` rows where
`user_id = auth.uid()`.

**channel_config examples**

```jsonc
// email
{ "address": "user@example.com" }

// telegram
{ "chat_id": "123456789", "bot_username": "LandomoBot" }

// discord
{ "webhook_url": "https://discord.com/api/webhooks/..." }

// sms
{ "phone": "+420123456789" }

// push (Web Push)
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

---

### watchdogs

User-defined alert rules. A watchdog combines a set of property filters with
trigger events and delivery preferences.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | Primary key, `gen_random_uuid()` |
| `user_id` | `UUID` | FK `auth.users(id)` ON DELETE CASCADE |
| `name` | `TEXT` | User-facing label |
| `country` | `TEXT` | Country code (`cz`, `hu`, ...) |
| `filters` | `JSONB` | Property matching criteria (see below) |
| `trigger_events` | `TEXT[]` | Events that fire this watchdog |
| `frequency` | `TEXT` | `instant`, `hourly`, `daily`, `weekly` |
| `channels` | `TEXT[]` | Subset of user's verified channels |
| `active` | `BOOLEAN` | Default `TRUE` |
| `muted` | `BOOLEAN` | Default `FALSE` — silences without deactivating |
| `max_notifications_per_day` | `INTEGER` | Default `50` |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |
| `updated_at` | `TIMESTAMPTZ` | Default `now()`, auto-updated by trigger |
| `last_triggered_at` | `TIMESTAMPTZ` | Set each time the watchdog fires |

**Indexes**

- `idx_watchdogs_user_id` — `btree(user_id)`
- `idx_watchdogs_active_country` — `btree(active, country) WHERE active = TRUE`

**Trigger** — `fn_set_updated_at()` fires `BEFORE UPDATE` and sets
`updated_at = now()`.

**filters JSONB structure**

All fields are optional. Omitted fields are treated as "match any".

```jsonc
{
  "property_category": "apartment",       // apartment | house | land | commercial
  "transaction_type": "sale",             // sale | rent
  "city": "Praha",
  "region": "Hlavní město Praha",
  "price_min": 2000000,
  "price_max": 8000000,
  "bedrooms_min": 2,
  "bedrooms_max": 4,
  "sqm_min": 50,
  "sqm_max": 120,
  "disposition": "3+kk",
  "building_type": "brick",
  "condition": "good",
  "has_parking": true,
  "has_garden": false,
  "has_balcony": true,
  "has_terrace": null,                    // null = don't care
  "has_elevator": true,
  "has_garage": false,
  "has_basement": null
}
```

---

### notifications

One record per matched event per watchdog. Contains enough context
(property_snapshot) to render the notification without querying the
properties table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | Primary key, `gen_random_uuid()` |
| `user_id` | `UUID` | FK `auth.users(id)` ON DELETE CASCADE |
| `watchdog_id` | `UUID` | FK `watchdogs(id)` ON DELETE SET NULL |
| `event_type` | `TEXT` | `new_listing`, `price_drop`, `price_increase`, `status_change`, ... |
| `title` | `TEXT` | Human-readable title |
| `message` | `TEXT` | Human-readable body |
| `property_id` | `UUID` | Reference to the property |
| `property_snapshot` | `JSONB` | Point-in-time snapshot (see below) |
| `read` | `BOOLEAN` | Default `FALSE` |
| `is_digest` | `BOOLEAN` | Default `FALSE` — true for batched summaries |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |

**Indexes**

- `idx_notifications_user_created` — `btree(user_id, created_at DESC)`
- `idx_notifications_user_unread` — `btree(user_id) WHERE read = FALSE`

**RLS policy** — users can `SELECT`, `UPDATE` (mark read), and `DELETE` their
own notifications (`user_id = auth.uid()`).

**property_snapshot**

```jsonc
{
  "price": 4500000,
  "old_price": 5200000,          // present on price_drop / price_increase
  "city": "Praha",
  "property_category": "apartment",
  "transaction_type": "sale",
  "source_url": "https://www.sreality.cz/detail/...",
  "images": [
    "https://d18-a.sdn.cz/..."
  ]
}
```

---

### delivery_log

Tracks every delivery attempt for every notification across every channel.
Not user-accessible — used for debugging and retry logic.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` | Primary key, `gen_random_uuid()` |
| `notification_id` | `UUID` | FK `notifications(id)` ON DELETE CASCADE |
| `channel` | `TEXT` | `email`, `telegram`, `discord`, `sms`, `push` |
| `status` | `TEXT` | `pending`, `sent`, `delivered`, `failed`, `bounced` |
| `external_id` | `TEXT` | Provider message/reference ID |
| `error` | `TEXT` | Error message on failure |
| `attempts` | `INTEGER` | Default `0` |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |
| `sent_at` | `TIMESTAMPTZ` | Set when status transitions to `sent` |

**Indexes**

- `idx_delivery_log_notification` — `btree(notification_id)`
- `idx_delivery_log_pending` — `btree(status) WHERE status = 'pending'`

**RLS policy** — `service_role` only. No user-facing access.

---

## Redis Keys

The notification service uses a dedicated Redis instance (or the country
Redis, depending on deployment) for deduplication, rate limiting, event
streaming, and BullMQ job queues.

| Key Pattern | TTL | Purpose |
|---|---|---|
| `dedup:{user_id}:{property_id}:{event_type}` | 1 hour | Prevents sending the same notification twice within the window. SET NX — if the key exists, the event is silently dropped. |
| `notify:cap:{watchdog_id}:{YYYY-MM-DD}` | 25 hours | Per-watchdog daily notification counter. Incremented on each dispatch; compared against `max_notifications_per_day`. TTL is 25h to cover timezone edge cases. |
| Stream: `property:changes:{country}` | — | Redis Stream that carries property change events from the ingest pipeline. Each entry contains `event_type`, `property_id`, `country`, and a payload snapshot. |
| Consumer group: `notification-service` | — | XREADGROUP consumer group on the property changes stream. Ensures at-least-once delivery with automatic PEL tracking. |
| BullMQ: `notify-evaluate-{country}` | — | Evaluation queue — jobs contain a raw event to be matched against watchdogs. |
| BullMQ: `notify-dispatch-{country}` | — | Dispatch queue — jobs contain a matched notification ready for channel delivery. |
| BullMQ: `notify-digest-{country}` | — | Digest queue — scheduled jobs that batch notifications for hourly/daily/weekly delivery. |
| BullMQ: `notify-dispatch-dlq-{country}` | — | Dead-letter queue for dispatch jobs that exhausted all retry attempts. |
