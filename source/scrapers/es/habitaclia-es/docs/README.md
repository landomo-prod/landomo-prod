# Habitaclia.com Scraper

## Overview
- **Portal**: Habitaclia.com
- **URL**: https://www.habitaclia.com
- **Country**: Spain
- **Categories**: Apartments, Houses, Land, Commercial
- **Data Source**: HTML (search pages + detail pages via Playwright)
- **Anti-bot**: Advanced (Playwright browser, cookie management, JavaScript rendering)

## Quick Stats
- **Active Listings**: ~150,000+ across all categories
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with Playwright + BullMQ workers
- **Data Format**: Three-phase (discovery → checksum → detail)

## Data Flow
Portal → Property Type/Province/Transaction Combinations → Search Pages (HTML) → Detail Pages (Playwright) → Transformation → Ingest API

## Architecture

### Three-Phase Scrape Pattern
1. **Phase 1 (Discovery)**: Fetch search result pages across property types, provinces, and transaction types
2. **Phase 2 (Checksum)**: Compare checksums with database to identify new/changed listings
3. **Phase 3 (Detail)**: Queue detail page fetches for new/changed listings using BullMQ workers (default 40 concurrent)

### Key Components
- **Listing Scraper** (`listingsScraper.ts`): Iterates search configurations (property type × province × transaction)
- **Fetch Data** (`utils/fetchData.ts`): HTTP client with Playwright for JavaScript rendering
- **Detail Scraper** (`detailScraper.ts`): Fetches and parses property detail pages
- **Transformers** (`transformers/{apartments,houses,land,commercial}/`): Category-specific transformations
- **Ingest Adapter** (`ingestAdapter.ts`): POSTs bulk properties to ingest API
- **Queue** (`queue/detailQueue.ts`): BullMQ workers process detail fetch jobs
- **Cookies** (`utils/cookieManager.ts`): Manages session persistence

## Search Coverage

### Property Types
- Apartment (Piso)
- House (Casa/Chalet)
- Land (Terreno)
- Commercial (Local/Oficina/Nave)

### Transaction Types
- Sale (Venta)
- Rent (Alquiler)

### Scale
- **Provinces**: ~50 Spanish provinces
- **Property Types**: 4
- **Transaction Types**: 2
- **Max Combinations**: 400 (depends on config)
- **Max Pages**: 200 per combination
- **Typical Coverage**: 100,000+ listings

## Features

### HTML-Based Extraction
- Search results parsed via Cheerio
- Property cards contain essential data (ID, price, location, features)
- Pagination via page numbers
- Deduplication across pages

### Browser-Based Detail Fetching
- Playwright for JavaScript-heavy detail pages
- Cookie persistence for search continuity
- Handles dynamic content loading
- Timeout handling (30s default)

### Checksum Mode
- Enabled in three-phase orchestrator
- Compares listing ID checksums before detail fetching
- ~70-80% reduction in API calls on stable periods

### Category Detection
- Property type/province mapping in search config
- Auto-detection via features (bedrooms, plot area, amenities)
- Land identified by missing room fields
- Commercial categorized from URL/property type

### Feature Extraction
- Amenities: elevator, balcony, parking, basement, terrace, garage, pool, AC
- Condition from age/state indicators
- Energy certificates when available
- Agent/agency contact info
- Multiple images and descriptions

## Notes

### Portal Quirks
- Heavily JavaScript-dependent detail pages (requires Playwright)
- Rate limiting enforced (429 responses trigger 30s waits)
- Province/property type combinations variable availability
- Pagination may reset unexpectedly (handles via seenIds)
- Special handling for bathrooms (rooms minus 1 logic)

### Data Quality
- Images consistently available (2-15 per property)
- Accurate pricing and location data
- Feature availability varies by property type
- Energy certificates not always present
- Agency contact info usually available

### Limitations
- Max 200 pages per combination (covers most results)
- Detail page fetching slow (3-5s per page)
- 40 concurrent workers (balanced with portal stability)
- Circuit breaker: >30% stale listings skips combination
- Rate limiting: 429 errors trigger exponential backoff

## Environment Variables
```
PORT=8080                          # Express server port
DETAIL_CONCURRENCY=40              # Detail fetch workers
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY=dev_key_es_1
INSTANCE_COUNTRY=es
```

## Performance
- **Discovery**: ~10-20 min (property types × provinces × pages)
- **Detail Fetch**: ~40-80 min (40 workers, 3-5s per page)
- **Total Scrape**: ~60-100 min with 40 workers
- **Queue Monitoring**: Via `/stats` endpoint

## API Endpoints
- `GET /health` - Health check
- `POST /scrape` - Trigger three-phase scrape
- `GET /stats` - Queue and run statistics

## Deployment
Container: `scrapers/Spain/habitaclia` (Dockerfile in parent build context)
Network: `es-network` (Docker Compose)
Port: 8080 (internal: 3000 → 8080 mapped)
Memory: Node.js max 4GB (Playwright overhead)

## Troubleshooting

### No Listings Found
- Verify search configuration (property type/province combos)
- Test portal URL manually for changes
- Check if portal changed HTML structure
- Verify province slugs are correct

### Rate Limiting Issues
- Portal enforces 429 responses
- Automatic 30s backoff implemented
- Reduce worker concurrency if persistent
- Check portal load (may be under high traffic)

### Playwright Timeout
- Increase timeout settings (currently 30s)
- Check network connectivity
- Verify portal page load performance
- Reduce worker concurrency

### Worker Queue Stuck
- Restart worker process
- Monitor Playwright browser processes
- Check system memory usage
- Review detail page availability

### JavaScript Rendering Issues
- Verify portal JavaScript hasn't changed
- Test detail page in browser manually
- Check Playwright version compatibility
- Review selector updates needed

## Related Files
- `docker/docker-compose.yml` - Service definition
- `docker/monitoring/` - Grafana dashboards
- `shared-components/src/types/` - Core types
- `ingest-service/src/database/` - Ingestion logic
