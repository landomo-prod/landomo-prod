# Realingo - Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8106` | Express server port |
| `WORKER_CONCURRENCY` | `10` | BullMQ worker concurrency |
| `INGEST_API_URL` | `http://localhost:3000` | Ingest service URL |
| `INGEST_API_KEY` | _(empty)_ | API key for ingest + checksum services |
| `REDIS_HOST` | `redis` | Redis host for BullMQ |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | _(none)_ | Redis password |

## BullMQ Queue Configuration

**Queue name:** `realingo-details`

| Setting | Value |
|---------|-------|
| Max attempts | 5 |
| Backoff type | Exponential |
| Backoff delay | 10,000ms |
| Job batch size | 50 offers per job |
| Ingest batch size | 100 properties |
| Concurrency | 10 workers |
| Remove on complete | 1,000 jobs or 1 hour |
| Remove on fail | 500 jobs or 2 hours |
| Flush interval | 5 seconds |

## Docker Configuration

```yaml
realingo:
  build:
    context: ./scrapers/Czech Republic/realingo
  ports:
    - "8106:8106"
  environment:
    - PORT=8106
    - INGEST_API_URL=http://ingest:3000
    - INGEST_API_KEY=${API_KEY}
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - WORKER_CONCURRENCY=10
  networks:
    - cz-network
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scrape` | Trigger full three-phase scrape |
| `GET` | `/health` | Health check with queue stats |
| `GET` | `/metrics` | Prometheus metrics endpoint |

## GraphQL Configuration

- **Endpoint:** `https://www.realingo.cz/graphql`
- **Items per page:** 100
- **Delay between pages:** 50ms
- **Detail batch size:** 50 IDs per GraphQL alias request
- **Concurrent detail batches:** 10
- **Checksum semaphore:** Max 2 concurrent checksum API calls
