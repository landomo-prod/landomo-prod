# Workers

All workers run in a single process started via `node dist/start-worker.js` (entry point: `src/start-worker.ts`). This process starts 5 workers and a metrics HTTP server.

## Worker Process Architecture

```
start-worker.ts
  ├── Batch Ingestion Worker (BullMQ Worker)
  ├── Staleness Checker (BullMQ Worker + Scheduler)
  ├── Data Quality Checker (BullMQ Worker + Scheduler)
  ├── Alert Checker (BullMQ Worker + Scheduler)
  ├── Polygon Sync (BullMQ Worker + Scheduler)
  ├── Queue Metrics Collector (setInterval, 15s)
  └── Metrics HTTP Server (port WORKER_METRICS_PORT, default 3006)
```

Graceful shutdown on `SIGTERM`/`SIGINT` closes all workers, queues, and collectors.

---

## 1. Batch Ingestion Worker

**File:** `src/workers/batch-ingestion.ts`

**Queue:** `ingest-property-{INSTANCE_COUNTRY}` (e.g., `ingest-property-cz`)

**Concurrency:** `BATCH_WORKERS` (default: 5)

**Rate Limiter:** 500 jobs/second

### Job Types

#### `ingest-property-batch` (primary)

Processes a batch of properties from `/bulk-ingest`:

1. Groups properties by `property_category` (apartment, house, land, commercial, other)
2. Deduplicates within each category by `source_platform:portal_id`
3. Calls category-specific upsert functions in parallel
4. Records Prometheus metrics (inserted, updated, batch size, duration)
5. Publishes cache invalidation via Redis PUB/SUB on `property:updated:{country}`

**Job Data:**

```json
{
  "portal": "sreality",
  "country": "czech_republic",
  "properties": [...],
  "scrape_run_id": "uuid",
  "request_id": "req-123",
  "batch_size": 150
}
```

#### `ingest-property` (legacy single-property)

Backward-compatible handler for single property jobs from `/ingest`:

1. Determines category from `data.property_category`
2. Merges portal-level fields into property data
3. Routes to appropriate upsert function
4. Falls back to legacy `bulkInsertOrUpdateProperties()` if no category

### Retry Policy

- **Attempts:** 3
- **Backoff:** Exponential, 2 second base delay
- **Job Retention:**
  - Completed: 1,000 jobs or 24 hours
  - Failed: 500 jobs or 24 hours

### Country Code Mapping

The worker maps short country codes to full names for database routing:

| Code | Country |
|------|---------|
| `cz` | czech |
| `sk` | slovakia |
| `at` | austria |
| `de` | germany |
| `hu` | hungary |
| `pl` | poland |
| `ro` | romania |
| `uk` | united_kingdom |
| `au` | australia |

### Metrics Recorded

| Metric | Type | Labels |
|--------|------|--------|
| `landomo_ingest_batch_size` | Histogram | - |
| `landomo_ingest_batch_duration_seconds` | Histogram | - |
| `landomo_ingest_properties_ingested_total` | Counter | country, portal |
| `landomo_ingest_properties_updated_total` | Counter | country, portal |
| `landomo_properties_total` | Counter | country, category, portal |
| `landomo_properties_price_changed_total` | Counter | country, category, change_type |
| `landomo_scraper_last_run_timestamp` | Gauge | portal |
| `landomo_ingest_errors_total` | Counter | type |

---

## 2. Staleness Checker

**File:** `src/workers/staleness-checker.ts`

**Queue:** `staleness-check-{INSTANCE_COUNTRY}`

**Schedule:** `STALENESS_CRON` (default: `0 */6 * * *` - every 6 hours)

**Concurrency:** 1

### Process

1. **Reap orphaned runs** - Marks scrape runs stuck in `running` for >4 hours as `failed`
2. **Find stale portals** - Identifies portals with active listings not seen within the threshold
3. **Circuit breaker** - Skips portals without a completed scrape run within 2x the threshold window (prevents false removals from broken scrapers)
4. **Mark stale** - Updates stale properties to `removed` status in batches
5. **Status history** - Appends `removed` period to `status_history` JSONB

### Staleness Logic

A listing is considered stale when:
```
GREATEST(properties.last_seen_at, listing_checksums.last_seen_at)
  < NOW() - INTERVAL '{threshold_hours} hours'
```

The `listing_checksums.last_seen_at` join is critical for checksum-mode scrapers: unchanged listings skip ingestion (so `properties.last_seen_at` is never updated), but the checksum endpoint updates `listing_checksums.last_seen_at`.

### Circuit Breaker

Only processes portals that had a **completed** scrape run within `2 * threshold_hours`. If a scraper is broken, listings are NOT marked removed.

### Race Condition Protection

The UPDATE re-checks freshness in a transaction:

```sql
UPDATE properties p SET status = 'removed'
WHERE p.id = $1
  AND p.status = 'active'
  AND freshness.effective_last_seen < NOW() - INTERVAL '...'
```

If a concurrent ingestion updated `last_seen_at`, the row is skipped.

### Metrics

| Metric | Type |
|--------|------|
| `landomo_ingest_staleness_marked_removed_total` | Counter |
| `landomo_ingest_staleness_circuit_breaker_skips_total` | Counter |
| `landomo_ingest_staleness_check_duration_seconds` | Histogram |
| `landomo_ingest_orphaned_runs_reaped_total` | Counter |
| `landomo_properties_deactivated_total` | Counter |
| `landomo_properties_status_changed_total` | Counter |

---

## 3. Data Quality Checker

**File:** `src/workers/data-quality-checker.ts`

