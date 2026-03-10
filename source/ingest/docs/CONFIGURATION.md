# Configuration

All configuration is loaded in `src/config/index.ts` via environment variables with Docker secret fallbacks.

## Configuration Loading Order

1. Load `.env` file (dotenv)
2. If `INSTANCE_COUNTRY` is set, load `.env.{INSTANCE_COUNTRY}` with override
3. For sensitive values (`db_password`, `api_keys`, `redis_password`), check `/run/secrets/{name}` first, fall back to env var

## Instance Identity

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `INSTANCE_COUNTRY` | string | `unknown` | Country code this instance serves (e.g., `cz`, `sk`, `at`). Also checked via `COUNTRY` fallback. Drives database name, queue name, and country validation. |
| `INSTANCE_REGION` | string | - | Optional region identifier |

## Server

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | HTTP server listen port |
| `HOST` | string | `0.0.0.0` | HTTP server bind address |

## Authentication

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `API_KEYS` | string | _(empty)_ | Comma-separated API keys. Supports formats: `plain_key`, `key:v2`, `key:v2:2026-12-31` (with expiry). Also read from Docker secret `/run/secrets/api_keys`. |

**Key Format Examples:**

```bash
# Simple keys (v1, no expiry)
API_KEYS=dev_key_1,dev_key_2

# Versioned keys
API_KEYS=key1:v1,key2:v2

# Versioned keys with expiry
API_KEYS=key1:v1:2026-12-31,key2:v2:2027-06-30
```

Keys expiring within 30 days produce a boot-time warning. Expired keys are rejected at request time.

## Database

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_HOST` | string | `localhost` | PostgreSQL host |
| `DB_PORT` | number | `5432` | PostgreSQL port |
| `DB_USER` | string | `landomo` | PostgreSQL user |
| `DB_PASSWORD` | string | _(empty)_ | PostgreSQL password. Also read from Docker secret `/run/secrets/db_password`. |
| `DB_NAME` | string | `landomo_{INSTANCE_COUNTRY}` | Database name. Auto-generated from country if not set. |
| `DB_MAX_CONNECTIONS` | number | `20` | Max connections per pool |
| `DB_READ_REPLICA_HOST` | string | `DB_HOST` | Read replica host (falls back to primary) |
| `DB_READ_REPLICA_PORT` | number | `DB_PORT` | Read replica port |

**Country-to-DB mapping:**
The database manager normalizes country names to short codes via `COUNTRY_ALIASES`. For example, `czech_republic`, `czech`, `czechia` all map to `cz`, producing database name `landomo_cz`.

## PgBouncer

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PGBOUNCER_ENABLED` | boolean | `false` | Enable PgBouncer connection pooling proxy |
| `PGBOUNCER_HOST` | string | `pgbouncer` | PgBouncer host |
| `PGBOUNCER_PORT` | number | `6432` | PgBouncer port |

When enabled, write connections route through PgBouncer instead of directly to PostgreSQL.

## Redis

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_HOST` | string | `localhost` | Redis host for BullMQ and rate limiting |
| `REDIS_PORT` | number | `6379` | Redis port |
| `REDIS_PASSWORD` | string | _(none)_ | Redis password. Also read from Docker secret `/run/secrets/redis_password`. |

## Batch Processing

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BATCH_SIZE` | number | `100` | Properties per batch operation |
| `BATCH_TIMEOUT` | number | `10000` | Batch timeout in milliseconds |
| `BATCH_WORKERS` | number | `5` | Worker concurrency (parallel jobs) |

## Staleness Detection

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `STALENESS_THRESHOLD_HOURS` | number | `72` | Hours before an active listing is marked as removed |
| `STALENESS_CRON` | string | `0 */6 * * *` | Cron pattern for staleness check (default: every 6 hours) |
| `STALENESS_BATCH_SIZE` | number | `500` | Properties processed per staleness batch |

## Scheduled Jobs

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATA_QUALITY_CRON` | string | `0 */6 * * *` | Cron for data quality checks (every 6 hours) |
| `ALERT_CHECK_CRON` | string | `*/5 * * * *` | Cron for alert evaluation (every 5 minutes) |
| `POLYGON_SYNC_CRON` | string | `0 2 1 * *` | Cron for polygon sync (1st of month at 2 AM) |

## Alert Checker

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ALERT_DB_MAX_GB` | number | `50` | Database size alert threshold in GB |

## Polygon Service Integration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `POLYGON_SERVICE_URL` | string | `http://polygon-service:3100` | Polygon service base URL |
| `POLYGON_SERVICE_API_KEY` | string | _(empty)_ | API key for polygon service |
| `POLYGON_SERVICE_TIMEOUT` | number | `300000` | Request timeout in ms (5 min) |

## Worker Metrics

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WORKER_METRICS_PORT` | number | `3006` | Port for worker Prometheus metrics endpoint |

## Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | string | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |

## Docker Secrets

The following values can be provided as Docker secrets (files at `/run/secrets/{name}`):

| Secret Name | Env Fallback |
|-------------|-------------|
| `db_password` | `DB_PASSWORD` |
| `api_keys` | `API_KEYS` |
| `redis_password` | `REDIS_PASSWORD` |

## Startup Validation

At boot, the config module logs warnings for:

- `INSTANCE_COUNTRY` not set
- No API keys configured
- API keys expiring within 30 days
- Expired API keys
- Missing `DB_PASSWORD`
