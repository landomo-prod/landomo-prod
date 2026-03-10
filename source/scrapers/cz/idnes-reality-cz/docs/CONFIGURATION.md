# iDNES Reality - Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8087` | Express server port |
| `WORKER_CONCURRENCY` | `3` | BullMQ worker concurrency |
| `INGEST_API_URL` | `http://localhost:3000` | Ingest service URL |
| `INGEST_API_KEY` | _(empty)_ | API key for ingest + checksum services |
| `REDIS_HOST` | `redis` | Redis host for BullMQ |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | _(none)_ | Redis password (also reads Docker secret `/run/secrets/redis_password`) |

## BullMQ Queue Configuration

**Queue name:** `idnes-details`

| Setting | Value |
|---------|-------|
| Max attempts | 5 |
| Backoff type | Exponential |
| Backoff delay | 10,000ms |
| Rate limiter | Max 3 per 5,000ms |
| Lock duration | 120,000ms |
| Lock renew time | 60,000ms |
| Remove on complete | 1,000 jobs or 1 hour |
| Remove on fail | 500 jobs or 2 hours |
| Batch size | 100 properties |
| Flush interval | 5 seconds |

## Docker Configuration

```yaml
idnes-reality:
  build:
    context: ./scrapers/Czech Republic/idnes-reality
  ports:
    - "8087:8087"
  environment:
    - PORT=8087
    - INGEST_API_URL=http://ingest:3000
    - INGEST_API_KEY=${API_KEY}
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - WORKER_CONCURRENCY=3
  secrets:
    - redis_password
  networks:
    - cz-network
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scrape` | Trigger full three-phase scrape |
| `GET` | `/health` | Health check with queue stats and version |
| `GET` | `/metrics` | Prometheus metrics endpoint |

## Secrets

Redis password is read from Docker secrets at `/run/secrets/redis_password` with fallback to `REDIS_PASSWORD` env var.

## Metrics

Uses `@landomo/core` `setupScraperMetrics` for Prometheus:
- `scraper_scrape_duration_seconds` — scrape run duration
- `scraper_properties_scraped_total` — properties scraped counter
- `scraper_scrape_runs_total` — scrape run counter (success/failure)
- `scraper_scrape_run_active` — currently running scrape (0/1)
