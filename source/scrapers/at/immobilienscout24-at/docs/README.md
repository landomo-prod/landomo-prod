# ImmobilienScout24.at Scraper

## Overview
- **Portal**: ImmobilienScout24 Austria
- **URL**: https://www.immobilienscout24.at/
- **Country**: Austria
- **Categories**: Apartments (sale/rent), Houses (sale/rent), Land (sale), Commercial (sale)
- **Data Source**: REST API
- **Anti-bot**: None (REST API with standard headers)
- **Architecture**: Three-phase checksum-optimized with BullMQ worker queue

## Quick Stats
- **Active Listings**: ~40,000-50,000 (estimated)
- **Scrape Frequency**: Configurable (6-24 hour typical)
- **Technology**: TypeScript/Express, Axios HTTP client, BullMQ workers
- **Scope**: 6 search categories (apartment sale/rent, house sale/rent, land sale, commercial sale)

## Data Flow

```
ImmobilienScout24 API
    ↓
Phase 1: Fetch All Listings (Discovery)
    ↓ fetchSearchListings() per category
Search Results → Extract ID + basic fields
    ↓
Phase 2: Checksum Comparison (Change Detection)
    ↓ compareChecksums() via ingest service
Categorize: new | changed | unchanged
    ↓
Phase 3: Queue Detail Fetches
    ↓ addDetailJobs()
BullMQ Workers (3 concurrent) → Detail page fetch
    ↓
Transform (TierI standardization)
    ↓ immoscout24Transformer.ts
Ingest API
    ↓ POST /api/v1/properties/bulk-ingest
PostgreSQL (partitioned by property_category)
```

## Key Features

### REST API Integration
- Uses Axios HTTP client with standard headers
- No Cloudflare protection (direct API access)
- 6 search categories processed sequentially
- Per-category pagination handled via API

### Checksum Optimization
- Phase 1: Discover all listings (IDs + minimal data)
- Phase 2: Compare checksums with ingest service (80-90% skip rate on stable periods)
- Phase 3: Only fetch full details for new/changed listings
- Typical savings: 80-90% API calls on repeat runs

### Worker Queue
- BullMQ (v5 API) processes detail fetches in parallel
- 3 concurrent workers (configurable via WORKER_CONCURRENCY)
- Queue drained before each scrape run
- Final stats tracked for metrics

### Transaction Type Support
- **Sale**: Property_category = apartment/house/land/commercial
- **Rent**: Mapped to same categories (transaction_type differentiates)

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| HTTP Client | Axios 1.6.0 | REST API communication |
| Async Job Queue | BullMQ 5.0.0 | Parallel detail worker processing |
| Framework | Express 4.18.2 | Health check & /scrape endpoint |
| Type System | TypeScript 5.0 | Type safety for API responses |
| Transformation | Native TS | StandardProperty mapping |

## Key Files

### Core Scraper Logic
- `src/index.ts` - Express server, main orchestration loop, metrics reporting
- `src/scraper/threePhaseOrchestrator.ts` - Three-phase workflow (discovery → checksum → queue)
- `src/queue/detailQueue.ts` - BullMQ worker setup & job processing

### Data Fetching
- `src/utils/fetchData.ts` - Axios calls to ImmobilienScout24 API (fetchSearchListings)
- `src/utils/checksumExtractor.ts` - Create checksums from search results

### Transformation & Ingestion
- `src/transformers/immoscout24Transformer.ts` - Raw API response → StandardProperty
- `src/adapters/ingestAdapter.ts` - POST to ingest service bulk-ingest endpoint
- `src/types/immoscout24Types.ts` - TypeScript interfaces for API responses

### Configuration
- `package.json` - Dependencies (Axios, BullMQ, Express)
- Env vars: `INGEST_API_URL`, `INGEST_API_KEY_IMMOBILIENSCOUT24_AT`, `WORKER_CONCURRENCY`, `PORT`

## Endpoints

### Health Check
```
GET /health
```
Returns scraper status, queue stats, worker count.

### Trigger Scrape
```
POST /scrape
```
Responds 202 immediately, runs scraper asynchronously. Triggers full three-phase workflow.

## Environmental Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| PORT | 8082 | Express server port |
| INGEST_API_URL | http://localhost:3011 | Ingest service base URL |
| INGEST_API_KEY_IMMOBILIENSCOUT24_AT | dev_key_at_1 | Portal-specific API key |
| WORKER_CONCURRENCY | 3 | Parallel detail fetchers |

## Notable Quirks & Limitations

### REST API Design
- API returns summary listings in search results (ID, title, price, location basics)
- Detail page must be fetched separately for full data (handled by detail workers)
- No rate limiting observed, but respectful 2-3s delays between API calls

### Field Availability
- **Always present**: price, property_type, transaction_type, title, address, city, coordinates
- **Conditional**: bedrooms, bathrooms, renovation_year (depends on property_type and completeness)
- **Missing from API**: available_from (not provided by portal)

### Checksum Strategy
- Checksums calculated from: `portalId` + `title` + `price` + `sqm` + `location` + `published_date`
- Allows 80-90% skip rate on stable markets (no new/changed listings)
- Checksums stored in ingest service (separate from this scraper)

### Austrian-Specific Fields
- **Ownership types**: eigentumsrecht (freehold), baurecht (building right), mietkauf (rent-to-own), erbpacht (perpetual lease), genossenschaft (cooperative)
- **Energy ratings**: A-G scale per Austrian building standards
- **Heating types**: central, district, gas, electric, oil, heat pump, floor heating
- **Condition states**: new, refurbished, renovated, good, needs_renovation, project, under_construction

### Category Routing
- All properties must specify `property_category` (apartment/house/land/commercial)
- Mapped from ImmoScout24's `propertyType` enum (APARTMENT, HOUSE, SINGLE_FAMILY_HOUSE, VILLA, TOWNHOUSE, LAND, COMMERCIAL, etc.)
- Fallback to 'apartment' if unmapped type encountered

## Troubleshooting

### "Queue statistics unavailable"
- BullMQ connection issue. Verify Redis is running and accessible.
- Check `REDIS_URL` environment variable.

### "Checksum comparison failed"
- Ingest service unreachable. Verify `INGEST_API_URL` and `INGEST_API_KEY_IMMOBILIENSCOUT24_AT`.
- Check ingest service logs for checksum endpoint issues.

### "Workers stuck processing"
- Worker concurrency too high for system resources. Reduce `WORKER_CONCURRENCY`.
- Check for network timeouts in detail fetch (increase timeout in queue/detailQueue.ts).

### Low data fidelity on some listings
- ImmoScout24 API may return incomplete data for older listings.
- Check `portal_metadata.immobilienscout24.property_type` and `property_sub_type` for edge cases.

## Performance Notes

- **Phase 1 (Discovery)**: ~2-5 minutes for 50k listings
- **Phase 2 (Checksum comparison)**: ~1-2 minutes (batched in 5k chunks)
- **Phase 3 (Detail fetch & ingest)**: ~5-10 minutes (BullMQ workers, 3 concurrent)
- **Total typical run**: 10-20 minutes
- **Expected data savings**: 80-90% of API calls on repeat runs (checksums)

## Related Documentation
- `/docs/FIELD_MAPPING.md` - Complete portal field to TierI field mapping
- `src/transformers/immoscout24Transformer.ts` - Field transformation logic
- `src/types/immoscout24Types.ts` - API response schema
