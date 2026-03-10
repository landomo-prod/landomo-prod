# SReality Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8102` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `200` | BullMQ detail worker concurrency |
| `CONCURRENT_DETAILS` | `200` | p-limit concurrency for legacy detail fetcher |
| `CONCURRENT_PAGES` | `20` | Parallel listing pages per batch |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_REQUESTS` | `20000` | Requests allowed per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |

### Redis (BullMQ)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (none) | Redis password (omit for no auth) |

### Ingest API

| Variable | Default | Description |
|----------|---------|-------------|
| `INGEST_API_URL` | `http://localhost:3000` | Ingest service base URL |
| `INGEST_API_KEY` | (empty) | API key for ingest service |
| `INGEST_API_KEY_SREALITY` | (fallback to `INGEST_API_KEY`) | Portal-specific API key |

## Docker Configuration

### Dockerfile

- **Base image:** `node:20-alpine`
- **Multi-stage build:** Builder stage compiles TypeScript, production stage runs compiled JS
- **Memory:** `--max-old-space-size=4096` (4GB) in start script
- **Health check:** HTTP GET `/health` every 30s, 10s timeout, 3 retries

### Docker Compose Service

```yaml
cz-sreality:
  build:
    context: .
    dockerfile: scrapers/Czech Republic/sreality/Dockerfile
  ports:
    - "8102:8102"
  environment:
    PORT: 8102
    REDIS_HOST: redis
    REDIS_PORT: 6379
    INGEST_API_URL: http://cz-ingest:3000
    INGEST_API_KEY: ${API_KEY}
    WORKER_CONCURRENCY: 200
  depends_on:
    - redis
    - cz-ingest
  networks:
    - cz-network
```

### VPS Deployment

- Port: 8102
- Trigger: `curl -X POST http://localhost:8102/scrape`
- With categories: `curl -X POST http://localhost:8102/scrape?categories=critical`

## BullMQ Queue Configuration

### Queue: `sreality-details`

| Setting | Value |
|---------|-------|
| Job attempts | 3 |
| Backoff | Exponential, 1s base |
| Remove completed | After 1 hour or 1000 jobs |
| Remove failed | After 2 hours or 500 jobs |

### Worker

| Setting | Value |
|---------|-------|
| Concurrency | 350 (configurable) |
| Lock duration | 5 minutes |
| Lock renew | 2.5 minutes |
| Limiter | 20,000 per 60s |

## Batch Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Ingest batch size | 100 | `detailQueue.ts` |
| Periodic flush interval | 5 seconds | `detailQueue.ts` |
| Ingest timeout | 120 seconds | `ingestAdapter.ts` |
| Listing page size | 100 | `fetchData.ts` |

## Dependencies

```json
{
  "@landomo/core": "file:../../../shared-components",
  "axios": "^1.6.0",
  "bullmq": "^5.67.3",
  "express": "^4.18.2",
  "p-limit": "^5.0.0",
  "pg": "^8.11.0"
}
```
