# Notification Service

The notification service monitors property change events emitted by Landomo scrapers, evaluates them against user-defined watchdogs (saved searches with alert rules), and delivers matching notifications through multiple channels. It supports instant delivery (email, Telegram, Discord, SMS, web push, in-app) and batched digest delivery on hourly, daily, or weekly schedules.

## Architecture Overview

```
Redis Stream (property:changes:{country})
  |
  v
EventListener (XREADGROUP, consumer group, BLOCK 5s, COUNT 100)
  |
  v
BullMQ evaluate queue (notify-evaluate-{country})
  |
  v
EvaluateWorker (concurrency: 1)
  |-- WatchdogEvaluator: two-level index lookup (event_type -> city -> watchdogs)
  |-- NotificationRouter: dedup + daily cap + Supabase insert
  |
  +---> frequency = instant
  |       |
  |       v
  |     Supabase insert (with IDs) --> BullMQ dispatch queue
  |                                      |
  |                                      v
  |                                    DispatchWorker (concurrency: 20)
  |                                      |-- per-channel circuit breaker
  |                                      |-- delivery_log insert
  |                                      |-- 3 attempts, exponential backoff
  |                                      |-- DLQ on permanent failure
  |                                      |
  |                                      +--> email (Resend)
  |                                      +--> telegram (Bot API)
  |                                      +--> discord (webhook)
  |                                      +--> sms (Twilio)
  |                                      +--> web-push (VAPID)
  |
  +---> frequency = hourly | daily | weekly
          |
          v
        Supabase insert (is_digest = true, stored for later)
          |
          v
        DigestWorker (cron-triggered, concurrency: 1)
          |-- hourly:  0 * * * *
          |-- daily:   0 7 * * *   (08:00 CET)
          |-- weekly:  0 7 * * 1   (Monday 08:00 CET)
          |-- per-watchdog cap: 50 notifications
          |-- batch mark-as-read after send
```

## Quick Start

### Prerequisites

- Node.js 20+
- Redis (used for BullMQ queues, deduplication, and daily caps)
- Supabase instance (used for watchdog storage, notifications table, user channels)

### Environment Variables

Copy the required variables from the configuration reference below and create a `.env` file in the service root.

```bash
# Minimal .env for local development
PORT=3200
COUNTRY=czech
REDIS_HOST=localhost
REDIS_PORT=6379
SUPABASE_URL=http://localhost:8000
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
```

### Run

```bash
npm install
npm run dev       # tsx watch mode
npm run build     # compile TypeScript
npm start         # run compiled output
npm test          # vitest
```

## Directory Structure

```
src/
  index.ts                  # Entry point: wires up all components, HTTP server, graceful shutdown
  config.ts                 # Environment variable parsing with defaults
  logger.ts                 # Pino structured logger
  metrics.ts                # Prometheus counters, histograms, gauges
  event-listener.ts         # Redis Stream consumer (XREADGROUP with consumer groups)
  watchdog-evaluator.ts     # In-memory watchdog index, filter matching, periodic refresh
  notification-router.ts    # Dedup, daily cap, bulk insert, dispatch job creation
  circuit-breaker.ts        # Opossum circuit breaker factory
  supabase-client.ts        # Supabase admin client singleton, row type definitions
  queues/
    index.ts                # BullMQ queue factories (evaluate, dispatch, digest)
    evaluate-worker.ts      # Processes batches: evaluate matches, route notifications
    dispatch-worker.ts      # Sends via channel, logs delivery, DLQ on permanent failure
    digest-worker.ts        # Cron-triggered: compiles and sends digest emails/messages
  channels/
    types.ts                # NotificationChannel interface, payload/config/result types
    index.ts                # Channel registry, conditional initialization
    in-app.ts               # In-app notification (Supabase insert only, always enabled)
    email.ts                # Email via Resend API
    telegram.ts             # Telegram via Bot API
    telegram-bot.ts         # Telegram webhook handler (incoming /start commands)
    discord.ts              # Discord via user-provided webhook URL
    sms.ts                  # SMS via Twilio
    web-push.ts             # Web Push via VAPID
  templates/
    notification-email.ts   # HTML template for single notification emails
    digest-email.ts         # HTML template for digest emails
  __tests__/
    notification-router.test.ts
    watchdog-evaluator.test.ts
```

