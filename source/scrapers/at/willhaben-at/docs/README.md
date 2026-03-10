# Willhaben.at Scraper

## Overview
- **Portal**: Willhaben Austria
- **URL**: https://www.willhaben.at/
- **Country**: Austria
- **Categories**: Apartments (sale/rent), Houses (sale/rent)
- **Data Source**: REST API (JSON from fetch requests)
- **Anti-bot**: CSRF token required (moderate protection)
- **Architecture**: HTTP-based search + REST pagination, three-phase checksum-optimized, BullMQ workers

## Quick Stats
- **Active Listings**: ~80,000-120,000 (largest Austrian portal)
- **Scrape Frequency**: Configurable (24-48 hour typical, high volume)
- **Technology**: TypeScript/Express, Axios HTTP client, BullMQ workers
- **Scope**: All property types and transaction types

## Data Flow

```
Willhaben.at API
    ↓
Phase 1: Fetch Search Results (CSRF-authenticated)
    ↓ extractCsrfToken() → POST /search
30-per-page pagination
    ↓
Extract listing data from JSON responses
    ↓
Phase 2: Checksum Comparison (Change Detection)
    ↓ compareChecksums() via ingest service
Categorize: new | changed | unchanged
    ↓
Phase 3: Queue Detail Fetches (Optional)
    ↓ addDetailJobs()
BullMQ Workers (3 concurrent) → Optional detail enrichment
    ↓
Transform (TierI standardization)
    ↓ willhabenTransformer.ts
Ingest API
    ↓ POST /api/v1/properties/bulk-ingest
PostgreSQL (partitioned by property_category)
```

## Key Features

### REST API + CSRF Token
- Willhaben requires CSRF token for search requests
- Token extracted from initial page load
- Standard User-Agent rotation for legitimacy
- 30 listings per page (default, stable)

### Checksum Optimization
- Phase 1: Fetch all listings via paginated search API
- Phase 2: Compare checksums with ingest service (60-75% skip rate on stable periods)
- Phase 3: Optional detail page enrichment via workers
- Typical savings: 60-75% API calls on repeat runs

### Worker Queue
- BullMQ (v5 API) processes optional detail fetches in parallel
- 3 concurrent workers (configurable via WORKER_CONCURRENCY)
- Detail fetching optional (most data in search results)
- Queue drained before each scrape run

### Comprehensive Data Extraction
- Search results contain most needed fields
- Optional detail page fetch for additional enrichment
- Flexible field mapping via `getAttribute()` helpers

### All Transaction Types
- **Sale**: Apartments, Houses, Land, Commercial
- **Rent**: Same categories
- Clear separation in API responses

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| HTTP Client | Axios 1.6.0 | REST API communication, CSRF token management |
| Async Job Queue | BullMQ 5.0.0 | Parallel optional detail workers |
| Framework | Express 4.18.2 | Health check & /scrape endpoint |
| Type System | TypeScript 5.0 | Type safety for API responses & attribute access |
| Transformation | Native TS | StandardProperty mapping via getAttribute() |

## Key Files

### Core Scraper Logic
- `src/index.ts` - Express server, main orchestration, metrics
- `src/scraper/threePhaseOrchestrator.ts` - Three-phase workflow
- `src/queue/detailQueue.ts` - Optional BullMQ worker setup

### Data Fetching
- `src/utils/fetchData.ts` - CSRF token extraction, paginated search API calls
- `src/utils/userAgents.ts` - User-Agent rotation for legitimacy

### Transformation & Ingestion
- `src/transformers/willhabenTransformer.ts` - API JSON → StandardProperty
- `src/adapters/ingestAdapter.ts` - POST to ingest service bulk-ingest endpoint
- `src/types/willhabenTypes.ts` - TypeScript interfaces, getAttribute() helpers

