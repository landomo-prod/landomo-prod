# Notification Service — Operations Runbook

## Deployment

**Docker Compose service**: `cz-notification`
**Config**: `infra/docker/countries/czech/docker-compose.app.yml`
**Port**: 3200

### Environment Variables Checklist

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (via PgBouncer) |
| `REDIS_URL` | Yes | Redis connection string (BullMQ + streams) |
| `SUPABASE_URL` | Yes | Supabase API gateway URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for RLS-bypassing DB access |
| `COUNTRY` | Yes | Country code (`cz`, `hu`, ...) |
| `NOTIFICATION_PORT` | No | HTTP port (default `3200`) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for sending messages |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret for verifying Telegram webhook callbacks |
| `DISCORD_CLIENT_ID` | No | Discord OAuth client ID |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP server port |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | Sender address for outbound email |
| `VAPID_PUBLIC_KEY` | No | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | No | VAPID private key for Web Push |
| `VAPID_SUBJECT` | No | VAPID subject (mailto: or URL) |
| `WATCHDOG_REFRESH_INTERVAL_MS` | No | How often to reload watchdogs from DB (default `60000`) |
| `STREAM_BLOCK_MS` | No | XREADGROUP block timeout (default `5000`) |

### Health Check

```
GET /health
```

Returns `200 OK` with a JSON body:

```json
{
  "status": "ok",
  "uptime": 3600,
  "watchdogs_loaded": 142,
  "consumer_group": "notification-service",
  "stream": "property:changes:cz"
}
```

The Docker health check is configured to poll this endpoint.

---

## Monitoring

### Prometheus Metrics

```
GET /metrics
```

Exposes Prometheus-format metrics. Scraped by the country Prometheus instance.

### Key Metrics and Alert Thresholds

| Metric | Type | Description | Alert Condition |
|--------|------|-------------|-----------------|
| `notification_events_received_total` | Counter | Events consumed from the Redis stream | Rate drops to 0 for >10 min during scrape hours |
| `notification_dispatched_total{status}` | Counter | Delivery outcomes by status (`sent`, `failed`, `bounced`) | `failed` rate > 5% of total over 15 min |
| `notification_deduped_total` | Counter | Events dropped by deduplication | Sudden spike may indicate duplicate upstream events |
| `notification_watchdogs_loaded` | Gauge | Number of active watchdogs in memory | Diverges significantly from DB count |
| `notification_evaluation_duration_seconds` | Histogram | Time to evaluate one event against all watchdogs | p99 > 500ms |
| `notification_dispatch_duration_seconds{channel}` | Histogram | Time to deliver one notification per channel | p99 > 5s (email), p99 > 2s (telegram, discord, push) |

---

## Troubleshooting

### Watchdogs not matching

The service caches all active watchdogs in memory and refreshes them
periodically. If a newly created or updated watchdog is not matching:

1. Force an immediate reload:
   ```bash
   curl -X POST http://46.225.167.44:3200/watchdogs/refresh
   ```
2. Confirm the loaded count in the health response:
   ```bash
   curl -s http://46.225.167.44:3200/health | jq .watchdogs_loaded
   ```
3. Verify the watchdog is `active = TRUE` and `muted = FALSE` in the database.
4. Check that the watchdog's `filters` match the property being tested.

### Stuck consumer group

If the service crashes mid-processing, messages remain in the Pending Entries
List (PEL) and will not be re-delivered until claimed.

```bash
# Check pending message count and oldest entry
redis-cli XPENDING property:changes:cz notification-service

# List individual pending messages
redis-cli XPENDING property:changes:cz notification-service - + 10

# Claim stuck messages (idle > 60s) to the current consumer
redis-cli XCLAIM property:changes:cz notification-service consumer-1 60000 <message-id>

# Or acknowledge to discard
redis-cli XACK property:changes:cz notification-service <message-id>
```

Restarting the service will also auto-claim pending messages on startup.

### Circuit breaker tripped

Each delivery channel has a circuit breaker that opens after repeated
failures. When tripped:

