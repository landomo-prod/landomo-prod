# Configuration

All configuration is loaded from environment variables with sensible defaults. Sensitive values (passwords) can also be read from Docker secrets at `/run/secrets/<name>`.

## Environment Variables

### Server

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `4000` | HTTP listen port |
| `HOST` | string | `0.0.0.0` | HTTP listen address |
| `NODE_ENV` | string | `development` | Environment (`development`, `production`) |

### Database

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_HOST` | string | `localhost` | PostgreSQL host |
| `DB_PORT` | number | `5432` | PostgreSQL port |
| `DB_READ_USER` | string | `search_readonly` | Read-only database user |
| `DB_READ_PASSWORD` | string | `""` | Database password |
| `DB_MAX_CONNECTIONS` | number | `10` | Max pool connections per country |

The password is also read from Docker secret `/run/secrets/db_read_password` (takes priority over env var).

### Redis

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_HOST` | string | `localhost` | Redis host |
| `REDIS_PORT` | number | `6379` | Redis port |
| `REDIS_PASSWORD` | string | - | Redis password (optional) |

The password is also read from Docker secret `/run/secrets/redis_password`.

### Search

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DEFAULT_SEARCH_LIMIT` | number | `20` | Default results per page |
| `MAX_SEARCH_LIMIT` | number | `100` | Maximum results per page |

### Cache TTLs

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CACHE_SEARCH_TTL` / `CACHE_TTL_SEARCH` | number | `300` | Search results TTL (seconds) |
| `CACHE_DETAIL_TTL` / `CACHE_TTL_PROPERTY` | number | `1800` | Property detail TTL (seconds) |
| `CACHE_AGGREGATION_TTL` / `CACHE_TTL_AGGREGATIONS` | number | `3600` | Aggregations TTL (seconds) |
| `CACHE_TTL_FILTERS` | number | `86400` | Filter metadata TTL (seconds) |
| `CACHE_INVALIDATION_CHANNEL` | string | `property:updated` | Redis pub/sub channel prefix |

Additional hardcoded TTLs:
- Faceted aggregations (`/api/v1/aggregations`): 300s
- Filter options (`/api/v1/filters`): 600s
- Map tiles: 300s
- Price history: 600s
- Market trends: 3600s
- Search count (page 2+): 300s

### Geo Search

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DEFAULT_GEO_RADIUS_KM` | number | `10` | Default search radius in km |
| `MAX_GEO_RADIUS_KM` | number | `100` | Maximum search radius in km |

### Countries

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SUPPORTED_COUNTRIES` | string | `""` (all) | Comma-separated country codes to enable. Empty = all 11 countries. |

Example: `SUPPORTED_COUNTRIES=czech,uk,germany`

### Polygon Service (Boundary Proxy)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `POLYGON_SERVICE_URL` | string | `http://polygon-service:3100` | Polygon service URL |
| `POLYGON_SERVICE_API_KEY` | string | `""` | Polygon service API key |
| `POLYGON_SERVICE_TIMEOUT` | number | `30000` | Request timeout (ms) |

### CORS

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | string | `""` | Comma-separated allowed origins. Empty = defaults. |

Defaults:
- Production: `https://app.landomo.com`, `https://www.landomo.com`, `https://landomo.com`
- Development: also `http://localhost:3000`, `http://localhost:5173`

### Rate Limiting

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_DISABLED` | string | - | Set to `true` to disable rate limiting (e.g., load tests) |

### Observability

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SENTRY_DSN` | string | - | Sentry DSN for error tracking |

## Validation

On startup, `validateConfig()` checks:
- Port is between 1 and 65535
- Max connections >= 1
- Max search limit >= default search limit

Failure throws an error and prevents startup.

## Docker Secrets

The service reads passwords from Docker secrets (mounted at `/run/secrets/`) with fallback to environment variables:

| Secret Name | Env Fallback |
|-------------|-------------|
| `db_read_password` | `DB_READ_PASSWORD` |
| `redis_password` | `REDIS_PASSWORD` |

## Example .env

```env
PORT=4000
HOST=0.0.0.0
NODE_ENV=production

DB_HOST=postgres
DB_PORT=5432
DB_READ_USER=search_readonly
DB_MAX_CONNECTIONS=15

REDIS_HOST=redis
REDIS_PORT=6379

DEFAULT_SEARCH_LIMIT=20
MAX_SEARCH_LIMIT=100

CACHE_SEARCH_TTL=300
CACHE_DETAIL_TTL=1800
CACHE_AGGREGATION_TTL=3600
CACHE_TTL_FILTERS=86400
CACHE_INVALIDATION_CHANNEL=property:updated

DEFAULT_GEO_RADIUS_KM=10
MAX_GEO_RADIUS_KM=100

SUPPORTED_COUNTRIES=czech,uk,australia

POLYGON_SERVICE_URL=http://polygon-service:3100
POLYGON_SERVICE_API_KEY=my-polygon-key

CORS_ALLOWED_ORIGINS=https://app.landomo.com,https://landomo.com
```
