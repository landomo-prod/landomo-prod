# Subito.it Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8122` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `5` | BullMQ detail worker concurrency |

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
| `INGEST_API_KEY_SUBITO_IT` | `dev_key_it_1` | Portal-specific API key (checked first) |
| `INGEST_API_KEY` | `dev_key_it_1` | Fallback API key (used if portal-specific key is absent) |

> The scraper checks `INGEST_API_KEY_SUBITO_IT` first and falls back to `INGEST_API_KEY`. Both are accepted by the ingest API's key validation.

## Docker Configuration

### Dockerfile

- **Base image:** `node:20-alpine`
- **Multi-stage build:** Builder stage compiles TypeScript; production stage runs compiled JS
- **Health check:** HTTP GET `/health` every 30s, 10s timeout, 3 retries

### Docker Compose Service (Italy stack)

```yaml
it-subito:
  build:
    context: .
    dockerfile: scrapers/Italy/subito-it/Dockerfile
  ports:
    - "8122:8122"
  environment:
    PORT: 8122
    REDIS_HOST: redis
    REDIS_PORT: 6379
    INGEST_API_URL: http://it-ingest:3000
    INGEST_API_KEY_SUBITO_IT: ${API_KEY_IT}
    WORKER_CONCURRENCY: 5
  depends_on:
    - redis
    - it-ingest
  networks:
    - it-network
```

### Important: Residential IP Requirement

The Hades API (`hades.subito.it`) blocks requests from datacenter and VPS IP ranges. This scraper **must not be deployed to a VPS** for production scraping. Run it locally (residential IP) or via a residential proxy service.

```bash
# Trigger scrape locally
curl -X POST http://localhost:8122/scrape

# Health check
curl http://localhost:8122/health
```

## BullMQ Queue Configuration

### Queue: `subito-it-details`

| Setting | Value |
|---------|-------|
| Job attempts | 3 |
| Backoff type | Exponential |
| Backoff base | 2 seconds |
| Remove completed | After 1 hour or 500 jobs |
| Remove failed | After 2 hours or 200 jobs |

### Worker

| Setting | Value |
|---------|-------|
| Concurrency | 5 (configurable via `WORKER_CONCURRENCY`) |
| Queue name | `subito-it-details` |

## Batch Configuration

| Setting | Value | Location |
|---------|-------|----------|
| BullMQ job batch size | 50 listings per job | `threePhaseOrchestrator.ts` |
| Ingest batch threshold | 100 items | `detailQueue.ts` |
| Periodic flush interval | 5 seconds | `detailQueue.ts` |
| Page size (Hades API) | 35 | `listingsScraper.ts` |
| Combo concurrency | 3 simultaneous | `threePhaseOrchestrator.ts` (p-limit) |
| Checksum call concurrency | 2 simultaneous | `threePhaseOrchestrator.ts` (semaphore) |
| Delay between pages | 300ms | `threePhaseOrchestrator.ts` |

## Scrape Timing

| Run Type | Expected Duration |
|----------|------------------|
| First run (no checksums) | 20-40 minutes |
| Repeat run (10-20% changed) | 5-10 minutes |
| Repeat run (stable, <5% changed) | 3-5 minutes |

## Dependencies

Key runtime dependencies:

```json
{
  "@landomo/core": "file:../../../shared-components",
  "axios": "^1.6.0",
  "bullmq": "^5.x",
  "express": "^4.18.2",
  "p-limit": "^5.0.0"
}
```

## Ingest API Key Resolution Order

```
1. process.env.INGEST_API_KEY_SUBITO_IT   (portal-specific, preferred)
2. process.env.INGEST_API_KEY             (fallback)
```

The resolved key is sent as the `Authorization` or `X-API-Key` header on all requests to the ingest service.
