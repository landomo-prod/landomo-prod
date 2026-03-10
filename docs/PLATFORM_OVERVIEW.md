# Landomo Platform Overview

Complete end-to-end description of how data flows from real estate portals to end users.

---

## What It Does

Landomo aggregates property listings from real estate portals across multiple countries into a unified, searchable database. Scrapers pull raw listings, transformers normalize them to typed schemas, the ingest API stores them in per-country PostgreSQL databases, and the search service exposes them to frontends.

**Current scope:** Czech Republic (6 portals), Germany (5), Austria (5), Slovakia (4), Hungary (5) — 25 scrapers total.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SCHEDULER                                  │
│   node-cron per scraper → POST /scrape → retry + circuit breaker    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP POST (fire-and-forget)
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        [scraper-A]     [scraper-B]     [scraper-N]
        Express :8102   Express :8103   Express :810x
              │                │                │
              └────────────────┼────────────────┘
                               │ POST /api/v1/properties/bulk-ingest
                               ▼
                    ┌──────────────────────┐
                    │     INGEST API        │
                    │   Fastify :3000       │
                    │   per-country         │
                    └──────────┬───────────┘
                               │ BullMQ job → Redis
                               ▼
                    ┌──────────────────────┐
                    │      WORKER          │
                    │  (same Docker image) │
                    │  dist/start-worker.js│
                    └──────────┬───────────┘
                               │ UPSERT
                               ▼
                    ┌──────────────────────┐
                    │   PostgreSQL         │
                    │   per-country DB     │
                    │   category-partitioned│
                    └──────────┬───────────┘
                               │
               ┌───────────────┼────────────────┐
               ▼               ▼                ▼
        ┌────────────┐  ┌────────────┐  ┌────────────────┐
        │  SEARCH    │  │  POLYGON   │  │  ML PRICING    │
        │  :4000     │  │  :4300     │  │  :3500         │
        └─────┬──────┘  └─────┬──────┘  └───────┬────────┘
              │               │                  │
              └───────────────┼──────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │    FRONTEND          │
                    │   Next.js / React    │
                    └──────────────────────┘
