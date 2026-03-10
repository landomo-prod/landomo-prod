# Enalquiler.com Scraper

## Overview
- **Portal**: Enalquiler.com
- **URL**: https://www.enalquiler.com
- **Country**: Spain
- **Categories**: Apartments, Houses (rental-focused)
- **Data Source**: HTML (search API + detail pages)
- **Anti-bot**: Basic (realistic headers, rate limiting, cheerio parsing)

## Quick Stats
- **Active Listings**: ~100,000+ rental properties
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with BullMQ workers
- **Data Format**: Three-phase (discovery → checksum → detail)

## Data Flow
Portal → Province/Property Type Combinations → Search Pages (HTML parsing) → Detail Pages → Transformation → Ingest API

## Architecture

### Three-Phase Scrape Pattern
1. **Phase 1 (Discovery)**: Fetch search result pages across property types and provinces
2. **Phase 2 (Checksum)**: Compare checksums with database to identify new/changed listings
3. **Phase 3 (Detail)**: Queue detail page fetches for new/changed listings using BullMQ workers

### Key Components
- **Listing Scraper** (`listingsScraper.ts`): Iterates configs (property type + province combos), parses search results
- **Detail Queue** (`queue/detailQueue.ts`): BullMQ workers fetch and process detail pages
- **Transformers** (`transformers/apartments/`, `transformers/houses/`): Category-specific transformations
- **Ingest Adapter** (`ingestAdapter.ts`): POSTs bulk properties to ingest API
- **Fetch Data** (`utils/fetchData.ts`): HTTP client with retries and headers

## Search Coverage
- **Property Types**: Apartment, House
- **Provinces**: Spanish provinces (dynamic configuration)
- **Transaction Type**: Rental only (portal focus)
- **Max Pages**: 300 per config (configurable)
- **Combinations**: Typically 20-50 (property type × provinces)

## Features

### Search Parsing
- Cheerio-based HTML parsing for search result cards
- Extracts listing IDs, URLs, prices, property details from DOM
- Handles pagination via page numbers
- Deduplication by listing ID across pagination

### Category Detection
- Property type mapping: estateTypeId and propertyType fields
- Defaults to apartment if ambiguous
- Supports houses with different features (sqm_plot, has_garden, etc.)

### Detail Fetching
- Two-phase for efficiency: discovery (URLs) → detail (full data)
- BullMQ queuing for parallel processing (default 20 workers)
- Rate limiting between requests (300-500ms delays)

### Checksum Mode
- Enabled in three-phase orchestrator
- Compares listing checksums before detail fetching
- ~70-80% reduction in API calls on stable periods

## Features

### Data Points Extracted
- Title, price (EUR), transaction type (rent)
- Bedrooms, bathrooms, square meters
- Boolean amenities: elevator, balcony, parking, basement, terrace, garage
- Building condition, energy certificate, heating type
- Agency name, phone, email
- Images (multiple), description
- Geographic: city, province, address, coordinates

### Special Handling
- Floor parsing: converts "1", "Planta 1", "Ático" to floor number
- Feature extraction: keywords in description for amenities
- Community fees (HOA) support
- Air conditioning detection from features

## Notes

### Portal Quirks
- Rental-focused portal (sale functionality may be limited)
- EstateTypeId used for category detection (mapping required)
- Province filters via URL parameters
- Pagination via page number (not "next" links)

### Data Quality
- Images typically available (1-10 per property)
- Agency contact info usually present
- Description may contain HTML entities (handled by cheerio)
- Coordinates often available in JSON-LD on detail pages

### Limitations
- Max 300 pages per config (covers most results)
- Detail page availability: ~95% success rate
- Some missing fields: energy certificate not always present
- Floor parsing may fail for unusual formats

## Environment Variables
```
PORT=8222                          # Express server port
WORKER_CONCURRENCY=20              # Detail fetch workers
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY=dev_key_es_1
INSTANCE_COUNTRY=es
```

## Performance
- **Discovery**: ~5-10 min (all property types + provinces)
- **Detail Fetch**: ~10-30 min (depends on new listings)
- **Total Scrape**: ~20-40 min with 20 workers
- **Queue Monitoring**: Via `/stats` endpoint

## API Endpoints
- `GET /health` - Health check
- `POST /scrape` - Trigger three-phase scrape
- `GET /stats` - Queue and run statistics

## Deployment
Container: `scrapers/Spain/enalquiler` (Dockerfile in parent build context)
Network: `es-network` (Docker Compose)
Port: 8222 (internal: 3000 → 8222 mapped)

## Troubleshooting

### No Listings Found
- Verify province/property type combinations in config
- Check if portal URL structure changed (try manual search)
- Test HTML selectors in browser console

### Detail Fetch Failures
- Check detail page URL format
- Verify cheerio selector matches current DOM
- Test rate limiting settings (may be too aggressive)

### Worker Queue Issues
- Restart worker process if stuck
- Monitor ingest API connectivity
- Check available memory (Node.js heap)

## Related Files
- `docker/docker-compose.yml` - Service definition
- `shared-components/src/types/` - Core types
- `ingest-service/src/database/bulk-operations.ts` - Ingestion logic
