# Immowelt.at Scraper

## Overview
- **Portal**: Immowelt Austria
- **URL**: https://www.immowelt.at/
- **Country**: Austria
- **Categories**: Apartments (sale/rent), Houses (sale/rent)
- **Data Source**: HTML + JavaScript (SPA with compressed data)
- **Anti-bot**: Basic (no Cloudflare)
- **Architecture**: Browser-based with lz-string decompression, three-phase checksum-optimized, BullMQ workers

## Quick Stats
- **Active Listings**: ~30,000-40,000 (estimated)
- **Scrape Frequency**: Configurable (12-24 hour typical)
- **Technology**: TypeScript/Express, Playwright browser automation, lz-string decompression
- **Scope**: Primary apartment and house sales/rentals

## Data Flow

```
Immowelt.at Website (SPA with compressed data)
    ↓
Playwright Browser (Standard headless mode)
    ↓
Phase 1: Fetch Search Results (SPA pagination)
    ↓ Standard page navigation
Extract listing JSON from compressed response
    ↓ lz-string decompression
Parse property data from JSON
    ↓
Phase 2: Checksum Comparison (Change Detection)
    ↓ compareChecksums() via ingest service
Categorize: new | changed | unchanged
    ↓
Phase 3: Queue Detail Page Fetches
    ↓ addDetailJobs()
BullMQ Workers (3 concurrent) → Detail page browse
    ↓
Extract from rendered HTML + JSON data
    ↓
Transform (TierI standardization)
    ↓ immoweltTransformer.ts
Ingest API
    ↓ POST /api/v1/properties/bulk-ingest
PostgreSQL (partitioned by property_category)
```

## Key Features

### Browser Automation
- Uses Playwright for browser control
- Standard headless mode (no stealth required)
- Minimal rate limiting needed (cooperative server)
- JSON extraction from page script tags

### Data Decompression
- Immowelt returns compressed JSON via lz-string
- Automatic decompression in fetcher
- Allows efficient data transfer from portal
- Significant data density improvement

### Checksum Optimization
- Phase 1: Discover all listings from SPA (pagination through all result pages)
- Phase 2: Compare checksums with ingest service (80-90% skip rate on stable periods)
- Phase 3: Only fetch full details for new/changed listings
- Typical savings: 80-90% browser page loads on repeat runs

### Worker Queue
- BullMQ (v5 API) processes detail fetches in parallel
- 3 concurrent workers (configurable via WORKER_CONCURRENCY)
- Queue drained before each scrape run
- Efficient handling of compressed data extraction

### Transaction Type Support
- **Sale**: Apartment sale, House sale (category routing)
- **Rent**: Apartment rent, House rent (category routing)

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Browser | Playwright 1.40.0 | HTML/SPA navigation & JSON extraction |
| Compression | lz-string 1.5.0 | Decompress Immowelt's compressed data |
| Async Job Queue | BullMQ 5.0.0 | Parallel detail worker processing |
| Framework | Express 4.18.2 | Health check & /scrape endpoint |
| Type System | TypeScript 5.0 | Type safety for data structures |
| Transformation | Native TS | StandardProperty mapping |

## Key Files

### Core Scraper Logic
- `src/index.ts` - Express server, main orchestration loop, metrics reporting
- `src/scraper/threePhaseOrchestrator.ts` - Three-phase workflow (discovery → checksum → queue)
- `src/queue/detailQueue.ts` - BullMQ worker setup & job processing

### Browser Automation
- `src/scrapers/listingsScraper.ts` - SPA pagination, JSON extraction logic

### Data Fetching & Extraction
- `src/utils/fetchData.ts` - Playwright page load, lz-string decompression
- `src/utils/checksumExtractor.ts` - Create checksums from listing objects

### Transformation & Ingestion
- `src/transformers/immoweltTransformer.ts` - JSON/HTML data → StandardProperty
- `src/adapters/ingestAdapter.ts` - POST to ingest service bulk-ingest endpoint
- `src/types/immoweltTypes.ts` - TypeScript interfaces for listing data

