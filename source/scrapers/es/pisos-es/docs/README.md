# Pisos.com Scraper

## Overview
- **Portal**: Pisos.com
- **URL**: https://www.pisos.com
- **Country**: Spain
- **Categories**: Apartments, Houses, Land, Commercial
- **Data Source**: HTML (search pages + detail pages via cheerio)
- **Anti-bot**: Basic (realistic headers, rate limiting, cheerio parsing)

## Quick Stats
- **Active Listings**: ~200,000+ across all categories and provinces
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with BullMQ workers
- **Data Format**: Three-phase (discovery → checksum → detail)
- **Province Filtering**: Optional (supports targeted scrapes)

## Data Flow
Portal → Province × Category Combinations → Search Pages (HTML) → Detail Pages → Transformation → Ingest API

## Architecture

### Three-Phase Scrape Pattern
1. **Phase 1 (Discovery)**: Fetch search result pages across provinces and property categories
2. **Phase 2 (Checksum)**: Compare checksums with database to identify new/changed listings
3. **Phase 3 (Detail)**: Queue detail page fetches for new/changed listings using BullMQ workers (default 40 concurrent)

### Key Components
- **Listing Scraper** (`listingsScraper.ts`): Iterates province × category combinations, supports filtering
- **Fetch Data** (`utils/fetchData.ts`): HTTP client with pagination and rate limiting
- **Detail Scraper** (`detailScraper.ts`): Fetches individual property detail pages
- **Transformer** (`pisosTransformer.ts`): Maps Pisos.com data to category-specific TierI types
- **Ingest Adapter** (`ingestAdapter.ts`): POSTs bulk properties to ingest API
- **Queue** (`queue/detailQueue.ts`): BullMQ workers process detail fetch jobs
- **Category Detection** (`utils/categoryDetection.ts`): Routes to category-specific transformers

## Search Coverage

### Property Categories
- Apartments (sale + rent)
- Houses (sale + rent)
- Land (sale)
- Commercial (offices, retail, warehouses - sale + rent)

### Geographic Coverage
- **Provinces**: 52 Spanish provinces with URL slugs
- **Transaction Types**: Sale and rent (varies by category)
- **Typical Combinations**: 100-150 (provinces × categories)
- **Max Pages**: Configurable, typically 200+

### Province Filtering
- Optional `--provinces` parameter: comma-separated province slugs
- Enables targeted scraping for specific regions
- Useful for testing or focusing on high-value areas

## Features

### HTML-Based Extraction
- Cheerio parsing for search result cards
- Property details in card attributes and nested elements
- Pagination via page number parameter
- Deduplication by portal ID across pages

### Two-Phase Processing
- Phase 1: Extract minimal data (IDs, URLs, basic info) from search
- Phase 2: Queue detail pages for full data extraction
- Parallel detail fetching via BullMQ

### Checksum Mode
- Enabled in three-phase orchestrator
- Compares portal ID checksums before detail fetching
- ~80% reduction in API calls on stable periods

### Category Detection
- Automatic detection from URL structure
- Property type slug extraction from listing URL
- Maps to category-specific transformers (apartment, house, land, commercial)
- Subtype mapping (piso, chalet, terreno, local, oficina, nave)

### Feature Extraction
- Amenities: elevator, balcony, parking, basement, terrace, garage, garden, pool, fireplace
- Condition indicators: new, renovated, needs_renovation
- Building age and construction year
- Energy certificates (A-G scale)
- Heating type, furnished status
- Multiple images and descriptions
- Agent/agency contact information

## Notes

### Portal Quirks
- URL structure includes transaction type: `/comprar/`, `/venta/`, `/alquilar/`, `/alquiler/`
- Property type detectable from URL slug
- Pagination via `start=` parameter (not "next" links)
- Batch scraping with filtering: supports targeting specific provinces
- Detail pages contain structured data (JSON-LD may be present)

### Data Quality
- Images: 2-20+ per property (typically good coverage)
- Pricing: Accurate in EUR (rent: monthly, sale: total)
- Location data: City, district, postal code, coordinates often available
- Agent info: Usually present (agency name, phone, email)
- Features: Comprehensive feature lists from detail pages

### Limitations
- Max 200+ pages per province+category (covers most results)
- Detail page fetching: 1-3 seconds per page (HTML parsing overhead)
- 40 concurrent workers (balanced with portal stability)
- Circuit breaker: >30% stale listings skips combination
- Some rare properties may lack detail pages

## Environment Variables
```
PORT=8200                          # Express server port
WORKER_CONCURRENCY=40              # Detail fetch workers
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY=dev_key_es_1
INSTANCE_COUNTRY=es
```

## Performance
- **Discovery**: ~10-20 min (provinces × categories × pages)
- **Detail Fetch**: ~30-60 min (40 workers, 1-3s per page)
- **Total Scrape**: ~50-80 min with 40 workers
- **Province Filtering**: ~5-15 min for single province
- **Queue Monitoring**: Real-time stats via `/health`

## API Endpoints
- `GET /health` - Health check + queue stats + metrics
- `POST /scrape` - Trigger three-phase scrape (optional `?provinces=madrid,barcelona`)
- `/metrics` - Prometheus metrics endpoint (via setupScraperMetrics)

## Deployment
Container: `scrapers/Spain/pisos-com` (Dockerfile in parent build context)
Network: `es-network` (Docker Compose)
Port: 8200 (internal: 3000 → 8200 mapped)
Memory: Node.js max 4GB (--max-old-space-size=4096)

## Usage Examples

### Scrape All Spain
```bash
curl -X POST http://localhost:8200/scrape
```

### Scrape Specific Provinces
```bash
curl -X POST "http://localhost:8200/scrape?provinces=madrid,barcelona,valencia"
```

### Check Status
```bash
curl http://localhost:8200/health
```

## Troubleshooting

### Low Listing Count
- Verify province slugs (check SPANISH_PROVINCES in helpers)
- Test search manually on portal
- Check for URL structure changes
- Review category detection logic

### Detail Fetch Failures
- Verify detail page URLs (test manually)
- Check cheerio selectors match current DOM
- Review rate limiting (may need adjustment)
- Test network connectivity to portal

### Worker Queue Stuck
- Restart worker process
- Monitor system memory
- Check detail page availability
- Review ingest API logs

### Province Filter Not Working
- Verify comma-separated format: `madrid,barcelona,valencia`
- Check province slugs exist in SPANISH_PROVINCES
- Test single province first

## Related Files
- `docker/docker-compose.yml` - Service definition
- `docker/monitoring/` - Grafana dashboards for monitoring
- `shared-components/src/types/` - Core types
- `ingest-service/src/database/bulk-operations.ts` - Ingestion logic
- `scripts/deploy-search.sh` - Deployment automation
