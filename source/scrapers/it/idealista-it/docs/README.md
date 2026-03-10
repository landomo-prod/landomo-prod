# Idealista.it Scraper

## Overview
- **Portal**: Idealista.it
- **URL**: https://www.idealista.it
- **Country**: Italy
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: HTML (Cheerio parsing)
- **Anti-bot**: User-Agent rotation, random delays, backoff on 403/429

## Quick Stats
- **Active Listings**: ~200,000+ (estimated across major cities)
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with BullMQ queuing
- **Default Port**: 8110
- **Cities Covered**: Milano, Roma, Torino, Napoli, Firenze, Bologna

## Data Flow
1. **Search Discovery** - Scrapes HTML listing pages for 6 major cities × 5 property types × 2 operations (sale/rent)
2. **Three-Phase Scrape**:
   - Phase 1: Crawl all search results to extract summary data (IDs, basic info)
   - Phase 2: Compare checksums to identify new/changed listings (40-70% skip on stable periods)
   - Phase 3: Queue detail page fetches for changed listings only
3. **Detail Extraction** - Workers (default 3 concurrent) fetch detail pages and parse additional attributes
4. **Transformation** - Raw HTML data mapped to category-specific TierI types
5. **Ingestion** - Batch POST to ingest API with transformed data

## Key Files
- `src/index.ts` - Express server, health endpoint, scrape orchestration
- `src/scrapers/listingsScraper.ts` - Search config builder, HTML parsing, pagination
- `src/scrapers/detailScraper.ts` - Detail page parsing for enhanced attributes
- `src/transformers/` - Category transformers (apartments/, houses/, land/, commercial/)
- `src/adapters/ingestAdapter.ts` - Bulk ingest API client
- `src/queue/detailQueue.ts` - BullMQ worker pool for detail fetches
- `src/scraper/threePhaseOrchestrator.ts` - Phase 1/2/3 orchestration
- `src/types/idealistaTypes.ts` - TypeScript interfaces for raw data
- `src/utils/userAgents.ts` - User-Agent pool for rotation

## Architecture Highlights

### City-Based Concurrency
- 6 major cities: Milano, Roma, Torino, Napoli, Firenze, Bologna
- 5 property types per city: apartments, houses, land, commercial (all + sale/rent variants)
- Default concurrency: 2 cities at a time (adjustable via `CITY_CONCURRENCY`)

### Incremental Pagination
- Per-city results paginated up to 60 pages (configured as MAX_PAGES)
- Page URL: `/vendita-case/{city}/` (page 1), then `pagina-{N}.htm`
- Terminates early if:
  - Page returns 0 listings
  - No "next" pagination link detected
  - 60 pages reached

### Streaming with Checksum
- Phase 2 compares checksums; only changed listings queued for detail fetch
- Can skip 70%+ of detail fetches on stable periods
- Detail fetches are CPU-bound (Cheerio parsing); low concurrency (default 3) to prevent overload

### Feature Detection
- Elevator, parking, garden, terrace, pool detected from text snippets in HTML
- Italian keywords: "ascensore", "parcheggio", "giardino", "terrazza", "piscina"

### Worker Concurrency
Default: 3 concurrent detail workers (lower than other portals due to CPU cost of parsing)
- Each worker processes one detail page at a time
- Queue size auto-adjusts; workers poll every 2 seconds

## Search Configuration

Search dimensions are automatically generated:
```
For each city in [milano, roma, torino, napoli, firenze, bologna]:
  - apartments (sale)
  - apartments (rent)
  - houses (sale)
  - land (sale)
  - commercial (sale)
```

This creates 30 separate search configurations (6 cities × 5 combos).

## Transformer Details

### Apartment
- Required fields: `bedrooms` (rooms - 1, minimum 0), `sqm`, `has_elevator`, `has_parking`
- Optional: bathrooms, floor, total_floors, condition, energy_class, furnished, year_built
- Italian-specific: Energy class, heating type, property condition mappings

### House
- Required: bedrooms, sqm_living, has_garden, has_parking
- Optional: year_built, garage info

