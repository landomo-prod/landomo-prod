# Landomo-World Architecture

System architecture, design decisions, and data flow.

## Overview

Landomo-World is a distributed, multi-tenant real estate aggregation platform designed for:
- **Scale**: 600+ scrapers, millions of properties
- **Multi-tenancy**: Per-country databases and services
- **Reliability**: Graceful degradation, circuit breakers
- **Performance**: Partition pruning, strategic indexing

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Landomo-World                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Scraper    │      │   Scraper    │      │   Scraper    │
│  (Sreality)  │      │ (UlovDomov)  │      │  (Bezrealitky)│
│   :8084      │      │   :8085      │      │   :8086      │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │  POST /bulk-ingest  │                     │
       └─────────────────────┴─────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   Ingest Service API     │
              │       :3004-3009         │
              │  (Per-country instance)  │
              └────────────┬─────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │  Redis  │      │BullMQ   │      │  Metrics│
    │  Queue  │      │ Jobs    │      │ (Prom)  │
    │  :6379  │      │         │      │  :9090  │
    └─────────┘      └────┬────┘      └─────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  Worker Process      │
              │  (batch-ingestion)   │
              └──────────┬───────────┘
                         │
                         ▼
          ┌──────────────────────────┐
          │   PostgreSQL (Country)   │
          │   - landomo_czech        │
          │   - landomo_slovakia     │
          │   - landomo_austria      │
          │         :5432            │
          └──────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐
   │Properties │  │ Tracking  │  │   Audit   │
   │ (4 parts) │  │  Tables   │  │   Logs    │
   └───────────┘  └───────────┘  └───────────┘
```

### Data Flow

1. **Scraper** discovers listings → transforms to TierI type
2. **Ingest API** receives bulk properties → validates → queues
3. **Worker** processes queue → UPSERTs to PostgreSQL
4. **Tracking** records changes, status transitions, staleness
5. **Search/Polygon** services query normalized data

## Services

### Ingest Service (Fastify)

**Purpose**: Receive property data from scrapers and queue for processing

**Ports**: 3004+ (per-country: 3004=Czech, 3005=Slovakia, etc.)

**Key Responsibilities**:
- Validate incoming property data
- Queue jobs to BullMQ
- Track scrape runs (start/complete/fail)
- Provide health/metrics endpoints

**API Endpoints**:
- `POST /bulk-ingest` - Bulk property ingestion
- `POST /scrape-runs/start` - Start scrape run tracking
- `POST /scrape-runs/complete` - Complete scrape run
- `POST /scrape-runs/fail` - Mark scrape run as failed
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

**Configuration**:
- Per-country database connection
- Redis connection for BullMQ
- API key authentication
- Batch size and concurrency limits

### Worker Process (BullMQ)

**Purpose**: Process queued properties and write to database

**Key Responsibilities**:
- Consume jobs from BullMQ queue
- Perform category-specific UPSERT operations
- Track property changes (price, status, etc.)
- Record ingestion audit logs
- Handle staleness checking

**Job Types**:
- `property-ingest` - Insert/update properties
- `staleness-check` - Mark stale properties as removed
- `data-quality-check` - Validate data integrity

**Batch Processing**:
- Processes properties in batches of 100
- Parallel workers (configurable, default: 4)
- Automatic retry on transient failures
- Circuit breaker on persistent failures

### Search Service (Port 4000)

**Purpose**: Provide property search and retrieval API

**Key Features**:
- Full-text search across properties
- Geographic/polygon search
- Filter by category, price, size, features
- Pagination and sorting
- Cross-country federation

### Polygon Service (Port 4300)

**Purpose**: Manage administrative boundaries and geographic queries

**Key Features**:
- OSM boundary import and sync
- Point-in-polygon queries
- Boundary search (autocomplete)
- PostGIS integration
- Monthly sync jobs

### ML Pricing Service (Port 3500)

**Purpose**: Price prediction and deal quality analysis

**Key Features**:
- Category-specific ML models
- Weekly model retraining
- Price predictions with confidence scores
- Deal quality scoring
- Redis caching for predictions

## Database Architecture

### Per-Country Databases

Each country has its own PostgreSQL database:
```
landomo_czech_republic
landomo_slovakia
landomo_austria
landomo_hungary
landomo_germany
landomo_poland
landomo_uk
landomo_australia
```

**Why per-country?**
- **Data sovereignty**: Some countries require data to stay in-country
- **Scaling**: Easier to shard and distribute
- **Isolation**: Country A issues don't affect country B
- **Backup/restore**: Granular control

### Category Partitioning

Properties are partitioned by category for performance:

```sql
properties_apartment   -- Apartments/flats
properties_house       -- Houses/villas
properties_land        -- Land plots
properties_commercial  -- Commercial spaces
properties_other       -- Other property types
```

**Benefits**:
- **Partition pruning**: Queries only scan relevant partition
- **Smaller indexes**: 1/4 the size = faster lookups
- **Storage efficiency**: 40-60% reduction via column removal
- **Parallel operations**: Vacuum, analyze, backup per-partition

### Indexes Strategy

Each partition has **42 strategic indexes**:

#### Core Indexes
- `PRIMARY KEY (id)` - B-tree
- `UNIQUE (source_portal_id, source_platform, country)` - B-tree
- `(country, status)` - B-tree (most queries filter by active)
- `(price_czk)` WHERE status = 'active' - Partial index
- `(created_at)` - B-tree
- `(last_seen_at)` - B-tree for staleness

#### Geographic Indexes
- `(location)` - GIST for point queries
- `(polygon_ids)` - GIN for boundary lookups

#### Category-Specific Indexes
- **Apartment**: `(bedrooms, sqm)`, `(has_elevator)`
- **House**: `(bedrooms, sqm_living, sqm_plot)`, `(has_garden)`
- **Land**: `(area_plot_sqm)`, `(zoning_type)`
- **Commercial**: `(sqm_total, monthly_rent)`

#### Composite Indexes
- `(country, property_category, status, price_czk)` - Common filter combo
- `(country, status, created_at DESC)` - Recent active listings

## Data Model

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────┐
│ Tier I: Category-Specific Fields (Columns)     │
│ - Fast: Indexed, typed, validated              │
│ - Examples: bedrooms, sqm, has_elevator        │
└─────────────────────────────────────────────────┘
                     │
┌─────────────────────────────────────────────────┐
│ Tier II: Country-Specific Data (JSONB)         │
│ - Flexible: czech_disposition, ownership       │
│ - Examples: "2+kk", "Osobní", "Cihla"          │
└─────────────────────────────────────────────────┘
                     │
┌─────────────────────────────────────────────────┐
│ Tier III: Portal Metadata (JSONB)              │
│ - Transient: portal IDs, internal fields       │
│ - Examples: sreality_hash_id, listing_type     │
└─────────────────────────────────────────────────┘
```

