# Donpiso.com Scraper

## Overview
- **Portal**: Donpiso.com
- **URL**: https://www.donpiso.com
- **Country**: Spain
- **Categories**: Apartments, Houses, Land, Commercial
- **Data Source**: HTML (JSON-LD structured data + fallback HTML parsing)
- **Anti-bot**: Basic (realistic headers, random delays, rate limiting)

## Quick Stats
- **Active Listings**: ~50,000-100,000 across Spain
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with BullMQ workers
- **Data Format**: Three-phase (discovery → checksum → detail)

## Data Flow
Portal → Province/Transaction Segments → Search Pages (JSON-LD parsing) → Detail Pages → Transformation → Ingest API

## Architecture

### Three-Phase Scrape Pattern
1. **Phase 1 (Discovery)**: Fetch all listings across provinces (sale + rent) via search pages
2. **Phase 2 (Checksum)**: Compare checksums with database to identify new/changed listings
3. **Phase 3 (Detail)**: Queue detail page fetches for new/changed listings using BullMQ workers

### Key Components
- **Listing Scraper** (`listingsScraper.ts`): Iterates provinces and pages, parses JSON-LD
- **Detail Scraper** (`detailScraper.ts`): Fetches individual property pages
- **Transformer** (`donpisoTransformer.ts`): Maps Donpiso data to category-specific TierI types
- **Ingest Adapter** (`ingestAdapter.ts`): POSTs bulk properties to ingest API
- **Queue** (`queue/detailQueue.ts`): BullMQ workers process detail fetch jobs

## Search Coverage
- **Provinces**: 52 Spanish provinces (Donpiso-specific slugs)
- **Transaction Types**: Sale, Rent
- **Combinations**: ~104 search segments
- **Max Pages**: 50 per segment (configurable)

## Features

### JSON-LD Parsing
- Primary extraction method via `<script type="application/ld+json">` tags
- Handles single objects, arrays, and nested ItemList structures
- Extracts RealEstateListing schema: url, name, description, image, offers/price

### Fallback HTML Parsing
- Graceful degradation if JSON-LD insufficient
- Multiple card selectors tested (.property-card, .inmueble, etc.)
- Extracts title, price, URL, description, images from HTML attributes

### Checksum Mode
- Enabled by default in three-phase orchestrator
- Compares portal ID checksums before detail fetching
- ~80-90% reduction in API calls on stable periods

### Rate Limiting
- Throttle: 100 concurrent requests max
- Delays: 300-800ms between page fetches
- Realistic browser headers (User-Agent rotation)

## Notes

### Portal Quirks
- URL structure includes province slug and transaction type (sale/rent)
- JSON-LD embeds full listing data in search pages (unusual)
- Property type inference from title (piso, casa, terreno, local, oficina, nave)
- Category detection: title keyword matching (not explicit API field)

### Data Quality
- Prices in EUR, validated via parseSpanishPrice utility
- Images extracted from JSON-LD and HTML
- Agent info (name, phone, email) from detail pages
- Bathroom count may be missing in apartments

### Limitations
- Max 50 pages per segment (typically covers all results)
- Circuit breaker: >30% stale listings skips segment
- Terminal protection: sold/rented never overwritten
- Detail page availability: ~95% success rate

## Environment Variables
```
PORT=8221                          # Express server port
WORKER_CONCURRENCY=10              # Detail fetch workers
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY=dev_key_es_1
INSTANCE_COUNTRY=es
```

## Performance
- **Discovery**: ~2-5 min (all provinces + pages)
- **Detail Fetch**: ~5-20 min (depends on new listings)
- **Total Scrape**: ~10-30 min with 10 workers
- **Queue Monitoring**: Real-time stats via `/health`

## API Endpoints
- `GET /health` - Health check + queue stats
- `POST /scrape` - Trigger three-phase scrape (returns 202)
- `POST /scrape-runs/{start,complete,fail}` - Tracker endpoints (via ScrapeRunTracker)

## Deployment
Container: `scrapers/Spain/donpiso` (Dockerfile in parent build context)
Network: `es-network` (Docker Compose)
Port: 8221 (internal: 3000 → 8221 mapped)

## Troubleshooting

### Low Listing Count
- Check province slug mappings (DONPISO_PROVINCES in helpers)
- Verify JSON-LD structure on portal (may change)
- Review fallback HTML selector coverage

### Timeout Errors
- Increase request timeout (currently 30s)
- Check rate limiter throttle settings
- Monitor portal uptime

### Worker Queue Stuck
- Restart worker process
- Check detail page availability (test a URL manually)
- Verify ingest API connectivity

## Related Files
- `docker/docker-compose.yml` - Service definition
- `docker/monitoring/` - Grafana dashboards for monitoring
- `ingest-service/src/routes/monitoring-dashboard.ts` - Tracking endpoints
