# Nieruchomosci-Online Scraper

## Overview
- **Portal**: Nieruchomosci-Online.pl
- **URL**: https://www.nieruchomosci-online.pl
- **Country**: Poland
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: HTML (Cheerio parsing) with embedded JSON tiles
- **Anti-bot**: Realistic user agents, rate limiting, random delays

## Quick Stats
- **Active Listings**: ~150,000+ (estimated)
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with BullMQ queuing
- **Default Port**: 8202
- **Property Categories**: Mieszkanie (apartment), dom (house), dzialka (land), lokal (commercial)

## Data Flow
1. **Category & Transaction Discovery** - Builds configs for 4 property types × transaction variants
2. **Three-Phase Scrape**:
   - Phase 1: Crawl all search result pages for each category combo
   - Phase 2: Compare checksums to identify new/changed listings (50-80% skip on stable periods)
   - Phase 3: Queue detail page fetches for changed listings only
3. **Detail Extraction** - Workers (default 50 concurrent) fetch detail pages via Cheerio parsing
4. **Transformation** - Raw listing + detail data mapped to category-specific TierI types
5. **Ingestion** - Batch POST to ingest API with transformed data

## Key Files
- `src/index.ts` - Express server, health endpoint, scrape orchestration
- `src/scrapers/listingsScraper.ts` - Category configs, search page parsing, embedded JSON extraction
- `src/scrapers/detailScraper.ts` - Detail page parsing for enhanced attributes
- `src/transformers/nieruchomosciTransformer.ts` - Multi-category transformer (apartment/house/land/commercial)
- `src/adapters/ingestAdapter.ts` - Bulk ingest API client
- `src/queue/detailQueue.ts` - BullMQ worker pool for detail fetches
- `src/scraper/threePhaseOrchestrator.ts` - Phase 1/2/3 orchestration
- `src/utils/headers.ts` - Realistic user agent and header rotation
- `src/utils/rateLimiter.ts` - Rate limiting with configurable throttling

## Architecture Highlights

### Category Configuration
Nieruchomosci-Online.pl exposes 4 main categories with both sale and rental variants:

| Category | URL Slug | Property Category | Variants |
|---|---|---|---|
| Mieszkanie | mieszkanie | apartment | sale (sprzedaz), rent (wynajem) |
| Dom | dom | house | sale (sprzedaz), rent (wynajem) |
| Dzialka | dzialka | land | sale only (sprzedaz) |
| Lokal-uztkowy | lokal-uzytkowy | commercial | sale (sprzedaz), rent (wynajem) |

This creates 7 search configurations (6 with both variants, 1 sale-only for land).

### Search Page Structure
- Base URL pattern: `https://www.nieruchomosci-online.pl/szukaj.html?3,{category},{transaction}`
- Pagination: `&p={page}` query parameter (page 1 is no suffix)
- Each page returns ~47 listings (site-dependent)

### Embedded JSON Tile Data
**Primary Strategy**: Nieruchomosci-Online.pl renders listings via JavaScript, with tile data embedded in scripts:
- Look for `tile_props` variable in script tags
- Extract balanced JSON object containing all tile data
- Parse tile data directly from JSON (highly reliable)

**Fallback Strategy**: If JSON extraction fails, parse detail links from HTML:
- Extract `<a>` tags with `href` containing city subdomain
- Build detail URLs from domains like `kraków.nieruchomosci-online.pl/{id}.html`

### Data Extraction from Tile Props
Tile data structure (from embedded JSON):
```
{
  "a26088950": { "prc": 250000, "rsur": 45, "rooms": 2, "rloccta": "warszawa" },
  "i41579_25465008": { "prc": 3500, "rsur": 32, "rooms": 1, "rloccta": "krakow" }
}
```

Key fields in tile data:
- `prc` - Price (PLN)
- `rsur` - Area (sqm)
- `rooms` - Number of rooms
- `rloccta` - City subdomain name

### Portal ID Extraction
- Raw ID from tile data key: "a26088950" or "i41579_25465008"
- Normalized: Remove leading letter (a/i) and underscore suffix
- Result: Numeric ID used for detail URL construction

### Worker Concurrency
Default: 50 concurrent detail workers (high concurrency safe due to low CPU cost)
- Each worker processes one detail page at a time
- Queue auto-adjusts; workers poll every 2 seconds
- Adjustable via `WORKER_CONCURRENCY` env var

### Graceful Shutdown
Both SIGTERM and SIGINT drain the queue before exit, preventing data loss.

### Category Selection
The `/scrape` endpoint supports optional category filtering:
```bash
# Scrape all categories
curl -X POST http://localhost:8202/scrape

# Scrape critical categories only (apartments + houses)
curl -X POST "http://localhost:8202/scrape?categories=critical"

# Scrape standard categories only (land + commercial)
curl -X POST "http://localhost:8202/scrape?categories=standard"

# Scrape specific categories
curl -X POST "http://localhost:8202/scrape?categories=mieszkanie,dom"
```

## Transformer Details

### Apartment
- Required fields: `bedrooms` (derived from rooms), `sqm`, `has_elevator`, `has_parking`
- Optional: bathrooms, floor, total_floors, condition, heating_type, furnished, construction_type
- Polish-specific: Parsed from detail feature dictionary

