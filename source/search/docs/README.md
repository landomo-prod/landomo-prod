# Search Service

Federated property search across all Landomo country databases. Queries multiple PostgreSQL instances in parallel, merges results with global sorting and pagination, and serves them through a REST API with Redis caching.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Fastify |
| Database | PostgreSQL (per-country, read-only) + PostGIS |
| Cache | Redis (caching, pub/sub invalidation, rate limiting) |
| Metrics | Prometheus (`prom-client`) |
| Observability | Sentry, structured logging (pino) |
| GraphQL | `mercurius` (optional endpoint at `/graphql`) |

## Architecture

```
                          ┌─────────────────────────┐
                          │     Fastify Server       │
                          │  (port 4000, 0.0.0.0)   │
                          └────────┬────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
     ┌────────▼────────┐  ┌───────▼───────┐  ┌─────────▼────────┐
     │   REST Routes    │  │  GraphQL API  │  │  Middleware       │
     │  /api/v1/*       │  │  /graphql     │  │  Rate Limiter    │
     │                  │  │               │  │  Request ID      │
     │  search          │  │  radius       │  │  Search Validator│
     │  geo-search      │  │  detail       │  │  API Versioning  │
     │  property        │  │  stats        │  │  CORS            │
     │  aggregations    │  │  clusters     │  └──────────────────┘
     │  filters         │  └───────────────┘
     │  map/tiles       │
     │  map/clusters    │
     │  boundaries      │
     │  price-trends    │
     │  cache mgmt      │
     │  health          │
     │  metrics         │
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  Search Engine    │  Single-flight coalescing + Redis cache
     │  (core)           │  Deduplicates concurrent identical requests
     └────────┬─────────┘
              │
     ┌────────▼─────────┐
     │  Country Modules  │  Per-country query enhancement,
     │  (11 countries)   │  result transformation, validation
     └────────┬─────────┘
              │
     ┌────────▼─────────┐       ┌──────────────┐
     │  Multi-DB Manager │──────►│  PostgreSQL   │
     │  (parallel query) │       │  per-country  │
     └──────────────────┘       │  (read-only)  │
                                └──────────────┘
              │
     ┌────────▼─────────┐       ┌──────────────┐
     │  Redis Manager    │──────►│  Redis        │
     │  (cache + pubsub) │       │  (shared)     │
     └──────────────────┘       └──────────────┘
```

## Country Modules

Each country extends `CountryModule` and provides:

- **Config**: database name, currency, timezone
- **Fields**: country-specific field definitions (indexed, filterable, sortable)
- **Filters**: country-specific filter definitions with SQL templates and validation
- **enhanceQuery()**: adds country-specific WHERE clauses to the base query
- **transformResult()**: formats DB rows for API response (price formatting, field descriptions)
- **validateFilters()**: validates country-specific filter values

| Country | Code | Database | Currency | Specific Fields |
|---------|------|----------|----------|----------------|
| Czech Republic | `czech` | `landomo_cz` | CZK | disposition, ownership, building_type, condition |
| United Kingdom | `uk` | `landomo_uk` | GBP | tenure, council_tax_band, epc_rating, leasehold_years |
| Australia | `australia` | `landomo_australia` | AUD | land_size_sqm |
| USA | `usa` | `landomo_usa` | USD | mls_number, hoa_fees |
| France | `france` | `landomo_france` | EUR | - |
| Spain | `spain` | `landomo_spain` | EUR | - |
| Italy | `italy` | `landomo_italy` | EUR | - |
| Germany | `germany` | `landomo_germany` | EUR | - |
| Austria | `austria` | `landomo_austria` | EUR | - |
| Slovakia | `slovakia` | `landomo_slovakia` | EUR | - |
| Hungary | `hungary` | `landomo_hungary` | HUF | - |

## Startup Sequence

1. Validate configuration
2. Initialize PostgreSQL connection pools (one per country)
3. Initialize Redis (cache client)
4. Initialize Redis pub/sub subscriber (cache invalidation, debounced 5 min)
5. Initialize rate limiter Redis client (fail-open)
6. Register middleware hooks (request ID, metrics, API versioning, rate limiter, search validator)
7. Register all route plugins
8. Register GraphQL endpoint
9. Configure CORS
10. Start listening on `PORT` (default 4000)
11. Pre-warm filter options in background (non-blocking)

## Graceful Shutdown

On `SIGINT`/`SIGTERM`:
1. Close Fastify HTTP server
2. Close all PostgreSQL connection pools
3. Close Redis connections

## Key Design Decisions

- **Read-only access**: connects to country databases with a dedicated `search_readonly` user
- **Federated search**: queries all requested countries in parallel, merges results in-memory
- **Single-flight coalescing**: deduplicates concurrent identical requests (search, geo, filters, tiles)
- **Capped COUNT**: uses `SELECT COUNT(*) FROM (SELECT 1 ... LIMIT 10000)` instead of full table scans
- **Count caching**: page 2+ requests reuse cached count from page 1
- **Category-prefixed columns**: bedroom/sqm/amenity filters use OR across `apt_*`, `house_*`, `comm_*` columns
- **Duplicate exclusion**: all queries filter `(canonical_property_id IS NULL OR id = canonical_property_id)`
- **Cache invalidation**: Redis pub/sub on `property:updated:<country>` with 5-minute debounce

## Running Locally

```bash
# Start dependencies
docker compose -f docker/docker-compose.yml --env-file .env.dev up -d postgres redis

# Install and build
cd search-service
npm install
npm run build

# Start service
npm start
# or development mode
npm run dev
```

Default port: **4000**

## Related Documentation

- [API Reference](./API.md)
- [Query Builder](./QUERY_BUILDER.md)
- [Database](./DATABASE.md)
- [Configuration](./CONFIGURATION.md)