## HTTP Endpoints

| Method | Path                  | Description                                              |
|--------|-----------------------|----------------------------------------------------------|
| GET    | `/health`             | Returns service status, country, uptime, watchdog stats  |
| GET    | `/metrics`            | Prometheus metrics (prom-client format)                  |
| POST   | `/watchdogs/refresh`  | Force reload of all watchdogs from Supabase              |
| POST   | `/webhooks/telegram`  | Telegram Bot webhook (only if `TELEGRAM_BOT_TOKEN` set)  |

## Configuration Reference

All values are read from environment variables. Defaults are shown in parentheses.

### Server

| Variable    | Default   | Description                    |
|-------------|-----------|--------------------------------|
| `PORT`      | `3200`    | HTTP server port               |
| `HOST`      | `0.0.0.0` | HTTP server bind address       |
| `LOG_LEVEL` | `info`    | Pino log level                 |
| `COUNTRY`   | `czech`   | Country code for this instance |

### Redis

| Variable               | Default                | Description                                    |
|------------------------|------------------------|------------------------------------------------|
| `REDIS_HOST`           | `localhost`            | Redis host                                     |
| `REDIS_PORT`           | `6379`                 | Redis port                                     |
| `REDIS_PASSWORD`       | (none)                 | Redis password                                 |
| `REDIS_CONSUMER_GROUP` | `notification-service` | Consumer group name for Redis Stream           |
| `REDIS_CONSUMER_NAME`  | `os.hostname()`        | Consumer name within the group                 |

### Supabase

| Variable              | Default                 | Description                            |
|-----------------------|-------------------------|----------------------------------------|
| `SUPABASE_URL`        | `http://localhost:8000` | Supabase API URL (Kong gateway)        |
| `SUPABASE_SERVICE_KEY` | (none, required)       | Supabase service role key              |
| `SUPABASE_ANON_KEY`   | (none)                  | Supabase anonymous key                 |

### Watchdog

| Variable                        | Default  | Description                                    |
|---------------------------------|----------|------------------------------------------------|
| `WATCHDOG_REFRESH_INTERVAL_MS`  | `300000` | How often to reload watchdogs from DB (5 min)  |
| `MAX_WATCHDOGS_PER_USER`        | `50`     | Maximum watchdogs per user                     |

### Dispatch

| Variable               | Default   | Description                                       |
|------------------------|-----------|---------------------------------------------------|
| `DISPATCH_CONCURRENCY` | `20`      | Concurrent dispatch worker jobs                   |
| `DEDUP_WINDOW_MS`      | `3600000` | Deduplication window (1 hour)                     |

### Telegram

| Variable                  | Default | Description                        |
|---------------------------|---------|------------------------------------|
| `TELEGRAM_BOT_TOKEN`      | (none)  | Telegram Bot API token             |
| `TELEGRAM_WEBHOOK_SECRET` | (none)  | Secret for webhook verification    |

### Twilio (SMS)

| Variable              | Default | Description              |
|-----------------------|---------|--------------------------|
| `TWILIO_ACCOUNT_SID`  | (none)  | Twilio account SID       |
| `TWILIO_AUTH_TOKEN`    | (none)  | Twilio auth token        |
| `TWILIO_PHONE_NUMBER`  | (none)  | Twilio sender number     |

### Email (Resend)

| Variable             | Default                    | Description               |
|----------------------|----------------------------|---------------------------|
| `RESEND_API_KEY`     | (none)                     | Resend API key            |
| `EMAIL_FROM_ADDRESS` | `notifications@landomo.cz` | Sender email address      |
| `EMAIL_FROM_NAME`    | `Landomo`                  | Sender display name       |

### Web Push (VAPID)

| Variable              | Default            | Description                  |
|-----------------------|--------------------|------------------------------|
| `VAPID_PUBLIC_KEY`    | (none)             | VAPID public key             |
| `VAPID_PRIVATE_KEY`   | (none)             | VAPID private key            |
| `VAPID_CONTACT_EMAIL` | `admin@landomo.cz` | Contact email for VAPID      |
