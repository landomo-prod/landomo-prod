# Ingest Service

Centralized REST API and background worker system for property data ingestion into the Landomo platform.

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| HTTP Framework | Fastify | 4.x |
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20 |
| Job Queue | BullMQ | 5.x |
| Database | PostgreSQL | 16 |
| Cache/Queue Backend | Redis | 7 |
| Metrics | prom-client (Prometheus) | 15.x |
| Logging | Pino | 9.x |
| Error Tracking | Sentry | 10.x |
| Shared Types | @landomo/core (local) | file:../shared-components |

## Architecture

```
                         ┌─────────────────────────────────────────────────┐
                         │              Ingest Service                      │
                         │                                                 │
  Scrapers ──────────┐   │  ┌──────────────────────────────────────────┐   │
                     │   │  │          HTTP API (server.ts)             │   │
                     ▼   │  │                                          │   │
              ┌──────────┤  │  Middleware Chain:                       │   │
              │ POST     │  │    Request ID → Metrics → Security Log   │   │
              │ /bulk-   │  │    → IP Whitelist → Auth → Rate Limiter  │   │
              │  ingest  │  │    → Input Sanitizer → Error Handler     │   │
              └────┬─────┤  │                                          │   │
                   │     │  │  Routes:                                 │   │
                   │     │  │    /bulk-ingest  /ingest  /scrape-runs   │   │
                   │     │  │    /checksums    /health  /metrics       │   │
                   │     │  │    /monitoring   /data-quality  /auth    │   │
                   │     │  │    /usage        /api/versions           │   │
                   │     │  └──────────┬───────────────────────────────┘   │
                   │     │             │                                    │
                   │     │             ▼                                    │
                   │     │  ┌──────────────────────┐                       │
                   │     │  │   Redis / BullMQ      │                      │
                   │     │  │   Queue per country:   │                      │
                   │     │  │   ingest-property-{cc} │                      │
                   │     │  └──────────┬─────────────┘                     │
                   │     │             │                                    │
                   │     │             ▼                                    │
                   │     │  ┌──────────────────────────────────────────┐   │
                   │     │  │      Worker Process (start-worker.ts)     │   │
                   │     │  │                                          │   │
                   │     │  │  ┌─────────────────────────────────────┐ │   │
                   │     │  │  │ Batch Ingestion Worker               │ │   │
                   │     │  │  │ - Groups by category                 │ │   │
                   │     │  │  │ - Bulk UPSERT per partition          │ │   │
                   │     │  │  │ - Lifecycle tracking                 │ │   │
                   │     │  │  │ - Cache invalidation via Redis PUB  │ │   │
                   │     │  │  └─────────────────────────────────────┘ │   │
                   │     │  │  ┌─────────────────────────────────────┐ │   │
                   │     │  │  │ Staleness Checker (cron)             │ │   │
                   │     │  │  │ Data Quality Checker (cron)          │ │   │
                   │     │  │  │ Alert Checker (cron)                 │ │   │
                   │     │  │  │ Polygon Sync (monthly cron)          │ │   │
                   │     │  │  └─────────────────────────────────────┘ │   │
                   │     │  └──────────┬───────────────────────────────┘   │
                   │     │             │                                    │
                   │     │             ▼                                    │
                   │     │  ┌──────────────────────────────────────────┐   │
                   │     │  │      PostgreSQL (per-country)             │   │
                   │     │  │      landomo_{country_code}               │   │
                   │     │  │                                          │   │
                   │     │  │  Partitioned by property_category:       │   │
                   │     │  │    properties_apartment                  │   │
                   │     │  │    properties_house                      │   │
                   │     │  │    properties_land                       │   │
                   │     │  │    properties_commercial                 │   │
                   │     │  │    properties_other                      │   │
                   │     │  └──────────────────────────────────────────┘   │
                   │     │                                                 │
                   │     └─────────────────────────────────────────────────┘
```

## Two-Process Architecture

The ingest service runs as **two separate processes** from the same Docker image:

1. **API Server** (`node dist/server.js`) - Accepts HTTP requests, validates input, enqueues jobs to Redis
2. **Worker** (`node dist/start-worker.js`) - Processes queued jobs, performs database writes, runs scheduled tasks

