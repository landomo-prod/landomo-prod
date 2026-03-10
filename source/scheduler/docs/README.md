# Scheduler Service

Centralized cron-based scheduler that orchestrates all Landomo scrapers across 5 countries. Sends HTTP POST triggers to scraper containers on configurable cron schedules with retry, circuit breaker, backpressure, and concurrency controls.

## Architecture

The scheduler is a standalone Node.js service (`@landomo/scheduler`) that:

1. Registers 25 scrapers across 5 countries with cron schedules
2. On each cron tick, performs pre-flight checks (circuit breaker, dedup, backpressure, health)
3. Acquires a concurrency slot (global + per-country limits)
4. Sends `POST /scrape` to the scraper container with retry and exponential backoff
5. Tracks success/failure state per scraper for circuit breaker logic

```
Scheduler (cron) --> POST /scrape --> Scraper Container
                                         |
                                    POST /bulk-ingest --> Ingest API
```

## Scrapers by Country

| Country | Portals | Count |
|---------|---------|-------|
| Czech Republic | sreality, bezrealitky, reality, idnes-reality, realingo, ulovdomov | 6 |
| Germany | immobilienscout24-de, immonet-de, immowelt-de, kleinanzeigen-de, wg-gesucht-de | 5 |
| Austria | willhaben-at, immobilienscout24-at, wohnnet-at, immowelt-at, immodirekt-at | 5 |
| Slovakia | nehnutelnosti-sk, reality-sk, topreality-sk, byty-sk | 4 |
| Hungary | ingatlan-com, oc-hu, dh-hu, zenga-hu, ingatlannet-hu | 5 |

## Key Features

- **Staggered scheduling**: Cron schedules are offset by 5-15 minutes to avoid thundering herd
- **Circuit breaker**: Opens after consecutive failures, auto-resets after cooldown
- **Backpressure**: Monitors BullMQ queue depth in Redis; skips triggers when queue is full
- **Concurrency limiting**: Global max + per-country limits with fair queuing
- **Health checks**: Pre-trigger health check to scraper `/health` endpoint (fail-open)
- **Deduplication**: Skips trigger if a previous run is still in progress
- **Correlation IDs**: UUID per trigger propagated via `X-Request-ID` header
- **Graceful shutdown**: Waits for in-flight triggers before exiting (30s timeout)
- **Structured logging**: Pino JSON logs with child loggers per concern (cron, trigger, http)

## HTTP API

Enabled when `ENABLE_HTTP_TRIGGERS=true`. Default port: 9000.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check with list of enabled scrapers |
| `/api/v1/scheduler/health` | GET | Comprehensive dashboard: statuses, queue depth, concurrency, recent failures |
| `/api/v1/scheduler/status` | GET | All scraper statuses with circuit breaker and retry info |
| `/trigger/:scraper` | POST | Manually trigger a scraper (async, returns immediately) |

## Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry: scraper config, cron scheduling, HTTP server, trigger logic, graceful shutdown |
| `src/scraper-status.ts` | Per-scraper state tracking: run dedup, circuit breaker open/close/reset |
| `src/retry.ts` | Exponential backoff with jitter, retryable error detection |
| `src/concurrency.ts` | Global + per-country concurrency slots with fair wait queue |
| `src/queue-monitor.ts` | Redis-based BullMQ queue depth monitoring for backpressure |
| `src/logger.ts` | Pino structured logger with child loggers (cron, trigger, http) |
| `src/tracing.ts` | OpenTelemetry setup (currently disabled) |

## Running

```bash
# Development
cd scheduler && npm run dev

# Production
cd scheduler && npm run build && npm start

# Docker
docker compose -f docker/docker-compose.yml up -d scheduler
```