### Listing Lifecycle

```
┌────────┐
│  New   │ first_seen_at = now()
└───┬────┘
    │
    ▼
┌────────┐
│ Active │ status = 'active', last_seen_at updated on each scrape
└───┬────┘
    │
    ├─→ Not seen for 72h
    │
    ▼
┌────────┐
│Removed │ status = 'removed', removed_at = now()
└───┬────┘
    │
    ├─→ Seen again (reactivate)
    │   └─→ Back to Active
    │
    └─→ Confirmed terminal
        ▼
    ┌────────┐
    │ Sold/  │ status = 'sold'/'rented' (terminal, never overwritten)
    │ Rented │
    └────────┘
```

### Change Tracking

Every property UPSERT captures:
1. **property_changes**: Field-level changes with old/new values
2. **listing_status_history**: Status periods with timestamps
3. **ingestion_log**: Raw payload for every scrape

## Queue Architecture (BullMQ)

### Queue Design

**Per-Country Queues**:
```
ingest-property-czech
ingest-property-slovakia
staleness-check-czech
staleness-check-slovakia
data-quality-check-czech
```

**Why per-country queues?**
- Isolated failure domains
- Country-specific rate limiting
- Independent scaling

### Job Flow

```
Scraper → Ingest API → Queue Job → Worker → Database
   │                       │           │
   │                       ├─ Retry    ├─ Success → Log
   │                       │   (3x)    │
   │                       └─ DLQ      └─ Failure → Alert
```

### Scheduled Jobs

- **Staleness Check**: Every 6 hours (cron: `0 */6 * * *`)
- **Data Quality**: Daily at 3 AM (cron: `0 3 * * *`)
- **ML Retraining**: Weekly Sunday 2 AM (cron: `0 2 * * 0`)

## Scraper Architecture

### Scraper Patterns

```typescript
// Standard scraper structure
scrapers/{Country}/{portal}/
├── src/
│   ├── index.ts                    # Express server (port 8084+)
│   ├── scrapers/
│   │   └── listingsScraper.ts      # Discovery & extraction
│   ├── transformers/
│   │   ├── apartmentTransformer.ts # TierI transformation
│   │   ├── houseTransformer.ts
│   │   └── ...
│   ├── adapters/
│   │   └── ingestAdapter.ts        # POST to ingest API
│   └── types/
│       └── portalTypes.ts          # Portal-specific types
├── docs/                           # Scraper documentation
│   ├── README.md
│   ├── PORTAL_DATA_FORMAT.md
│   ├── EXTRACTION_LOGIC.md
│   ├── TRANSFORMATION_LOGIC.md
│   └── FIELD_MAPPING.md
└── package.json
```

### Transformation Pipeline

```
Portal Data → Category Detection → Category Transformer → TierI Type → Validation
```