### Configuration
- `package.json` - Dependencies (Axios, BullMQ, Express)
- Env vars: `INGEST_API_URL`, `INGEST_API_KEY_WILLHABEN_AT`, `WORKER_CONCURRENCY`, `PORT`

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
| PORT | 8090 | Express server port |
| INGEST_API_URL | http://localhost:3011 | Ingest service base URL |
| INGEST_API_KEY_WILLHABEN_AT | dev_key_at_1 | Portal-specific API key |
| WORKER_CONCURRENCY | 3 | Parallel detail fetchers (optional) |

## Notable Quirks & Limitations

### CSRF Token Requirement
- Willhaben requires CSRF token for search endpoint
- Token extracted from initial page request
- Token valid for session (reused across pagination)
- Token extraction may fail if page structure changes

### Pagination
- 30 listings per page (hardcoded by Willhaben)
- Sequential pagination via page number parameter
- No maximum results limit (full exhaustive scan possible)
- Largest Austrian portal: 80k-120k listings

### Field Structure
- API returns attributes as key-value pairs
- Use `getAttribute(listing, 'KEY')` helper to safely extract values
- Use `getAttributes(listing, 'KEY')` for multi-value fields
- Null-safe access pattern handles missing fields gracefully

### Field Availability
- **Always present**: ID, listing type, price, location basics
- **Often present**: address, rooms, bedrooms, coordinates
- **Sometimes present**: floor, renovation_year, condition, heating
- **Rarely present**: bathrooms (not separately tracked), construction_type, energy_rating
- **Missing**: available_from (not provided), deposit (not separated)

### Checksum Strategy
- Checksums calculated from: `portalId` + `title` + `price` + `sqm` + `location`
- Lower skip rate (~60-75%) than single-portal-only scrapers due to high volume of real changes
- Checksums stored in ingest service

### Property Type Mapping
- Willhaben uses PROPERTY_TYPE_ID and PROPERTY_TYPE fields
- Mapped to standard categories: apartment, house, land, commercial
- May include edge cases: garages, parking spaces (mapped to 'other')

### Optional Detail Enrichment
- Most data available in search results (title, price, location, rooms, area)
- Detail page fetch optional (currently commented out in code)
- Uncomment `fetchListingDetail()` for additional fields if needed
- Detail fetch adds ~2-3x scrape time (optional trade-off)

### No Rate Limiting Required
- Willhaben cooperative: no aggressive rate limiting detected
- Standard delays (1-2 sec between pages) sufficient
- No Cloudflare or bot detection

## Troubleshooting

### "CSRF token extraction failed"
- Willhaben page structure may have changed
- Check if token is in a different location (meta tag vs inline script)
- Add debug logs to extractCsrfToken() to inspect HTML

### "0 listings returned"
- API endpoint may have changed
- Check network requests in browser to verify correct URL
- Verify CSRF token is valid for the session

### "Workers timing out"
- Detail page fetch taking too long. Optional enrichment - leave disabled if not needed.
- Increase timeout if detail pages are slow.
- Reduce WORKER_CONCURRENCY if system overloaded.

### "Checksum comparison failed"
- Ingest service unreachable. Verify `INGEST_API_URL` and `INGEST_API_KEY_WILLHABEN_AT`.
- Check ingest service logs.

### "getAttribute returns null for expected fields"
- Field name may have changed on portal
- Check `willhabenTypes.ts` for available FIELD_* constants
- Use wildcard inspection: log all getAttribute values on first run

## Performance Notes

- **Phase 1 (Discovery)**: ~5-15 minutes for 100k listings (REST API pagination)
- **Phase 2 (Checksum comparison)**: ~2-3 minutes (batched in 5k chunks)
- **Phase 3 (Detail fetch - optional)**: ~20-30 minutes if enabled (adds significant time)
- **Total typical run**: 10-20 minutes (discovery + checksum only; detail optional)
- **Expected data savings**: 60-75% of API calls on repeat runs (checksums)
- **Largest Austrian scraper**: Handles 80k-120k listings efficiently

## Related Documentation
- `/docs/FIELD_MAPPING.md` - Complete portal field to TierI field mapping
- `src/transformers/willhabenTransformer.ts` - Field transformation logic via getAttribute()
- `src/types/willhabenTypes.ts` - Attribute key constants and helper functions
