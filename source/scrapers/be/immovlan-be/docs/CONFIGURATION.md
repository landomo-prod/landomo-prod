# Immovlan Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8212` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `30` | BullMQ detail worker concurrency |
| `CONCURRENT_PAGES` | `3` | Parallel listing pages per batch |

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

### Docker Compose Service

```yaml
be-immovlan:
  build:
    context: .
    dockerfile: scrapers/Belgium/immovlan-be/Dockerfile
  ports:
    - "8212:8212"
  environment:
    PORT: 8212
    REDIS_HOST: redis
    REDIS_PORT: 6379
    INGEST_API_URL: http://be-ingest:3000
    INGEST_API_KEY: ${API_KEY}
    WORKER_CONCURRENCY: 30
  depends_on:
    - redis
    - be-ingest
  networks:
    - be-network
```

## BullMQ Queue Configuration

### Queue: `immovlan-details`

| Setting | Value |
|---------|-------|
| Job attempts | 3 |
| Backoff | Exponential, 1s base |
| Remove completed | After 1 hour or 1000 jobs |
| Remove failed | After 2 hours or 500 jobs |

## Batch Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Ingest batch size | 50 | `detailQueue.ts` |
| Periodic flush interval | 5 seconds | `detailQueue.ts` |
| Results per page | 20 | `fetchData.ts` |
| Inter-page delay | 1500ms | `fetchData.ts` |