**Example**:
```typescript
// Raw from portal
const raw = {
  id: "123",
  type: "byt 2+kk",
  price: 5000000,
  size: "65 m²"
};

// Transformed to TierI
const property: ApartmentPropertyTierI = {
  property_category: 'apartment',
  bedrooms: 1,  // Parsed from "2+kk"
  sqm: 65,
  price_czk: 5000000,
  has_elevator: false,
  has_balcony: true,
  has_parking: false,
  has_basement: true,
  source_url: "...",
  source_platform: "sreality",
  status: 'active'
};
```

## Safety Mechanisms

### Circuit Breaker

If >30% of scraped listings are stale, skip portal to prevent mass removals:

```typescript
if (stalePercentage > 30) {
  console.warn('Circuit breaker: too many stale listings');
  return; // Skip this portal
}
```

### Overlap Guard

Prevent concurrent scrape runs for same portal:

```typescript
// Returns 409 Conflict if scrape already running
POST /scrape-runs/start
```

### Terminal Protection

Sold/rented status is never overwritten:

```sql
status = CASE
  WHEN properties.status IN ('sold', 'rented') THEN properties.status
  ELSE EXCLUDED.status
END
```

### Orphan Reaper

Failed scrape runs >4h are marked as failed:

```sql
UPDATE scrape_runs SET status = 'failed'
WHERE status = 'running' AND started_at < NOW() - INTERVAL '4 hours';
```

## Performance Optimization

### Query Optimization

**Always include**:
```sql
-- Enables partition pruning + partial index
WHERE property_category = 'apartment' AND status = 'active'
```

**Avoid**:
```sql
-- Scans all partitions
WHERE price < 1000000
```

### Batch Operations

- Insert/update in batches of 100
- Use `COPY` for bulk imports
- Parallel workers for concurrent processing

### Caching Strategy

- **Redis**: ML predictions (1h TTL), models (24h TTL)
- **PostgreSQL**: Materialized views for ML training data
- **Application**: In-memory portal state cache

## Monitoring & Observability

### Metrics (Prometheus)

- `scrape_run_active` - Gauge of active scrapes
- `scrape_duration_seconds` - Histogram of scrape times
- `properties_scraped_total` - Counter by portal/category/result
- `scrape_runs_total` - Counter by portal/status

### Logging (Structured JSON)

```json
{
  "level": "info",
  "service": "ingest-czech",
  "msg": "Property upserted",
  "portal": "sreality",
  "category": "apartment",
  "portalId": "123",
  "inserted": true,
  "duration_ms": 45
}
```

### Health Checks

- `/health` - Basic service health
- `/health/ready` - Ready to accept traffic (DB connected)
- `/health/live` - Process is alive

## Scaling Strategies

### Horizontal Scaling

- **Ingest API**: Stateless, scale behind load balancer
- **Workers**: Scale by increasing `WORKER_CONCURRENCY`
- **Scrapers**: Independent Docker containers

### Vertical Scaling

- **Database**: Read replicas for search queries
- **Redis**: Cluster mode for high throughput
- **Workers**: More CPU cores = more parallel processing

### Geographic Distribution

- **Database**: Per-country databases on regional servers
- **CDN**: Static assets and images
- **Edge**: Search API on edge locations

## Design Decisions

### Why Category Partitioning?

**Pros**:
- 4x faster queries via partition pruning
- Smaller indexes (1/4 size)
- Type safety at database level
- Storage efficiency

**Cons**:
- Schema changes need 4x updates
- Cross-category queries are harder
- More complex migrations

**Decision**: Pros outweigh cons for our query patterns

### Why Per-Country Databases?

**Pros**:
- Data sovereignty compliance
- Isolated failure domains
- Easier scaling
- Simpler backup/restore

**Cons**:
- More databases to manage
- Cross-country queries harder
- Duplicate schema management

**Decision**: Required for legal/scaling reasons

### Why BullMQ vs Direct DB Writes?

**Pros**:
- Asynchronous processing
- Automatic retries
- Job scheduling
- Graceful degradation

**Cons**:
- Additional infrastructure (Redis)
- Eventual consistency
- More moving parts

**Decision**: Required for reliability at scale

## Future Architecture

### Planned Improvements

1. **GraphQL Federation**: Unified API across countries
2. **Event Sourcing**: Full property history replay
3. **CQRS**: Separate write/read models
4. **Elasticsearch**: Full-text search offloading
5. **Kafka**: Event streaming for real-time updates

### Scaling Roadmap

- **Phase 1** (current): Single-region, per-country DBs
- **Phase 2** (2026 Q2): Multi-region read replicas
- **Phase 3** (2026 Q4): Global edge deployment
- **Phase 4** (2027): Event-driven microservices

## References

- [DATA_MODEL.md](DATA_MODEL.md) - Detailed schema
- [API_REFERENCE.md](API_REFERENCE.md) - API endpoints
- [PERFORMANCE.md](advanced/PERFORMANCE.md) - Optimization guide
- [SCALING.md](advanced/SCALING.md) - Scaling strategies
