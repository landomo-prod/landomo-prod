# Deployment

## Docker Build

The service uses a multi-stage Dockerfile:

```dockerfile
# Stage 1: Build
FROM node:20-slim AS builder
# Build shared-components first (dependency)
# Then build ingest-service TypeScript

# Stage 2: Production
FROM node:20-slim
# Copy built artifacts and production dependencies only
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

The build requires `shared-components/` at `../shared-components` (linked via `file:../shared-components` in package.json).

### Build Commands

```bash
# From repo root
docker build -f ingest-service/Dockerfile -t landomo/ingest-service .
```

## Per-Country Deployment

Each country runs as a separate instance with its own:
- `INSTANCE_COUNTRY` environment variable
- PostgreSQL database (`landomo_{cc}`)
- BullMQ queues (suffixed with country code)
- API keys

### Container Topology (per country)

```
┌─────────────────┐    ┌─────────────────┐
│  ingest-{cc}    │    │  worker-{cc}    │
│  (API server)   │    │  (workers)      │
│  Port 3000      │    │  Metrics: 3006  │
│                 │    │                 │
│  CMD: server.js │    │  CMD:           │
│                 │    │  start-worker.js│
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────┐
│  Redis                                   │
│  (shared across country instances)       │
│  Queue isolation via queue name suffix   │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  landomo_{cc}   │
└─────────────────┘
```

### Docker Compose (Production Pattern)

```yaml
services:
  ingest-cz:
    image: landomo/ingest-service
    command: ["node", "dist/server.js"]
    ports:
      - "3006:3000"
    environment:
      INSTANCE_COUNTRY: cz
      DB_HOST: cz-postgres
      DB_USER: landomo
      REDIS_HOST: redis
      PORT: 3000
    secrets:
      - db_password
      - api_keys_czech
      - redis_password

  worker-cz:
    image: landomo/ingest-service
    command: ["node", "dist/start-worker.js"]
    environment:
      INSTANCE_COUNTRY: cz
      DB_HOST: cz-postgres
      DB_USER: landomo
      REDIS_HOST: redis
      BATCH_WORKERS: 5
      STALENESS_THRESHOLD_HOURS: 72
      STALENESS_CRON: "0 */6 * * *"
      WORKER_METRICS_PORT: 3006
    secrets:
      - db_password
      - redis_password
```

## Environment Secrets

### Docker Secrets

Place secret files in the Docker secrets directory:

| Secret File | Content | Used By |
|------------|---------|---------|
| `db_password` | PostgreSQL password | API + Worker |
| `api_keys_{country}` | Comma-separated API keys | API only |
| `redis_password` | Redis password | API + Worker |

Secrets are read from `/run/secrets/{name}` at startup.

### Secret Format

**API Keys:**

```
dev_key_cz_1,prod_key_cz_abc:v2:2026-12-31
```

**Database Password:**

```
my_secure_password
```

## Health Checks

### API Server

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Worker

The worker process exposes a Prometheus metrics endpoint on `WORKER_METRICS_PORT` (default 3006):

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3006/metrics"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Monitoring

### Prometheus Scraping

Two scrape targets per country:

| Target | Port | Path | Metrics |
|--------|------|------|---------|
| API Server | 3000 | `/metrics` | HTTP request metrics, queue depth |
| Worker | 3006 | `/metrics` | Ingestion metrics, staleness, data quality, alerts |

### Grafana Dashboards

Pre-built dashboards in `docker/monitoring/grafana-dashboards/`:

- `czech-mvp-overview.json` - Country overview
- `database-performance.json` - DB query performance
- `infrastructure.json` - System metrics
- `scraper-health.json` - Scraper freshness and quality

## VPS Deployment Notes

For the Czech Republic VPS deployment:

| Setting | Value |
|---------|-------|
| SSH | `ssh landomo-vps` |
| VPS path | `/opt/landomo/scrapers/Czech/` |
| DB name | `landomo_cz` |
| `INSTANCE_COUNTRY` | `cz` |
| Ingest port | 3006 (mapped from internal 3000) |
| Network | `docker_cz-network` |

## Local Development

### docker-compose.yml (included)

```bash
# Start infrastructure
docker compose up -d postgres redis

# Run API and worker locally
npm run dev         # Terminal 1
npm run dev:worker  # Terminal 2
```

Default local config:

| Service | Host | Port |
|---------|------|------|
| PostgreSQL | localhost | 5432 |
| Redis | localhost | 6379 |
| API | localhost | 3000 |
| Worker metrics | localhost | 3006 |

### Required Infrastructure

1. **PostgreSQL 16** - Create country database and apply migrations:
   ```bash
   createdb -U landomo landomo_cz
   psql -U landomo -d landomo_cz -f ingest-service/migrations/001_multi_tier_schema.sql
   # ... apply all migrations in order through 034
   ```

2. **Redis 7** - No special configuration needed for local dev (no auth).

3. **shared-components** - Must be built before ingest-service:
   ```bash
   cd shared-components && npm install && npm run build
   cd ../ingest-service && npm install
   ```
