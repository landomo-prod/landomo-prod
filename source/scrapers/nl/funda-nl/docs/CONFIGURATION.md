# Funda Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8220` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `50` | BullMQ detail worker concurrency |
| `CONCURRENT_PAGES` | `5` | Parallel search pages per batch |
| `MAX_PAGES` | `500` | Maximum search pages to fetch per transaction type |

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

## Docker Configuration

### Dockerfile

- **Base image:** `node:20-alpine`
- **Multi-stage build:** Builder stage compiles TypeScript, production stage runs compiled JS
- **Memory:** `--max-old-space-size=4096` (4GB) in start script
- **Health check:** HTTP GET `/health` every 30s, 10s timeout, 3 retries

### Docker Compose Service

```yaml
nl-funda:
  build:
    context: .
    dockerfile: scrapers/Netherlands/funda-nl/Dockerfile
  ports:
    - "8220:8220"
  environment:
    PORT: 8220
    REDIS_HOST: redis
    REDIS_PORT: 6379
    INGEST_API_URL: http://nl-ingest:3000
    INGEST_API_KEY: ${API_KEY}
    WORKER_CONCURRENCY: 50
    CONCURRENT_PAGES: 5
  depends_on:
    - redis
    - nl-ingest
  networks:
    - nl-network
```

### Deployment

- Port: 8220
- Trigger: `curl -X POST http://localhost:8220/scrape`

## BullMQ Queue Configuration

### Queue: `funda-details`

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

## Batch Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Ingest batch size | 100 | `detailQueue.ts` |
| Periodic flush interval | 5 seconds | `detailQueue.ts` |
| Detail fetch delay | 200-800ms random | `detailQueue.ts` |
| Page fetch delay | 500-1000ms between batches | `fetchData.ts` |
| Search page size | 25 (Funda default) | `fetchData.ts` |

## Rate Limiting Notes

Funda has aggressive bot detection. Keep concurrency conservative:

- `CONCURRENT_PAGES=5` (default) prevents triggering captcha walls
- `WORKER_CONCURRENCY=50` with 200-800ms random delays between detail fetches
- 500-1000ms delays between search page batches
- Dutch locale headers (`nl-NL`) are rotated to appear as local traffic

## Dependencies

```json
{
  "@landomo/core": "file:../../../shared-components",
  "axios": "^1.6.0",
  "bullmq": "^5.67.3",
  "cheerio": "^1.0.0",
  "express": "^4.18.2",
  "p-limit": "^5.0.0"
}
```
