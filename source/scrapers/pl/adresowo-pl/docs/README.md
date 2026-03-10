# Adresowo Scraper

## Overview
- **Portal**: Adresowo.pl
- **URL**: https://www.adresowo.pl
- **Country**: Poland
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: HTML (Cheerio parsing)
- **Anti-bot**: Realistic user agents, rate limiting, random delays

## Quick Stats
- **Active Listings**: ~100,000+ (estimated)
- **Scrape Frequency**: Configurable via scheduler
- **Technology**: TypeScript/Express with BullMQ queuing
- **Default Port**: 8201
- **Property Categories**: Mieszkania (apartments), domy (houses), dzialki (land), nieruchomosci-komercyjne (commercial)

## Data Flow
1. **Category & Transaction Discovery** - Builds configs for all property types and transaction types (sale/rent)
2. **Three-Phase Scrape**:
   - Phase 1: Crawl all search result pages for each category combo
   - Phase 2: Compare checksums to identify new/changed listings (50-80% skip on stable periods)
   - Phase 3: Queue detail page fetches for changed listings only
3. **Detail Extraction** - Workers (default 50 concurrent) fetch detail pages via Cheerio parsing
4. **Transformation** - Raw listing + detail data mapped to category-specific TierI types
5. **Ingestion** - Batch POST to ingest API with transformed data

## Key Files
- `src/index.ts` - Express server, health endpoint, scrape orchestration
- `src/scrapers/listingsScraper.ts` - Category/transaction configs, search page parsing, pagination
- `src/scrapers/detailScraper.ts` - Detail page parsing (full attributes, features, images)
- `src/transformers/adresowoTransformer.ts` - Multi-category transformer (apartment/house/land/commercial)
- `src/adapters/ingestAdapter.ts` - Bulk ingest API client
- `src/queue/detailQueue.ts` - BullMQ worker pool for detail fetches
- `src/scraper/threePhaseOrchestrator.ts` - Phase 1/2/3 orchestration
- `src/utils/headers.ts` - Realistic user agent and header rotation
- `src/utils/rateLimiter.ts` - Rate limiting with configurable throttling

## Architecture Highlights

### Category Configuration
Adresowo.pl exposes 4 main categories with both sale and rental variants:

| Category | URL Slug | Property Category | Variants |
|---|---|---|---|
| Mieszkania | mieszkania | apartment | sale (mieszkania), rent (mieszkania-wynajem) |
| Domy | domy | house | sale (domy), rent (domy-wynajem) |
| Dzialki | dzialki | land | sale only (dzialki) |
| Nieruchomosci-komercyjne | nieruchomosci-komercyjne | commercial | sale (nieruchomosci-komercyjne), rent (nieruchomosci-komercyjne-wynajem) |

This creates 8 search configurations that are scraped independently.

### Search Page Pagination
- Base URL: `https://www.adresowo.pl/{transaction-slug}/`
- Page 1: Base URL only
- Page N>1: `{transaction-slug}/_l{N}/`
- Pagination detects via next-page link (`a[href*="/_l"]`)
- Default max pages: 3000 (effectively unlimited on stable sites)

### Portal ID Extraction
- Portal IDs extracted from listing URL slugs (e.g., `/o/mieszkanie-warszawa-zoliborz-ul-xyz-3-pokojowe-l1a2u2`)
- ID is the last segment after final dash: `l1a2u2`
- Deduplicated per transaction type via `seenIds` Set

### Checksum-Based Deduplication
- Phase 2 compares checksums from Phase 1 against DB
- Only new/changed listings queued for detail fetch
- On stable periods, can skip 70-80% of detail fetches
- Re-runs benefit significantly from this optimization

### Worker Concurrency
Default: 50 concurrent detail workers (high concurrency safe due to low CPU cost)
- Each worker processes one detail page at a time
- Queue auto-adjusts; workers poll every 2 seconds
- Adjustable via `WORKER_CONCURRENCY` env var

### Graceful Shutdown
Both SIGTERM and SIGINT drain the queue before exit, preventing data loss.

## Search Configuration Auto-Generation

```
For each category [mieszkania, domy, dzialki, nieruchomosci-komercyjne]:
  For each transaction in category.transactions:
    Generate config { categorySlug, transactionSlug, transactionType, propertyCategory }
```

Produces 8 total configurations automatically.

## Transformer Details