### House
- Required: bedrooms, sqm_living, sqm_plot, has_garden, has_parking
- Optional: year_built, garage info, basement

### Land
- Required: area_plot_sqm

### Commercial
- Required: sqm_total, has_parking
- Optional: bathrooms, heating_type

## Field Extraction from Polish Text

Common Polish attribute keys in detail scraper:
- "stan" / "stan nieruchomości" → condition mapping
- "ogrzewanie" → heating_type
- "materiał" / "technologia" / "rodzaj budynku" → construction_type
- "łazienki" / "liczba łazienek" → bathrooms
- "piętro" → floor
- Boolean fields: "tak" (yes), "1" (true), etc.

## Environment Variables
```
PORT=8202                           # Server port
INSTANCE_COUNTRY=pl                 # Country code for ingest API
INGEST_API_URL=http://localhost:3000 # Ingest API endpoint
INGEST_API_KEY=dev_key_pl_1         # Auth token
WORKER_CONCURRENCY=50               # Detail fetch workers
PAGE_DELAY_MS=300-700               # Random delay per page (built-in range)
```

## Common Issues

### JavaScript Rendering Issues
- **Symptom**: Tile data missing from response
- **Cause**: JavaScript may not have executed by the time HTML is sent
- **Fix**: Fallback to HTML parsing mode (extracts detail links)
- **Note**: Both strategies implemented; automatic fallback

### Pagination Never Stops
- **Symptom**: Scraper continues beyond reasonable page count
- **Cause**: Nieruchomosci-Online may show duplicates or empty pages
- **Fix**: Deduplication via `seenIds` Set stops pagination when no new listings found

### Missing Detail Pages
- **Symptom**: Some detail URLs return 404
- **Cause**: Property may have been sold/removed between discovery and detail fetch
- **Fix**: No action needed; 404s are skipped gracefully

### Polish Character Encoding
- **Symptom**: Special characters (ł, ó, ę, ą, ś, ź, ż) appear garbled
- **Cause**: Axios response not handling UTF-8
- **Fix**: Headers and Cheerio auto-detect UTF-8

### Rate Limiting Issues
- **Symptom**: 403/429 responses
- **Fix**: Built-in rate limiter throttles requests automatically
- **Adjust**: Increase `PAGE_DELAY_MS` above 800 for more conservative rate

## Testing
```bash
# Build
npm run build

# Run locally
PORT=8202 INGEST_API_URL=http://localhost:3000 npm start

# Trigger scrape (all categories)
curl -X POST http://localhost:8202/scrape

# Trigger critical categories (apartments + houses)
curl -X POST "http://localhost:8202/scrape?categories=critical"

# Check health
curl http://localhost:8202/health
```

## Performance Notes
- Typical full scrape: 25-40 minutes (150k+ listings across all categories)
- Memory: ~1.5GB (configurable via `--max-old-space-size=2048`)
- Worker concurrency high (50) due to low CPU cost of detail parsing
- Bottleneck: Network I/O (detail page fetches)
- Checksum mode saves ~60-80% API calls on incremental runs

## Data Quality Notes

### Tile Data Reliability
- Price: Always present in tile data if available on listing
- Area: Always present in tile data
- Rooms: Usually present; may be null for commercial
- City: Extracted from city subdomain; reliable

### Feature Completeness
- Price: From tile data (most reliable source)
- Area: From tile data
- Rooms: From tile data
- Floor: Only in detail page features
- Bathrooms: Only in detail page features
- Condition: Mapped from Polish descriptors
- Features: Both search (tile) and detail page features combined

### Location Mapping
- City extracted from tile data city subdomain (very reliable)
- District extracted from detail page only
- Full address from detail page

## Monitoring
The scraper exposes Prometheus metrics via `/metrics` endpoint:
- `scrape_runs{portal,status}` - Run count (success/failure)
- `scrapeDuration{portal,category}` - Duration histogram
- `propertiesScraped{portal,category,result}` - Property counter
- `scrapeRunActive{portal}` - Boolean gauge (1=running, 0=idle)

## Tile Data Format

The embedded JSON contains this structure:
```javascript
tile_props: {
  "a{id}": { prc, rsur, rooms, rloccta, ... },
  "i{id1}_{id2}": { prc, rsur, rooms, rloccta, ... }
}
```

Standard fields:
- `prc` - Price (PLN)
- `rsur` - Area (sqm)
- `rooms` - Room count
- `rloccta` - City subdomain (lowercase, dashes for spaces: "warszawa", "krakow", "wroclaw")

Optional fields vary; many properties include additional attributes.

## Notes
- Listings are never deleted; old listings marked `removed` then reactivated if re-listed
- Terminal statuses (sold/rented) are protected from overwrite
- Both sale and rental variants tracked separately (different checksum contexts)
- Category filtering allows faster scrapes for critical properties (apartments/houses)
- Detail page URLs constructed from city subdomain: `https://{city}.nieruchomosci-online.pl/{id}.html`
- Fallback URL: `https://www.nieruchomosci-online.pl/{id}.html` if city extraction fails
- Feature deduplication: both tile and detail features merged into single array