**Queue:** `data-quality-check-{INSTANCE_COUNTRY}`

**Schedule:** `DATA_QUALITY_CRON` (default: `0 */6 * * *` - every 6 hours)

**Concurrency:** 1

### Checks Performed (in parallel where possible)

1. **Portal Quality Metrics** - Per-portal quality scores based on:
   - Missing price % (weight: 30%)
   - Missing coordinates % (weight: 25%)
   - Missing images % (weight: 15%)
   - Suspicious price % (weight: 15%)
   - Updated in last 7 days % (weight: 15%)

2. **Duplicate Detection** - Counts properties linked via `canonical_property_id`

3. **Price Outlier Detection** - Identifies prices >3 standard deviations from mean per portal/category/transaction_type (requires >= 10 listings)

4. **Field Completion Rates** - Per-portal, per-category completion rates for tracked fields:
   - **Apartment:** price, city, lat/lon, images, description, apt_bedrooms, apt_sqm, apt_floor, apt_has_elevator/balcony/parking/basement, condition, heating_type, furnished, construction_type
   - **House:** price, city, lat/lon, images, description, house_bedrooms, house_sqm_living/plot, house_has_garden/garage/parking/basement, condition, heating_type, construction_type
   - **Land:** price, city, lat/lon, images, description, land_area_plot_sqm, land_zoning, land_water_supply/sewage/electricity
   - **Commercial:** price, city, lat/lon, images, description, comm_sqm_total, comm_has_elevator/parking, comm_property_subtype, comm_monthly_rent

5. **Scraper Alerts** - Generated from results:
   - `scraper_stale`: Portal hasn't completed a run in 24h+ (warning 24-72h, critical >72h)
   - `quality_drop`: Quality score below 70 (warning) or 50 (critical)
   - `high_outliers`: Price outlier % > 10

6. **Automated Data Cleansing:**
   - Trim whitespace from titles
   - Normalize currency to uppercase
   - Fix negative prices (set to absolute value)
   - Trim city names

### Storage

All results stored to database tables with a shared `snapshot_group_id` (UUID per run):
- `data_quality_snapshots`
- `data_quality_duplicates`
- `data_quality_price_outliers`
- `data_quality_field_completion`
- `data_quality_scraper_alerts`
- `data_quality_cleansing_log`

Old alerts of the same type/portal are auto-resolved before inserting new ones.

### Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `landomo_data_quality_score` | Gauge | country, portal |
| `landomo_properties_missing_price_pct` | Gauge | country, portal |
| `landomo_properties_missing_coordinates_pct` | Gauge | country, portal |
| `landomo_properties_missing_images_pct` | Gauge | country, portal |
| `landomo_properties_suspicious_price_pct` | Gauge | country, portal |
| `landomo_scraper_freshness_hours` | Gauge | country, portal |
| `landomo_properties_updated_last_7d_pct` | Gauge | country, portal |

---

## 4. Alert Checker

**File:** `src/workers/alert-checker.ts`

**Queue:** `alert-check-{INSTANCE_COUNTRY}`

**Schedule:** `ALERT_CHECK_CRON` (default: `*/5 * * * *` - every 5 minutes)

**Concurrency:** 1

### Alert Rules

| Rule | Severity | Trigger | Threshold |
|------|----------|---------|-----------|
| `queue_backlog` | critical | Waiting jobs > 1000 | 1000 |
| `failed_jobs_high` | warning | Failed jobs > 50 | 50 |
| `no_ingestion_1h` | warning | No properties ingested in last hour | 1 hour |
| `db_size_high` | warning | DB size > `ALERT_DB_MAX_GB` | 50 GB |
| `stale_portals` | critical | Portals with no data in 72h | 72 hours |
| `worker_queue_paused` | critical | Ingestion queue is paused | not paused |

### Prometheus Integration

Each alert sets a `landomo_alert_triggered` gauge (1 = triggered, 0 = OK) with labels `alert_name`, `severity`, `country`. This enables external alerting via Prometheus Alertmanager.

---

## 5. Polygon Sync

**File:** `src/workers/polygon-sync.ts`

**Queue:** `polygon-sync-{INSTANCE_COUNTRY}`

**Schedule:** `POLYGON_SYNC_CRON` (default: `0 2 1 * *` - 1st of month at 2 AM)

**Concurrency:** 1

### Process

1. Maps instance country to ISO 3166-1 alpha-2 code
2. Calls polygon-service API: `POST {POLYGON_SERVICE_URL}/api/v1/sync/overpass`
3. Requests admin levels 2, 4, 6, 8, 9, 10 (country through neighborhood)
4. Skips areas updated in last 30 days (`skipRecent: true`)
5. Uses `POLYGON_SERVICE_TIMEOUT` (default 5 minutes) for request timeout

Skipped if `POLYGON_SERVICE_API_KEY` is not set.

---

## Queue Naming Convention

All queues are per-country to prevent cross-country job routing when multiple workers share a Redis instance:

| Queue Pattern | Example |
|--------------|---------|
| `ingest-property-{country}` | `ingest-property-cz` |
| `staleness-check-{country}` | `staleness-check-cz` |
| `data-quality-check-{country}` | `data-quality-check-cz` |
| `alert-check-{country}` | `alert-check-cz` |
| `polygon-sync-{country}` | `polygon-sync-cz` |

## BullMQ v5 API

Scheduled jobs use the v5 `upsertJobScheduler` API:

```typescript
queue.upsertJobScheduler(
  'scheduler-name',
  { pattern: '0 */6 * * *' },
  { name: 'job-name', data: { country: 'cz' } }
);
```

This replaces the older `add(..., { repeat: ... })` pattern.