```

---

## Step-by-Step Data Flow

### 1. Scheduler Triggers a Scraper

The scheduler (`scheduler/src/index.ts`) runs 25 `node-cron` jobs — one per scraper. Each job fires at a staggered time to prevent thundering herd (e.g. sreality at `:00`, bezrealitky at `:10`, reality at `:20` of every 3rd or 4th hour).

Before triggering, the scheduler performs four pre-checks in order:
1. **Shutdown guard** — skip if graceful shutdown is in progress
2. **Circuit breaker / dedup** — skip if `circuitBreakerOpen` or `runInProgress` (`scraper-status.ts`)
3. **Backpressure** — skip if Redis queue depth ≥ threshold (`queue-monitor.ts`)
4. **Health check** — GET `/health` on scraper (fails open: if health check errors, proceed anyway)

If all pass, a `correlationId` (UUID) is generated and a `POST /scrape` fires at the scraper's Docker service URL with a 5 second timeout. The trigger itself retries up to 3 times with exponential backoff (`retry.ts`):

```
delay = min(initialDelay × 2^attempt, maxDelay) ± 20% jitter
defaults: initialDelay=5s, maxDelay=60s, maxRetries=3
```

**Circuit breaker** (`scraper-status.ts`):
- Opens after `SCHEDULER_CB_THRESHOLD` (default: 5) consecutive failures
- Auto-resets after `SCHEDULER_CB_RESET_MS` (default: 1 hour)
- Run dedup: `runInProgress` flag + `SCHEDULER_RUN_TIMEOUT_MS` (default: 30 min) stale-run detection

The `correlationId` is passed as `X-Request-ID` and propagates through the entire pipeline for distributed tracing.

---

### 2. Scraper Fetches Portal Data

Each scraper is an Express server (port 8102–8107 for Czech). On `POST /scrape`, it:

1. Registers a scrape run with the ingest API (`POST /api/v1/scrape-runs/start`)
2. Fetches listings from the portal (REST API, GraphQL, or HTML scraping)
3. Transforms raw data to typed TierI properties
4. POSTs batches to `POST /api/v1/properties/bulk-ingest`
5. Marks the run complete or failed (`POST /api/v1/scrape-runs/complete|fail`)

**Scraper patterns used across Czech portals:**

| Pattern | Portals | How |
|---|---|---|
| GraphQL all-in-one | bezrealitky | Single query returns full data; 20 parallel pages × 14 categories |
| Two-phase (search→detail) | sreality, reality.cz | Fast ID discovery → parallel/sequential detail fetch |
| REST pagination | ulovdomov, idnes-reality | Sequential pages with delays |
| GraphQL streaming (alias batching) | realingo | 50 IDs per batched alias query |
| HTML + LLM extraction | bazos | HTML scraping + Azure OpenAI for field normalization |

**Checksum mode** (implemented in bezrealitky, ulovdomov):
```
1. Fetch all listing pages (IDs + hash fields — cheap)
2. Generate checksums: hash(price, title, sqm, bedrooms, floor)
3. POST /api/v1/checksums/compare → { new, changed, unchanged }
4. Fetch/transform ONLY new + changed listings (typically 10–20%)
5. POST /api/v1/checksums/update to mark all as seen
→ 80–90% reduction in ingest volume on stable periods
```

**IngestAdapter** (`adapters/ingestAdapter.ts`) — shared across all scrapers:
- Reads `INGEST_API_URL` and `INGEST_API_KEY_<PORTAL>` (falls back to `INGEST_API_KEY`)
- Retries 5xx and network errors (3 retries, exponential backoff + 0–1s jitter, 30s cap)
- Does NOT retry 4xx (client errors are bugs, not transient failures)

---

### 3. Ingest API Validates and Queues

The ingest API (`ingest-service`, Fastify on `:3000`) is deployed per country. It:

1. **Authenticates** — Bearer token against `API_KEYS_<COUNTRY>` env var (comma-separated list)
2. **Validates** — checks `property_category` is one of `apartment|house|land|commercial`
3. **Batch splits** — incoming array → chunks of `BATCH_SIZE` (default 100)
4. **Enqueues** — each chunk becomes a BullMQ job on `ingest-property-<country>` queue (Redis)
5. **Returns 202** immediately — ingestion is fully async

Key queues per country:
```
ingest-property-cz       ← bulk property batches
staleness-check-cz       ← scheduled staleness sweep (every 6h)
data-quality-check-cz    ← data quality checks
alert-check-cz           ← user alert matching
```

> **Why per-country queues?** An earlier shared `ingest-property` queue caused jobs from Czech scrapers to be picked up by Slovak workers — fixed by adding the country suffix.

---

### 4. Worker UPSERTs to PostgreSQL

The worker (`dist/start-worker.js`, same Docker image as the API) processes `ingest-property-<country>` jobs:

1. **Pre-SELECT** — fetches existing row to capture old field values for change tracking
2. **UPSERT** — routes to category-specific table partition:

```sql
INSERT INTO properties_new (property_category, ...)
VALUES ($1, ...)
ON CONFLICT (source_url) DO UPDATE SET
  price = EXCLUDED.price,
  -- Terminal protection:
  status = CASE
    WHEN properties_new.status IN ('sold', 'rented') THEN properties_new.status
    ELSE EXCLUDED.status
  END,
  ...
```

3. **Change tracking** — compares pre/post values, inserts into `property_changes`
4. **Status history** — inserts into `listing_status_history` on status transitions
5. **Ingestion log** — writes raw payload to `ingestion_log` for every UPSERT

**Category partitioning** (migration 013):

| Category | Partition | Column prefix | Required fields |
|---|---|---|---|
| `apartment` | `properties_apartment` | `apt_*` | bedrooms, sqm, has_elevator/balcony/parking/basement |
| `house` | `properties_house` | `house_*` | bedrooms, sqm_living, sqm_plot, has_garden/garage/parking/basement |
| `land` | `properties_land` | `land_*` | area_plot_sqm |
| `commercial` | `properties_commercial` | `comm_*` | sqm_total, has_elevator/parking/bathrooms |

Partition pruning requires `property_category` in the WHERE clause:
```sql
-- ✅ Fast — hits only properties_apartment partition
SELECT * FROM properties_new
WHERE property_category = 'apartment' AND price < 5000000 AND status = 'active';

