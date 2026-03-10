# Reality.cz Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8102` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `3` | BullMQ detail worker concurrency |
| `DETAIL_RATE_LIMIT_MS` | `1500` | Base delay (ms) between detail fetches |

### Checksum

| Variable | Default | Description |
|----------|---------|-------------|
| `FORCE_REFRESH_HOURS` | `24` | Force re-fetch even if checksum unchanged after this many hours |

### Redis (BullMQ)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (none) | Redis password (omit for no auth) |

### Ingest API

| Variable | Default | Description |
|----------|---------|-------------|
| `INGEST_API_URL` | `http://cz-ingest:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_cz_1` | API key for ingest service |
| `INGEST_API_KEY_REALITY` | (fallback to `INGEST_API_KEY`) | Portal-specific API key |

## Docker Configuration

### Dockerfile

- **Base image:** `node:20-slim`
- **Multi-stage build:** Builder stage compiles TypeScript, production stage runs compiled JS
- **Exposed port:** 8086 (Dockerfile default, overridden by `PORT` env var)
- **Health check:** HTTP GET `/health` every 30s, 10s timeout, 40s start period, 3 retries

### Docker Compose Service

```yaml
cz-reality:
  build:
    context: .
    dockerfile: scrapers/Czech Republic/reality/Dockerfile
  ports:
    - "8104:8104"
  environment:
    PORT: 8104
    REDIS_HOST: redis
    REDIS_PORT: 6379
    INGEST_API_URL: http://cz-ingest:3000
    INGEST_API_KEY: ${API_KEY}
    WORKER_CONCURRENCY: 3
    DETAIL_RATE_LIMIT_MS: 1500
  depends_on:
    - redis
    - cz-ingest
  networks:
    - cz-network
```

### VPS Deployment

- Port: 8104
- Trigger: `curl -X POST http://localhost:8104/scrape`

## BullMQ Queue Configuration

### Queue: `reality-details`

| Setting | Value |
|---------|-------|
| Job attempts | 5 |
| Backoff | Exponential, 10s base |
| Remove completed | After 1 hour or 500 jobs |
| Remove failed | After 2 hours or 200 jobs |

### Worker

| Setting | Value |
|---------|-------|
| Concurrency | 3 |
| Rate limiter | Max 3 requests per 5 seconds |
| Lock duration | 120 seconds |
| Lock renew | 60 seconds |

## Batch Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Search page size | 100 | `realityApiScraper.ts` |
| Ingest batch size | 50 | `detailQueue.ts` |
| Periodic flush interval | 10 seconds | `detailQueue.ts` |
| Ingest timeout | 30 seconds | `ingestAdapter.ts` |
| Search rate limit | 500ms between pages | `realityApiScraper.ts` |
| Detail rate limit | 1500ms + 0-500ms jitter | `detailQueue.ts` |
| Checksum batch size | 5000 | `threePhaseOrchestrator.ts` |

## API Authentication

The scraper authenticates with the Reality.cz mobile API:
- **Base URL:** `https://api.reality.cz`
- **Auth token:** `Token 5c858f9578fc6f0a12ec9f367b1807b3` (in Authorization header)
- **User-Agent:** `Android Mobile Client 3.1.4b47`
- **Session:** Guest login returns `sid` cookie, valid for ~2 years

No user credentials are required; the guest session provides full read access to all listings.

## Dependencies

```json
{
  "@landomo/core": "file:../../../shared-components",
  "axios": "^1.6.0",
  "bullmq": "^5.70.0",
  "express": "^4.18.2"
}
```
