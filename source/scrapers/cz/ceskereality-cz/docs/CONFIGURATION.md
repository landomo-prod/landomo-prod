# CeskeReality - Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8109` | Express server port |
| `MAX_PAGES` | `1000` | Max pagination pages per category |
| `DELAY_MS` | `300` | Delay between detail page requests (ms) |
| `CONCURRENCY` | `3` | Parallel detail page fetches (non-queue mode) |
| `WORKER_CONCURRENCY` | `3` | BullMQ worker concurrency |
| `INGEST_API_URL` | `http://localhost:3001` | Ingest service URL |
| `INGEST_API_KEY_CESKEREALITY` | `dev_key_cz_1` | API key for ingest |
| `REDIS_HOST` | `redis` | Redis host for BullMQ |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | _(none)_ | Redis password (omitted in dev) |
| `ENABLE_CHECKSUM_MODE` | _(none)_ | Enable three-phase checksum scraping |
| `CHECKSUM_API_URL` | _(none)_ | Checksum service URL |

## BullMQ Queue Configuration

**Queue name:** `ceskereality-details`

| Setting | Value |
|---------|-------|
| Max attempts | 5 |
| Backoff type | Exponential |
| Backoff delay | 10,000ms |
| Remove on complete | 1,000 jobs or 1 hour |
| Remove on fail | 500 jobs or 2 hours |
| Batch size | 100 properties |
| Flush interval | 5 seconds |

## Docker Configuration

```yaml
ceskereality:
  build:
    context: ./scrapers/Czech Republic/ceskereality
  ports:
    - "8109:8109"
  environment:
    - PORT=8109
    - INGEST_API_URL=http://ingest:3000
    - INGEST_API_KEY_CESKEREALITY=${API_KEY}
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - MAX_PAGES=1000
    - DELAY_MS=300
    - CONCURRENCY=3
  networks:
    - cz-network
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scrape` | Trigger full scrape run |
| `GET` | `/health` | Health check with queue stats |

## Ingestion Configuration

**Direct mode** (`ingestAdapter.ts`):
- Batch size: 50 listings
- Retries: 3 attempts (2s, 4s delays)
- Timeout: 60 seconds

**Queue mode** (`queueIngestAdapter.ts`):
- Batch accumulator size: 100 properties
- Flush interval: 5 seconds
- Uses axios with POST to `/bulk-ingest`