- Logs will show `circuit open for channel <channel>`.
- Dispatch jobs for that channel will fail immediately until the circuit
  resets (default: 30 seconds).
- Check the underlying provider (SMTP server, Telegram API, etc.) for
  outages before the circuit closes.

### Dispatch DLQ growing

Jobs that exhaust all retry attempts land in the dead-letter queue.

```bash
# Check DLQ size via BullMQ
redis-cli LLEN bull:notify-dispatch-dlq-cz:waiting
```

Investigate the error field on failed jobs. Common causes:
- Invalid channel config (bad webhook URL, expired push subscription).
- Provider rate limits exceeded.
- Network partition between the service and the provider.

After fixing the root cause, replay DLQ jobs or clear the queue.

### Telegram verification not working

1. Confirm `TELEGRAM_BOT_TOKEN` is set and the bot is active
   (`https://api.telegram.org/bot<token>/getMe`).
2. Confirm `TELEGRAM_WEBHOOK_SECRET` in the service matches the secret
   configured in the Telegram webhook URL.
3. Check that the service is reachable from the internet on the webhook path
   (or use polling mode for development).

### Push notifications not delivered

1. Verify `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are
   configured.
2. Check the delivery_log for `410 Gone` errors — this means the browser
   subscription has expired. The service should automatically mark the
   channel as unverified.
3. Confirm the push subscription endpoint in `user_channels.channel_config`
   is still valid.

### High memory usage

- Check `notification_watchdogs_loaded` — a large watchdog count increases
  memory and evaluation time.
- Increase `WATCHDOG_REFRESH_INTERVAL_MS` to reduce churn.
- If the Redis stream is accumulating unprocessed messages, the internal
  buffer may grow. Check consumer lag (see below).

---

## Manual Operations

### Force watchdog refresh

```bash
curl -X POST http://46.225.167.44:3200/watchdogs/refresh
```

### Check service health

```bash
curl -s http://46.225.167.44:3200/health | jq .
```

### Check Prometheus metrics

```bash
curl -s http://46.225.167.44:3200/metrics
```

### Inspect Redis stream

```bash
# Stream info (length, first/last entry, consumer groups)
redis-cli XINFO STREAM property:changes:cz

# Consumer group info (consumers, pending, last-delivered-id)
redis-cli XINFO GROUPS property:changes:cz

# Pending entries list summary
redis-cli XPENDING property:changes:cz notification-service

# Read latest 5 entries
redis-cli XREVRANGE property:changes:cz + - COUNT 5
```

### Inspect BullMQ queues

```bash
# Waiting jobs
redis-cli LLEN bull:notify-evaluate-cz:waiting
redis-cli LLEN bull:notify-dispatch-cz:waiting
redis-cli LLEN bull:notify-digest-cz:waiting

# Failed jobs
redis-cli LLEN bull:notify-dispatch-cz:failed
redis-cli LLEN bull:notify-dispatch-dlq-cz:waiting
```

### Database queries

Run via the psql docker pattern (no psql binary on VPS):

```bash
docker run --rm -e PGPASSWORD=landomo_dev_pass postgres:16-alpine \
  psql -h 2a01:4f8:1c19:6b5b::1 -U landomo -d landomo_cz -c "
    SELECT channel_type, count(*) FROM user_channels GROUP BY 1;
  "
```

```bash
# Active watchdog count by country
docker run --rm -e PGPASSWORD=landomo_dev_pass postgres:16-alpine \
  psql -h 2a01:4f8:1c19:6b5b::1 -U landomo -d landomo_cz -c "
    SELECT country, count(*) FROM watchdogs WHERE active = TRUE GROUP BY 1;
  "
```

```bash
# Recent delivery failures
docker run --rm -e PGPASSWORD=landomo_dev_pass postgres:16-alpine \
  psql -h 2a01:4f8:1c19:6b5b::1 -U landomo -d landomo_cz -c "
    SELECT channel, status, count(*), max(created_at)
    FROM delivery_log
    WHERE created_at > now() - interval '1 hour'
    GROUP BY 1, 2
    ORDER BY 1, 2;
  "
```