### Configuration
- `package.json` - Dependencies (Playwright, lz-string, BullMQ, Express)
- Env vars: `INGEST_API_URL`, `INGEST_API_KEY_IMMOWELT_AT`, `WORKER_CONCURRENCY`, `PORT`, `HEADLESS`

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
Responds 202 immediately, runs scraper asynchronously. Triggers full three-phase workflow with browser automation.

## Environmental Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| PORT | 8086 | Express server port |
| INGEST_API_URL | http://localhost:3011 | Ingest service base URL |
| INGEST_API_KEY_IMMOWELT_AT | dev_key_at_1 | Portal-specific API key |
| WORKER_CONCURRENCY | 3 | Parallel detail page fetchers |
| HEADLESS | true | Run browser in headless mode |

## Notable Quirks & Limitations

### Compressed Data Handling
- Immowelt compresses search results via lz-string
- Decompressed JSON contains full listing data
- Some fields may be encoded/abbreviated in compressed form
- Decompression happens transparently in fetcher

### Single-Page Application (SPA)
- Immowelt uses dynamic JavaScript rendering
- Must use browser automation instead of HTTP requests
- Pagination handled via URL query parameters
- All content rendered in browser context

### Field Availability
- **Always present**: price, property_type (inferred), area, rooms, transaction_type
- **Often present**: bedrooms, bathrooms, location, coordinates
- **Sometimes present**: condition, renovation_year, parking_spaces, heating_type
- **Rarely present**: energy_rating, construction_type
- **Missing**: available_from (not provided by portal)

### Checksum Strategy
- Checksums calculated from: `portalId` + `title` + `price` + `area` + `location` + `transaction_type`
- Allows 80-90% skip rate on stable markets
- Checksums stored in ingest service

### Property Type Inference
- Immowelt explicitly provides property type in listings
- Standard classification: apartment, house, land, commercial
- Defaults to 'apartment' if missing

### Category Routing
- All properties must specify `property_category` (apartment/house)
- Mapped from listing classification
- Transaction type (sale/rent) stored separately

## Troubleshooting

### "Decompression failed"
- Invalid lz-string data format. Check if Immowelt changed compression algorithm.
- Verify lz-string library version (should be ^1.5.0).
- Enable debug logs in fetchData.ts to see raw compressed data.

### "No listings found on page"
- SPA pagination may have changed. Check URL structure and page response.
- Verify network requests for listing data endpoints.
- Check browser console in screenshot for JavaScript errors.

### "Workers stuck on detail pages"
- Worker concurrency too high. Reduce `WORKER_CONCURRENCY` to 2.
- Browser memory exhausted. Check system resources and restart.
- Increase timeout if detail pages load slowly.

### "Checksum comparison failed"
- Ingest service unreachable. Verify `INGEST_API_URL` and `INGEST_API_KEY_IMMOWELT_AT`.
- Check ingest service logs.

### "Low data fidelity"
- Some fields may not be available in compressed JSON
- Check portal_metadata for raw field values
- Compare with detail page extraction for completeness

## Performance Notes

- **Phase 1 (Discovery)**: ~3-6 minutes for 35k listings (browser + SPA pagination)
- **Phase 2 (Checksum comparison)**: ~1-2 minutes (batched in 5k chunks)
- **Phase 3 (Detail fetch & ingest)**: ~5-10 minutes (browser workers)
- **Total typical run**: 10-20 minutes
- **Expected data savings**: 80-90% of page loads on repeat runs (checksums)
- **Data efficiency**: lz-string compression reduces payload size significantly

## Related Documentation
- `/docs/FIELD_MAPPING.md` - Complete portal field to TierI field mapping
- `src/transformers/immoweltTransformer.ts` - Field transformation logic
- `src/types/immoweltTypes.ts` - Data structure interfaces
- `src/utils/fetchData.ts` - Compression/decompression details
