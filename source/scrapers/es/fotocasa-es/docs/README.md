# Fotocasa.es Scraper

## Overview
- **Portal**: Fotocasa.es
- **URL**: https://www.fotocasa.es
- **Country**: Spain
- **Categories**: Apartments, Houses, Land, Commercial (Offices, Retail, Warehouses)
- **Data Source**: API (JSON search results + detail pages)
- **Anti-bot**: Advanced (Playwright browser, cookie management, realistic headers)

## Quick Stats
- **Active Listings**: ~200,000+ across all categories and transaction types
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with Playwright + BullMQ workers
- **Data Format**: Three-phase (discovery → checksum → detail)

## Data Flow
Portal API → Property Type × Transaction Type → Search Pages (JSON API) → Detail Pages → Transformation → Ingest API

## Architecture

### Three-Phase Scrape Pattern
1. **Phase 1 (Discovery)**: Fetch all listings via search API across property types (apartments, houses, land, commercial) and transaction types (sale, rent)
2. **Phase 2 (Checksum)**: Compare checksums with database to identify new/changed listings
3. **Phase 3 (Detail)**: Queue detail page fetches for new/changed listings using BullMQ workers (default 75 concurrent)

### Key Components
- **Listing Scraper** (`listingsScraper.ts`): Orchestrates property type × transaction type combinations
- **Fetch Data** (`utils/fetchData.ts`): API client with pagination, rate limiting, cookie management
- **Detail Scraper** (`detailScraper.ts`): Fetches property details (HTML or JSON)
- **Transformers** (`transformers/{apartments,houses,land,commercial}/`): Category-specific transformations
- **Ingest Adapter** (`ingestAdapter.ts`): POSTs bulk properties to ingest API
- **Queue** (`queue/detailQueue.ts`): BullMQ workers process detail fetch jobs
- **Cookies** (`utils/cookieManager.ts`): Manages session cookies for API authentication

## Search Coverage

### Property Types
- `VIVIENDA` (1): Apartments + Houses (auto-categorized)
- `TERRENO` (5): Land
- `OFICINA` (6): Offices (commercial)
- `LOCAL` (7): Retail (commercial)
- `NAVE` (8): Warehouses (commercial)

### Transaction Types
- SALE: Property for sale
- RENT: Property for rental

### Scale
- **Combinations**: 5 types × 2 transactions = 10 searches
- **Max Pages**: 500 per type (configurable)
- **Typical**: 100,000+ listings per month

## Features

### API-Based Extraction
- Search API returns JSON with pagination
- Each property has minimal info (ID, location, price, images, features)
- Detail pages fetch full data via separate requests
- Efficient compared to HTML parsing

### Browser-Based Detail Fetching
- Playwright for JavaScript-heavy detail pages
- Cookie persistence for session management
- Handles dynamic content loading
- Fallback to HTTP if page unavailable

### Checksum Mode
- Enabled in three-phase orchestrator
- Compares listing ID checksums before detail fetching
- ~75-85% reduction in API calls on stable periods

### Category Detection
- VIVIENDA type auto-detected via features (bedrooms, plot area)
- Offices, retail, warehouses mapped from propertyTypeId
- Land identified by missing bedroom/bathroom fields

### Feature Extraction
- Elevators, balconies, parking, basements from feature arrays
- Condition inferred from age/state indicators
- Energy certificates when available
- Images, videos (virtual tours available)

## Notes

### Portal Quirks
- Property type VIVIENDA includes both apartments and houses (auto-detect needed)
- Search API more reliable than HTML scraping
- Detail pages heavily JavaScript-dependent
- Cookie management required for some searches
- Virtual tour URLs embedded in detail pages

### Data Quality
- High image availability (3-20+ per property)
- Accurate pricing and location data
- Feature arrays comprehensive
- Energy certificate often present
- Agent info: agency name typically available

### Limitations
- Search API may return duplicates across price segments
- Detail page JavaScript loading can be slow (2-5s per page)
- Max 500 pages per property type
- Some listings without detail data available
- Circuit breaker: >30% stale listings skips type

## Environment Variables
```
PORT=8201                          # Express server port
WORKER_CONCURRENCY=75              # Detail fetch workers (high parallelism)
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY=dev_key_es_1
INSTANCE_COUNTRY=es
```

## Performance
- **Discovery**: ~5-15 min (5 types × 2 transactions with pagination)
- **Detail Fetch**: ~30-60 min (75 workers, 2-5s per page)
- **Total Scrape**: ~45-75 min with 75 workers
- **Queue Monitoring**: Real-time stats via `/health`

## API Endpoints
- `GET /health` - Health check + queue stats + metrics
- `POST /scrape` - Trigger three-phase scrape (returns 202)
- `/metrics` - Prometheus metrics endpoint (via setupScraperMetrics)

## Deployment
Container: `scrapers/Spain/fotocasa` (Dockerfile in parent build context)
Network: `es-network` (Docker Compose)
Port: 8201 (internal: 3000 → 8201 mapped)
Memory: Node.js max 4GB (--max-old-space-size=4096)

## Troubleshooting

### Low Listing Count
- Check property type coverage (ensure all 5 types included)
- Verify API endpoint hasn't changed
- Monitor rate limiting (may be throttling requests)
- Test search manually in browser

### Detail Fetch Timeouts
- Increase Playwright timeout settings
- Reduce worker concurrency if memory issues
- Check portal page load performance
- Verify network connectivity

### Worker Queue Stuck
- Restart worker process
- Check Playwright browser process status
- Monitor system memory
- Review ingest API logs

### Session/Cookie Errors
- Clear stored cookies (force login)
- Verify cookie persistence settings
- Check for 403 errors (may need new session)

## Related Files
- `docker/docker-compose.yml` - Service definition
- `docker/monitoring/` - Grafana dashboards for monitoring
- `shared-components/src/types/` - Core types
- `ingest-service/src/routes/` - Ingestion API
