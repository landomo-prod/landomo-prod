# Immoweb Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8210` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `50` | BullMQ detail worker concurrency |
| `CONCURRENT_PAGES` | `5` | Parallel listing pages per batch |

### Redis (BullMQ)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (none) | Redis password (omit for no auth) |

### Ingest API

| Variable | Default | Description |
|----------|---------|-------------|
| `INGEST_API_URL` | `http://localhost:3004` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_be_1` | API key for ingest service |

## Docker Configuration

### Dockerfile

- **Base image:** `node:20-alpine`
- **Multi-stage build:** Builder stage compiles TypeScript, production stage runs compiled JS
- **Memory:** `--max-old-space-size=4096` (4GB) in start script
- **Health check:** HTTP GET `/health` every 30s, 10s timeout, 3 retries

### Docker Compose Service

```yaml
be-immoweb:
  build:
    context: .
    dockerfile: scrapers/Belgium/immoweb-be/Dockerfile
  ports:
    - "8210:8210"
  environment:
    PORT: 8210
    REDIS_HOST: redis
    REDIS_PORT: 6379
    INGEST_API_URL: http://be-ingest:3000
    INGEST_API_KEY: ${API_KEY}
    WORKER_CONCURRENCY: 50
  depends_on:
    - redis
    - be-ingest
  networks:
    - be-network
```

## BullMQ Queue Configuration

### Queue: `immoweb-details`

| Setting | Value |
|---------|-------|
| Job attempts | 3 |
| Backoff | Exponential, 1s base |
| Remove completed | After 1 hour or 1000 jobs |
| Remove failed | After 2 hours or 500 jobs |

### Worker

| Setting | Value |
|---------|-------|
| Concurrency | 50 (configurable) |
| Lock duration | 5 minutes |
| Lock renew | 2.5 minutes |
| Job delay | 300-800ms random jitter |

## Batch Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Ingest batch size | 50 | `detailQueue.ts` |
| Periodic flush interval | 5 seconds | `detailQueue.ts` |
| Search page size | 30 | `fetchData.ts` |
| Request timeout | 30 seconds | `fetchData.ts` |

## Cloudflare Bypass Status

Immoweb uses Cloudflare WAF. The current HTTP-based approach works intermittently. For reliable production scraping, Puppeteer with stealth plugin is recommended. The scraper gracefully handles 403 responses by logging a warning and returning empty results.