### Land
- Required: area_plot_sqm

### Commercial
- Required: sqm_total, has_parking
- Optional: bathrooms present info

## Environment Variables
```
PORT=8110                           # Server port (default 8110)
INSTANCE_COUNTRY=it                 # Country code for ingest API
INGEST_API_URL=http://localhost:4000 # Ingest API endpoint
INGEST_API_KEY_IDEALISTA_IT=        # Auth token (prioritized)
INGEST_API_KEY=                     # Fallback auth token
WORKER_CONCURRENCY=3                # Detail fetch workers (recommend 2-5)
CITY_CONCURRENCY=2                  # Cities scraped in parallel (recommend 1-3)
PAGE_DELAY_MS=400                   # Delay between pages (default 400ms + random 200ms)
```

## Common Issues

### 403/429 Rate Limiting
- **Symptom**: Many pages return 403 Forbidden or 429 Too Many Requests
- **Fix**: Increase `PAGE_DELAY_MS` to 800+, reduce `CITY_CONCURRENCY` to 1, or reduce WORKER_CONCURRENCY
- **Note**: Idealista has aggressive anti-bot measures; delays below 300ms often trigger blocks

### Missing Detail Pages
- **Symptom**: Some detail URLs return 404
- **Cause**: Property may have been removed or sold between discovery and detail fetch
- **Fix**: No action needed; 404s are skipped gracefully

### Feature Detection Inaccuracy
- **Symptom**: Elevator/parking fields incorrect
- **Cause**: Feature text may be in different format or missing from HTML
- **Debug**: Check raw `features[]` array in parsed listing

### Italian Text Encoding
- **Symptom**: Special characters (è, à, ò) appear garbled
- **Cause**: Axios response encoding not handling UTF-8
- **Fix**: Ensured in default axios config; report if persists

## Testing
```bash
# Build
npm run build

# Run locally
PORT=8110 INGEST_API_URL=http://localhost:4000 npm start

# Trigger scrape
curl -X POST http://localhost:8110/scrape

# Check health
curl http://localhost:8110/health

# Debug single city
curl "http://localhost:8110/scrape?debug=milano"
```

## Performance Notes
- Typical full scrape: 15-25 minutes (200k listings across 6 cities)
- Memory: ~1.5GB (typical)
- Worker concurrency low (3) due to CPU cost of Cheerio parsing
- Bottleneck: Detail page parsing (HTML extraction of attributes)
- Checksum mode saves ~60-70% detail fetches on incremental runs

## Data Quality Notes

### Coverage
- Only 6 major cities (Milano, Roma, Torino, Napoli, Firenze, Bologna)
- Smaller regions/cities not scraped
- Regional classification via city name only (no postal code extraction)

### Field Completeness
- Prices: Very reliable (always displayed)
- Area: Reliable for apartments/houses; may be missing for commercial
- Rooms/bedrooms: Reliable from search pages
- Bathrooms: Only available from detail pages; may be null
- Features: Extracted from both search and detail pages; Italian keywords

### Image Handling
- Thumbnails from search pages (usually 1-3 per listing)
- Additional images from detail pages
- Deduplicated by URL before storing
- Main image selected as first unique URL

## Monitoring
The scraper exposes Prometheus metrics via `/metrics` endpoint:
- `scrape_runs{portal,status}` - Run count (success/failure)
- `scrapeDuration{portal,category}` - Duration histogram
- `propertiesScraped{portal,category,result}` - Property counter
- `scrapeRunActive{portal}` - Boolean gauge (1=running, 0=idle)

## Notes
- Listings linked to city, not province; use city name for regional filtering
- Agency information (if present) extracted from detail pages
- Condition mappings: nuovo/new, ottimo/excellent, buono/good, ristrutturato/after_renovation, da ristrutturare/requires_renovation
- Furnished mappings: arredato/furnished, parziale/partially_furnished, non arredato/not_furnished
- Terminal protection: Old listings marked `removed` before reactivation; sold/rented never overwritten
