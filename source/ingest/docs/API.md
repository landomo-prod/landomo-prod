# API Reference

Base URL: `http://localhost:3000`

All authenticated endpoints require `Authorization: Bearer <api_key>` header.

## Authentication

All endpoints except `/api/v1/health`, `/metrics`, and `/api/versions` require a Bearer token.

```bash
curl -H "Authorization: Bearer dev_key_1" http://localhost:3000/api/v1/...
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 401 | `Missing or invalid Authorization header` | No Bearer token |
| 401 | `Invalid API key` | Key not in API_KEYS |
| 401 | `API key has expired` | Key past expiry date |

---

## POST /api/v1/properties/bulk-ingest

Bulk ingest multiple properties. The primary endpoint used by scrapers.

**Request Body:**

```json
{
  "portal": "sreality",
  "country": "czech_republic",
  "properties": [
    {
      "portal_id": "12345",
      "data": {
        "property_category": "apartment",
        "title": "2+kk, 55m2, Praha 3",
        "price": 5500000,
        "currency": "CZK",
        "transaction_type": "sale",
        "source_url": "https://sreality.cz/...",
        "source_platform": "sreality",
        "location": {
          "city": "Praha",
          "region": "Praha",
          "country": "Czech Republic",
          "postal_code": "13000",
          "coordinates": { "lat": 50.0755, "lon": 14.4378 }
        },
        "bedrooms": 1,
        "sqm": 55,
        "has_elevator": true,
        "has_balcony": false,
        "has_parking": true,
        "has_basement": false,
        "status": "active"
      }
    }
  ],
  "scrape_run_id": "uuid (optional)"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `portal` | string | Yes | Alphanumeric + `._-`, max 100 chars. Pattern: `/^[a-zA-Z0-9._-]+$/` |
| `country` | string | Yes | Lowercase + underscores, max 50 chars. Pattern: `/^[a-z_]+$/` |
| `properties` | array | Yes | Non-empty array of property objects |
| `scrape_run_id` | string | No | UUID of the associated scrape run |

Each property in the array must contain `portal_id` and `data` with `property_category` set to one of: `apartment`, `house`, `land`, `commercial`, `other`.

**Response (202 Accepted):**

```json
{
  "status": "accepted",
  "message": "150 properties queued for batch ingestion",
  "job_id": "batch-sreality-1708700000000-req-1"
}
```

**Job Processing:**
- Jobs are created with `jobId: batch-{portal}-{timestamp}-{requestId}`
- 3 retry attempts with exponential backoff (2s base)
- Completed jobs kept for 1 hour (max 100)
- Failed jobs kept for 24 hours (max 500)

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Missing required fields` | Missing portal, country, or properties |
| 400 | `portal must be an alphanumeric string` | Invalid portal format |
| 400 | `country must be a lowercase string` | Invalid country format |
| 400 | `Properties array cannot be empty` | Empty properties array |
| 500 | `Failed to queue properties for ingestion` | Redis/queue failure |

---

## POST /api/v1/properties/ingest

Ingest a single property. Legacy endpoint; prefer `/bulk-ingest` for better performance.

**Request Body:**

```json
{
  "portal": "sreality",
  "portal_id": "12345",
  "country": "czech_republic",
  "data": {
    "property_category": "apartment",
    "title": "2+kk, 55m2",
    "price": 5500000,
    "currency": "CZK",
    "transaction_type": "sale",
    "source_url": "https://...",
    "location": { "city": "Praha", "country": "Czech Republic" },
    "details": { "bedrooms": 1, "sqm": 55 },
    "amenities": { "has_parking": true }
  },
  "raw_data": {}
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `portal` | string | Yes | Same as bulk-ingest |
| `portal_id` | string | Yes | Max 500 chars |
| `country` | string | Yes | Same as bulk-ingest |
| `data` | object | Yes | Property data object |
| `raw_data` | object | No | Original portal response |

**Response (202 Accepted):**

```json
{
  "status": "accepted",
  "message": "Property queued for ingestion"
}
```

---

## POST /api/v1/scrape-runs/start

Start a new scrape run session. Called by scrapers at the beginning of a scrape.

**Request Body:**

```json
{
  "portal": "sreality"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `portal` | string | Yes | Non-empty string |

**Response (201 Created):**

```json
{
  "status": "created",
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (409 Conflict):**

```json
{
  "error": "Conflict",
  "message": "A scrape run for this portal is already in progress"
}
```

The overlap guard prevents concurrent runs for the same portal.

---

## POST /api/v1/scrape-runs/:id/complete

Mark a scrape run as completed with statistics.

**URL Parameters:**

| Param | Type | Validation |
|-------|------|------------|
| `id` | string | Valid UUID |

**Request Body:**

```json
{
  "listings_found": 15000,
  "listings_new": 500,
  "listings_updated": 14500
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `listings_found` | number | Yes | Non-negative integer |
| `listings_new` | number | No | Defaults to 0 |
| `listings_updated` | number | No | Defaults to 0 |

**Response (200 OK):**

```json
{
  "status": "completed",
  "run_id": "a1b2c3d4-..."
}
```

---

## POST /api/v1/scrape-runs/:id/fail

Mark a scrape run as failed.

**URL Parameters:**

| Param | Type | Validation |
|-------|------|------------|
| `id` | string | Valid UUID |

**Response (200 OK):**

```json
{
  "status": "failed",
  "run_id": "a1b2c3d4-..."
}
```

---

## POST /api/v1/checksums/compare

Compare listing checksums against the database to determine which properties need full fetching. Used by scrapers to implement checksum-based optimization.

**Request Body:**

```json
{
  "checksums": [
    { "portal": "sreality", "portalId": "12345", "contentHash": "abc123..." },
    { "portal": "sreality", "portalId": "12346", "contentHash": "def456..." }
  ],
  "scrapeRunId": "uuid (optional)"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `checksums` | array | Yes | Non-empty array |
| `checksums[].portal` | string | Yes | Portal name |
| `checksums[].portalId` | string | Yes | Portal listing ID |
| `checksums[].contentHash` | string | Yes | Content hash/checksum |
| `scrapeRunId` | string | No | Associated scrape run UUID |

Processes in batches of 10,000 to avoid PostgreSQL parameter limits.

**Response (200 OK):**

```json
{
  "scrapeRunId": "uuid or null",
  "total": 100,
  "new": 10,
  "changed": 15,
  "unchanged": 75,
  "results": [
    { "portalId": "12345", "status": "new", "oldHash": null, "newHash": "abc123..." },
    { "portalId": "12346", "status": "changed", "oldHash": "old...", "newHash": "def456..." },
    { "portalId": "12347", "status": "unchanged", "oldHash": "same...", "newHash": "same..." }
  ]
}
```

---

## POST /api/v1/checksums/update

Update checksums after successful property ingestion. Marks listings as "seen" in the current scrape.

**Request Body:**

```json
{
  "checksums": [
    { "portal": "sreality", "portalId": "12345", "contentHash": "abc123..." }
  ],
  "scrapeRunId": "uuid (optional)"
}
```

Deduplicates by `portalId` (keeps last occurrence). Processes in batches of 1,000. Uses UPSERT on `(portal, portal_id)`.

**Response (200 OK):**

```json
{
  "success": true,
  "updated": 150
}
```

---

## GET /api/v1/checksums/stats

Get checksum statistics for a portal.

**Query Parameters:**

| Param | Type | Required |
|-------|------|----------|
| `portal` | string | Yes |

**Response (200 OK):**

```json
{
  "totalProperties": 15000,
  "lastScrapedAt": "2026-02-23T10:00:00.000Z",
  "averageChangeRate": null
}
```

---

## GET /api/v1/health

Health check endpoint. No authentication required.

**Response (200 OK):**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T12:00:00.000Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "pgbouncer": {
    "healthy": true,
    "host": "pgbouncer",
    "port": 6432,
    "latencyMs": 2
  }
}
```

The `pgbouncer` field only appears when `PGBOUNCER_ENABLED=true`.

---

## GET /metrics

Prometheus-format metrics. No authentication required.

Returns all registered Prometheus metrics including:
- Default Node.js metrics (prefixed `landomo_ingest_`)
- HTTP request counters and histograms
- Ingestion counters (inserted, updated, skipped)
- Queue depth gauges
- Staleness metrics
- Data quality scores
- Business KPI metrics

---

## GET /api/v1/monitoring/dashboard

Real-time monitoring dashboard data.

**Response (200 OK):**

```json
{
  "timestamp": "2026-02-23T12:00:00.000Z",
  "country": "cz",
  "uptime_seconds": 86400,
  "ingestion": {
    "total_active_listings": 150000,
    "ingested_last_1h": 500,
    "ingested_last_24h": 25000,
    "per_portal": [
      {
        "portal": "sreality",
        "total_active": 70000,
        "ingested_last_1h": 200,
        "ingested_last_24h": 12000,
        "last_ingestion_at": "2026-02-23T11:55:00.000Z",
        "freshness_hours": 0.08
      }
    ]
  },
  "queue": {
    "waiting": 5,
    "active": 2,
    "completed_24h": 5000,
    "failed_24h": 3,
    "delayed": 0,
    "paused": false
  },
  "database": {
    "total_properties": 200000,
    "by_category": {
      "apartment": 100000,
      "house": 50000,
      "land": 30000,
      "commercial": 20000
    },
    "by_status": {
      "active": 150000,
      "removed": 40000,
      "sold": 8000,
      "rented": 2000
    },
    "db_size_mb": 2048.5
  },
  "alerts": [
    {
      "name": "queue_backlog",
      "severity": "warning",
      "triggered": false,
      "message": "Queue has 5 waiting jobs",
      "value": 5,
      "threshold": 1000
    }
  ]
}
```

**Alert Rules (inline):**

| Alert | Severity | Trigger |
|-------|----------|---------|
| `queue_backlog` | warning/critical | >1000 waiting (critical >5000) |
| `failed_jobs` | warning/critical | >10 failed (critical >100) |
| `scraper_stale_{portal}` | warning/critical | No data in 24h (critical >72h) |

---

## GET /api/v1/data-quality

Latest data quality snapshots per portal.

**Response (200 OK):**

```json
{
  "country": "cz",
  "overall_score": 85.5,
  "portals": [
    {
      "portal": "sreality",
      "total_properties": 70000,
      "active_properties": 65000,
      "missing_price_pct": 0.5,
      "missing_coordinates_pct": 2.1,
      "missing_images_pct": 5.0,
      "suspicious_price_pct": 0.3,
      "updated_last_7d_pct": 90.0,
      "oldest_listing_days": 365,
      "quality_score": 92.5
    }
  ]
}
```

---

## GET /api/v1/data-quality/alerts

Active (unresolved) data quality alerts.

**Response (200 OK):**

```json
{
  "country": "cz",
  "total": 2,
  "alerts": [
    {
      "portal": "bazos",
      "alert_type": "quality_drop",
      "severity": "warning",
      "message": "Quality score for bazos is below threshold: 65",
      "metadata": { "quality_score": 65, "active_properties": 5000 },
      "created_at": "2026-02-23T06:00:00.000Z"
    }
  ]
}
```

---

## GET /api/v1/data-quality/field-completion

Field completion rates by portal and category.

**Response (200 OK):**

```json
{
  "country": "cz",
  "portals": {
    "sreality": {
      "apartment": [
        { "field_name": "price", "completion_pct": 100.0 },
        { "field_name": "apt_bedrooms", "completion_pct": 95.2 }
      ]
    }
  }
}
```

---

## GET /api/v1/data-quality/price-outliers

Price outlier summary (>3 stddev from mean).

**Response (200 OK):**

```json
{
  "country": "cz",
  "total_segments": 8,
  "outliers": [
    {
      "portal": "sreality",
      "property_category": "apartment",
      "transaction_type": "sale",
      "mean_price": 5000000,
      "stddev_price": 2000000,
      "outlier_count": 150,
      "outlier_pct": 1.5
    }
  ]
}
```

---

## GET /api/v1/auth/verify

Verify API key validity and see metadata.

**Response (200 OK):**

```json
{
  "valid": true,
  "version": "v1",
  "country": "cz",
  "expiresAt": "2026-12-31T00:00:00.000Z",
  "expiresInDays": 311
}
```

---

## GET /api/versions

API version discovery. No authentication required.

Returns supported API versions and their status.

---

## GET /api/v1/usage/summary

API usage analytics summary.

**Query Parameters:**

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `hours` | number | 24 | 720 |

**Response (200 OK):**

```json
{
  "country": "cz",
  "window": { "hours": 24, "from": "2026-02-22T12:00:00.000Z" },
  "summary": {
    "totalRequests": 50000,
    "avgResponseMs": 15,
    "p95ResponseMs": 45,
    "errorCount": 50,
    "rateLimitedCount": 2,
    "errorRate": "0.10%"
  },
  "byEndpoint": [...],
  "byStatusCode": [...],
  "byApiKey": [...],
  "topClientIps": [...]
}
```

---

## GET /api/v1/usage/hourly

Hourly request counts for charting.

**Query Parameters:**

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `hours` | number | 24 | 168 |

---

## Rate Limiting

Redis-based sliding window rate limiter. Returns standard headers on every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Window reset time (epoch seconds) |

**Per-endpoint limits (per API key, per minute):**

| Endpoint | Limit |
|----------|-------|
| `POST /api/v1/properties/bulk-ingest` | 1,000 req/min |
| `POST /api/v1/checksums/compare` | 600 req/min |
| `POST /api/v1/checksums/update` | 600 req/min |
| `POST /api/v1/properties/ingest` | 100 req/min |
| All other endpoints | 200 req/min |

**429 Response:**

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit of 1000 requests per 60s exceeded",
  "retryAfter": 60
}
```

Rate limiting fails open if Redis is unavailable.

---

## Common Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Request correlation ID (from client or auto-generated) |
| `X-API-Key-Version` | Version of the authenticated API key |
| `X-API-Version` | Current API version |
