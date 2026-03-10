# Polygon Service Configuration

All configuration is via environment variables, with Docker secrets support for sensitive values.

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |

### Database (PostgreSQL + PostGIS)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `landomo` | Database user |
| `DB_PASSWORD` | (empty) | Database password |
| `DB_NAME` | `landomo_geocoding` | Database name |
| `DB_MAX_CONNECTIONS` | `10` | Connection pool size |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (none) | Redis password |
| `CACHE_TTL_SECONDS` | `3600` | Cache TTL in seconds (1 hour) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEYS` | (empty) | Comma-separated API keys |

### Overpass API

| Variable | Default | Description |
|----------|---------|-------------|
| `OVERPASS_API_URL` | `https://overpass-api.de/api/interpreter` | Overpass endpoint |
| `OVERPASS_TIMEOUT` | `6000` | Query timeout (seconds) |
| `OVERPASS_RETRY_DELAY` | `5000` | Retry delay (ms) |
| `OVERPASS_MAX_RETRIES` | `3` | Max retries |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## Docker Secrets

The following values can be provided as Docker secrets at `/run/secrets/`:

| Secret Name | Fallback Env Var |
|-------------|-----------------|
| `db_password` | `DB_PASSWORD` |
| `redis_password` | `REDIS_PASSWORD` |
| `api_keys` | `API_KEYS` |

Docker secrets take priority over environment variables.
