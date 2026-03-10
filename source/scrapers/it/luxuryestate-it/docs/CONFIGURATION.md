# LuxuryEstate Scraper Configuration

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8123` | Express server port |

### Ingest API

| Variable | Default | Description |
|----------|---------|-------------|
| `INGEST_API_URL` | `http://localhost:3004` | Base URL of the ingest service |
| `INGEST_API_KEY_LUXURYESTATE_IT` | `dev_key_it_1` | Portal-specific API auth key |
| `INGEST_API_KEY` | `dev_key_it_1` | Fallback API key (used if portal-specific key is absent) |

The ingest adapter checks for `INGEST_API_KEY_LUXURYESTATE_IT` first and falls back to `INGEST_API_KEY`.

### Redis (BullMQ)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (none) | Redis password; omit or leave empty for unauthenticated Redis |

### Worker / Concurrency

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `2` | BullMQ detail worker concurrency |

The default concurrency of 2 is intentionally conservative given that LuxuryEstate.com has a relatively small corpus (~2,400 listings) and no rate limiting is required beyond the built-in 500ms inter-request delay.

---

## BullMQ Queue Configuration

### Queue: `luxuryestate-it-details`

| Setting | Value |
|---------|-------|
| Job batch size (Phase 3 queueing) | 50 listings per job |
| Job retry attempts | 3 |
| Retry backoff strategy | Exponential, 2s base |
| Remove completed jobs | After retention window (default BullMQ settings) |
| Remove failed jobs | Retained for 2 hours for debugging |

### Worker

| Setting | Value |
|---------|-------|
| Concurrency | 2 (configurable via `WORKER_CONCURRENCY`) |
| Inter-request delay | 500ms |
| Ingest batch threshold | 100 items |
| Periodic flush interval | 10 seconds |

---

## Scraper Timing Configuration

These values are hardcoded in the scraper source and are not currently configurable via environment variables:

| Parameter | Value | Location |
|-----------|-------|----------|
| Max pages per search config | 50 | `src/scrapers/listingsScraper.ts` |
| Delay between pages | 600ms | `src/scrapers/listingsScraper.ts` |
| Phase 2 semaphore concurrency | 2 | `src/scraper/threePhaseOrchestrator.ts` |
| Detail fetch delay | 500ms | `src/queue/detailQueue.ts` |
| Ingest batch size | 100 | `src/queue/detailQueue.ts` |
| Periodic flush interval | 10,000ms | `src/queue/detailQueue.ts` |

---

## Docker Configuration

### Dockerfile

- **Base image:** `node:20-alpine`
- **Build:** Multi-stage — TypeScript compiled in builder stage, production stage runs compiled JS only
- **Health check:** `GET /health` every 30s, 10s timeout, 3 retries

### Docker Compose Service

```yaml
it-luxuryestate:
  build:
    context: .
    dockerfile: scrapers/Italy/luxuryestate-it/Dockerfile
  ports:
    - "8123:8123"
  environment:
    PORT: 8123
    REDIS_HOST: redis
    REDIS_PORT: 6379
    INGEST_API_URL: http://it-ingest:3000
    INGEST_API_KEY: ${API_KEYS_ITALY}
    WORKER_CONCURRENCY: 2
  depends_on:
    - redis
    - it-ingest
  networks:
    - it-network
```

### VPS Deployment

- **No residential IP required** — LuxuryEstate.com does not employ Cloudflare or Datadome
- Port: `8123`
- Trigger: `curl -X POST http://localhost:8123/scrape`
- Health check: `curl http://localhost:8123/health`

---

## Dependencies

```json
{
  "axios": "^1.6.0",
  "bullmq": "^5.x",
  "cheerio": "^1.0.0",
  "express": "^4.18.2"
}
```

---

## Search Configuration Reference

The 5 search configurations are defined in `src/scraper/threePhaseOrchestrator.ts`:

| Config ID | Base URL | Category | Transaction |
|-----------|----------|----------|-------------|
| `apartments-sale` | `https://www.luxuryestate.com/apartments-italy` | `apartment` | `sale` |
| `apartments-rent` | `https://www.luxuryestate.com/rent/apartments-italy` | `apartment` | `rent` |
| `villas-sale` | `https://www.luxuryestate.com/villas-italy` | `house` | `sale` |
| `villas-rent` | `https://www.luxuryestate.com/rent/villas-italy` | `house` | `rent` |
| `houses-sale` | `https://www.luxuryestate.com/houses-italy` | `house` | `sale` |

Pagination appends `?pag=N` for pages 2 and above. Page 1 uses the base URL with no query parameter.

---

## Checksum Configuration

Checksums are computed per listing from Phase 1 minimal data. The following fields are included in the checksum:

| Field | Source |
|-------|--------|
| `price` | `listing.price` (raw numeric from tracking-hydration) |
| `title` | `listing.title` |
| `city` | `listing.city` |
| `categoryHint` | `listing.categoryHint` |

A listing is re-fetched (Phase 3) only when its checksum differs from the stored value in the ingest API. This means price changes, title edits, and city reassignments all trigger a re-fetch, while purely visual changes (e.g., photo reordering) do not.