-- ❌ Slow — full scan across all partitions
SELECT * FROM properties_new WHERE price < 5000000;
```

---

### 5. Staleness & Listing Lifecycle

A scheduled worker (`staleness-check-<country>`, runs every 6h) marks listings as `removed` if `last_seen_at` is older than `STALENESS_THRESHOLD_HOURS` (default 72h):

```
active → removed (not seen in 72h)
removed → active (reappears in a scrape)
active|removed → sold|rented (terminal, never overwritten)
```

**Race condition protection:** The staleness UPDATE re-checks `last_seen_at` in the WHERE clause to avoid a race with concurrent ingest:
```sql
UPDATE properties_new SET status = 'removed'
WHERE status = 'active'
  AND last_seen_at < NOW() - INTERVAL '72 hours'
  AND last_seen_at = <captured_value>;  -- re-check prevents overwriting concurrent update
```

Status transitions are recorded in `listing_status_history` with `started_at`/`ended_at` timestamps.

---

### 6. Search Service

The search service (`search-service`, Fastify on `:4000`) queries PostgreSQL directly using category-partitioned views and PostGIS for geo queries.

Key query patterns:
- All search queries include `property_category` + `status = 'active'` for partition pruning
- Geo search uses PostGIS KNN (`<->` operator) against `coordinates` geography column
- Map clustering uses geohash/grid aggregation — no individual property rows at low zoom
- Aggregations run as single-pass CTEs (one DB round-trip)
- Filters map to category-prefixed columns: `bedrooms` → tries `apt_bedrooms`, `house_bedrooms`, `comm_bedrooms` with OR logic

---

### 7. Supporting Services

**Polygon Service** (`:4300`): Manages OSM administrative boundaries (levels 2/4/6/8/9/10) in PostGIS. Powers point-in-polygon lookups (which city/district is this property in?). Syncs monthly from Overpass API. Redis-cached with configurable TTL.

**ML Pricing Service** (`:3500`): LightGBM models trained per country per category on `ml_training_features_*` materialized views. Returns `predicted_price`, `confidence_interval`, and `deal_quality_score`. Models cached in Redis for 24h; predictions cached 1h. Retrained weekly (Sunday 2 AM).

**Frontend** (`landomo-frontend`): Next.js/React. Mobile-first with desktop views (`DesktopPropertyListView`, `DesktopDetailView`, etc.). Calls search service and ML pricing for deal quality badges.

---

## Docker Topology

Each country runs its own set of containers:

```
cz-postgres      → landomo_cz (PostgreSQL)
cz-ingest        → ingest API (port 3006 on VPS)
cz-worker        → same image, WORKER=true
scraper-sreality → :8102
scraper-bezrealitky → :8103
scraper-reality  → :8104
scraper-idnes-reality → :8105
scraper-realingo → :8106
scraper-ulovdomov → :8107
```

All containers share `cz-network` (Docker bridge). The scheduler container can reach all scraper containers by service name.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Per-country PostgreSQL databases | Horizontal isolation — one country's data volume/schema changes don't affect others |
| Category-partitioned tables | 40–60% storage reduction; partition pruning; category-specific indexes |
| Async ingest (BullMQ) | Scrapers don't block waiting for DB writes; backpressure handled via queue depth |
| Per-country BullMQ queues | Prevents cross-country job routing (historical bug with shared queue name) |
| Terminal status protection | `sold`/`rented` listings are ground truth — no scraper can accidentally reactivate them |
| Checksum-based dedup | 80–90% reduction in DB writes on stable periods; preserves DB write throughput |
| One container = one portal | Isolation of failures; independent scaling; clear ownership |
| 70% effort on transformers | Raw portal data is messy; normalization quality directly impacts search/ML accuracy |