### Apartment
- Required fields: `bedrooms` (derived from rooms), `sqm`, `has_elevator`, `has_balcony`, `has_parking`, `has_basement`
- Optional: bathrooms, floor, total_floors, condition, heating_type, furnished, year_built, construction_type
- Polish-specific: Parsed from detail feature dictionary

### House
- Required: bedrooms, sqm_living, sqm_plot, has_garden, has_garage, has_parking, has_basement
- Optional: year_built, construction type

### Land
- Required: area_plot_sqm

### Commercial
- Required: sqm_total, has_elevator, has_parking, has_bathrooms
- Optional: heating_type, features

## Field Extraction from Polish Text

Common Polish attribute keys in detail scraper:
- "stan" / "stan wykończenia" → condition mapping
- "ogrzewanie" → heating_type
- "materiał" / "technologia" / "budynek" → construction_type (panel/brick/concrete/mixed)
- "łazienki" / "liczba łazienek" → bathrooms
- "pięro" / "piętro" → floor
- Boolean fields: "tak" (yes), "1" (true), etc.

## Environment Variables
```
PORT=8201                           # Server port
INSTANCE_COUNTRY=pl                 # Country code for ingest API
INGEST_API_URL=http://localhost:3000 # Ingest API endpoint
INGEST_API_KEY=dev_key_pl_1         # Auth token
WORKER_CONCURRENCY=50               # Detail fetch workers
PAGE_DELAY_MS=200-800               # Random delay per page (built-in range)
```

## Common Issues

### Pagination Never Stops
- **Symptom**: Scraper continues beyond reasonable page count
- **Cause**: Adresowo may cycle results or show duplicates at end
- **Fix**: Implemented deduplication via `seenIds` Set to detect when all new listings exhausted
- **Note**: Once `newListings.length === 0`, pagination stops automatically

### Missing Detail Pages
- **Symptom**: Some detail URLs return 404
- **Cause**: Property may have been sold/removed between discovery and detail fetch
- **Fix**: No action needed; 404s are skipped gracefully

### Polish Character Encoding
- **Symptom**: Special characters (ł, ó, ę, ą, ś, ź, ż) appear garbled
- **Cause**: Axios response not handling UTF-8 correctly
- **Fix**: Ensured in headers; Cheerio auto-detects UTF-8

### Rate Limiting Issues
- **Symptom**: 403/429 responses
- **Fix**: Built-in rate limiter throttles requests automatically
- **Adjust**: Increase `PAGE_DELAY_MS` above 800 for more conservative rate

## Testing
```bash
# Build
npm run build

# Run locally
PORT=8201 INGEST_API_URL=http://localhost:3000 npm start

# Trigger scrape
curl -X POST http://localhost:8201/scrape

# Check health
curl http://localhost:8201/health
```

## Performance Notes
- Typical full scrape: 30-45 minutes (100k+ listings)
- Memory: ~1.5GB (configurable via `--max-old-space-size=2048`)
- Worker concurrency high (50) due to low CPU cost of detail parsing
- Bottleneck: Network I/O (detail page fetches)
- Checksum mode saves ~60-80% API calls on incremental runs

## Data Quality Notes

### Portal ID Reliability
- Extracted from URL slug; always present if listing parsed
- Format: alphanumeric string (e.g., "l1a2u2", "a123b456")
- Collision-free within Adresowo

### Feature Completeness
- Price: Always from search page
- Area: Always from search page or detail
- Rooms: Parsed from text (e.g., "3 pok." or "3-pokojowe")
- Floor: Parsed from text (e.g., "piętro 3", "3/5 piętro")
- Bathrooms: Only in detail page features dictionary
- Condition: Mapped from Polish descriptors ("nowe", "bardzo dobry", "do remontu", etc.)
- Features: Both search page and detail page features combined

### Location Mapping
- City extracted from detail page (if available); fallback to search slug
- District extracted from detail page only
- Address reconstructed from detail data

## Monitoring
The scraper exposes Prometheus metrics via `/metrics` endpoint:
- `scrape_runs{portal,status}` - Run count (success/failure)
- `scrapeDuration{portal,category}` - Duration histogram
- `propertiesScraped{portal,category,result}` - Property counter
- `scrapeRunActive{portal}` - Boolean gauge (1=running, 0=idle)

## Notes
- Listings are never deleted; old listings marked `removed` then reactivated if re-listed
- Terminal statuses (sold/rented) are protected from overwrite
- Detail page URLs constructed from portal ID; fallback URL patterns supported
- Both sale and rental variants tracked separately (different checksum contexts)
- Feature deduplication: both search and detail features merged into single array
