# Realo BE Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8214` | Express server port |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `50` | BullMQ detail worker concurrency |

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
be-realo:
  build:
    context: .
    dockerfile: scrapers/Belgium/realo-be/Dockerfile
  ports:
    - "8214:8214"
  environment:
    PORT: 8214
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

### Queue: `realo-be-details`

| Setting | Value |
|---------|-------|
| Job attempts | 3 |
| Backoff | Exponential, 1s base |
| Remove completed | After 1 hour or 1000 jobs |
| Remove failed | After 2 hours or 500 jobs |

## Batch Configuration

| Setting | Value |
|---------|-------|
| Ingest batch size | 50 |
| Periodic flush interval | 5 seconds |
| Request timeout | 30 seconds |
| Page limit | 200 pages per category |
| Inter-request delay | 200-500ms |

## Dependencies

```json
{
  "@landomo/core": "file:../../../shared-components",
  "axios": "^1.6.0",
  "bullmq": "^5.67.3",
  "express": "^4.18.2",
  "cheerio": "^1.0.0-rc.12",
  "p-limit": "^5.0.0"
}
```
