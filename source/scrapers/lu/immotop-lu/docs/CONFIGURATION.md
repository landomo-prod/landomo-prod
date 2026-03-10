# Immotop.lu Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8231` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `20` | BullMQ detail worker concurrency (lower for HTML scraping) |

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
| `INGEST_API_KEY` | `dev_key_lu_1` | API key for ingest service |

## Docker Configuration

### Dockerfile

- **Base image:** `node:20-alpine`
- **Multi-stage build:** Builder stage compiles TypeScript, production stage runs compiled JS
- **Memory:** `--max-old-space-size=4096` (4GB) in start script
- **Health check:** HTTP GET `/health` every 30s, 10s timeout, 3 retries

### Docker Compose Service

```yaml
scraper-immotop:
  build:
    context: .
    dockerfile: scrapers/Luxembourg/immotop-lu/Dockerfile
  ports:
    - "8231:8231"
  environment:
    PORT: 8231
    REDIS_HOST: redis-lu
    REDIS_PORT: 6379
    INGEST_API_URL: http://ingest-api-lu:3000
    INGEST_API_KEY: ${API_KEY}
    WORKER_CONCURRENCY: 20
  depends_on:
    - redis-lu
    - ingest-api-lu
  networks:
    - lu-network
```

### Deployment

- Port: 8231
- Trigger: `curl -X POST http://localhost:8231/scrape`
- Docker Compose file: `docker/docker-compose-lu.yml`
- Env file: `docker/.env.lu`

## BullMQ Queue Configuration

### Queue: `immotop-details`

| Setting | Value |
|---------|-------|
| Job attempts | 3 |
| Backoff | Exponential, 1s base |
| Remove completed | After 1 hour or 1000 jobs |
| Remove failed | After 2 hours or 500 jobs |

### Worker

| Setting | Value |
|---------|-------|
| Concurrency | 20 (configurable) |
| Lock duration | 5 minutes |
| Lock renew | 2.5 minutes |
| Job delay | Random 300-800ms (polite HTML crawling) |

## Batch Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Ingest batch size | 100 | `detailQueue.ts` |
| Periodic flush interval | 5 seconds | `detailQueue.ts` |
| Discovery concurrency | pLimit(3) | `threePhaseOrchestrator.ts` |
| Page delay | 500-1000ms | `fetchData.ts` |

## Dependencies

```json
{
  "@landomo/core": "file:../../../shared-components",
  "axios": "^1.6.0",
  "bullmq": "^5.67.3",
  "express": "^4.18.2",
  "p-limit": "^5.0.0",
  "cheerio": "^1.0.0"
}
```