## Quick Start

```bash
# Install dependencies
cd ingest-service
npm install

# Start API server (Terminal 1)
npm run dev

# Start worker (Terminal 2)
npm run dev:worker

# Or in production
npm run build
npm start           # API server
npm run start:worker # Worker process
```

## Health Check

```bash
curl http://localhost:3000/api/v1/health
```

```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T12:00:00.000Z",
  "uptime": 3600.5,
  "version": "1.0.0"
}
```

No authentication required.

## File Structure

```
ingest-service/
├── src/
│   ├── server.ts                          # Fastify HTTP server entry point
│   ├── start-worker.ts                    # Worker process entry point
│   ├── config/
│   │   └── index.ts                       # Environment configuration
│   ├── database/
│   │   ├── manager.ts                     # Multi-DB connection pool manager
│   │   ├── bulk-operations.ts             # Category-specific UPSERT functions
│   │   ├── staleness-operations.ts        # Lifecycle & staleness DB operations
│   │   └── dedup-operations.ts            # Cross-portal deduplication
│   ├── queue/
│   │   └── internal-queue.ts              # BullMQ queue (per-country)
│   ├── routes/
│   │   ├── bulk-ingest.ts                 # POST /api/v1/properties/bulk-ingest
│   │   ├── ingest.ts                      # POST /api/v1/properties/ingest
│   │   ├── scrape-runs.ts                 # Scrape run lifecycle endpoints
│   │   ├── checksums.ts                   # Checksum compare/update endpoints
│   │   ├── health.ts                      # GET /api/v1/health
│   │   ├── metrics.ts                     # GET /metrics (Prometheus)
│   │   ├── monitoring-dashboard.ts        # GET /api/v1/monitoring/dashboard
│   │   ├── data-quality.ts               # Data quality snapshot endpoints
│   │   ├── auth-verify.ts                 # GET /api/v1/auth/verify
│   │   ├── api-versions.ts               # GET /api/versions
│   │   └── api-usage.ts                   # API usage analytics
│   ├── middleware/
│   │   ├── auth.ts                        # Bearer token auth (timing-safe)
│   │   ├── rate-limiter.ts                # Redis sliding window rate limiter
│   │   ├── error-handler.ts               # Global error handler + Sentry
│   │   ├── input-sanitizer.ts             # Input sanitization hook
│   │   ├── ip-whitelist.ts                # IP whitelist hook
│   │   ├── request-id.ts                  # X-Request-ID correlation
│   │   ├── api-version.ts                 # API version response headers
│   │   └── security-logger.ts             # Security audit logging
│   ├── workers/
│   │   ├── batch-ingestion.ts             # Main ingestion worker
│   │   ├── staleness-checker.ts           # Staleness detection (cron)
│   │   ├── data-quality-checker.ts        # Data quality analysis (cron)
│   │   ├── alert-checker.ts               # Alert evaluation (cron)
│   │   └── polygon-sync.ts               # Boundary sync (monthly cron)
│   ├── metrics/
│   │   ├── index.ts                       # Prometheus metric definitions
│   │   ├── middleware.ts                  # HTTP metrics collection hooks
│   │   └── queue-metrics.ts              # BullMQ queue gauge collector
│   ├── logger.ts                          # Pino structured logging
│   ├── sentry.ts                          # Sentry error tracking init
│   └── tracing.ts                         # OpenTelemetry tracing
├── migrations/                            # PostgreSQL migrations (001-034)
├── Dockerfile                             # Multi-stage build
├── docker-compose.yml                     # Local dev compose
├── package.json
└── tsconfig.json
```

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/server.js` | Start API server (production) |
| `start:worker` | `node dist/start-worker.js` | Start worker (production) |
| `dev` | `tsx watch src/server.ts` | Start API server with hot reload |
| `dev:worker` | `tsx watch src/start-worker.ts` | Start worker with hot reload |
| `test` | `jest` | Run tests |
| `lint` | `eslint 'src/**/*.ts'` | Lint check |
| `lint:fix` | `eslint 'src/**/*.ts' --fix` | Auto-fix lint issues |
| `format` | `prettier --write 'src/**/*.ts'` | Format code |
| `type-check` | `tsc --noEmit` | Type-check without emitting |
