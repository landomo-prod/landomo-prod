# Otthon Centrum (oc.hu) Scraper

## Overview
- **Portal**: Otthon Centrum (OC.hu)
- **URL**: https://oc.hu
- **Country**: Hungary
- **Categories**: Apartment, House, Land, Commercial
- **Data Source**: DataLayer (embedded analytics JavaScript)
- **Anti-bot**: CycleTLS (browser TLS fingerprinting)

## Quick Stats
- **Active Listings**: ~60,000-80,000 (estimated, #1 Hungarian portal by traffic)
- **Scrape Frequency**: Configurable via maxPages
- **Technology**: TypeScript/Express with CycleTLS + Cheerio for DataLayer parsing
- **Concurrency**: 30 workers for detail fetching (configurable)

## Data Flow
Portal → DataLayer Extraction (window.dataLayer) → Phase 1 Checksum Comparison → Phase 2 Detail Fetch → Transformation → Ingestion API

## Key Features
- **DataLayer Mining**: Extracts property data from Google Analytics ecommerce.items
- **All Listings**: Scrapes all listings regardless of region (no region-specific filtering with CycleTLS)
- **CycleTLS Protection Bypass**: Browser TLS fingerprinting for Cloudflare anti-bot
- **Queue-Based Detail Processing**: BullMQ workers handle detail page fetching
- **Deduplication**: Automatically deduplicates by ID across multiple pages

## Key Files
- `src/index.ts` - Express server and main orchestrator
- `src/scrapers/listingsScraper.ts` - DataLayer extraction from HTML
- `src/transformers/ocTransformer.ts` - Portal format to StandardProperty conversion
- `src/adapters/ingestAdapter.ts` - Ingest API communication
- `src/queue/detailQueue.ts` - BullMQ queue for detail page fetching

## Technical Details

### Discovery Method
- DataLayer-based extraction: `window.dataLayer.push()` contains ecommerce.items
- Basic listing URL: `https://oc.hu/ingatlanok/lista/ertekesites:elado`
- Pagination via query parameter: `?page={n}`
- Extracts 12 properties per page from DataLayer structure
- Deduplicates by listing ID (seenIds set)

### Limitations
- DataLayer contains only basic fields: ID, price, location, type, area
- No images, descriptions, agent info, or amenities in DataLayer
- Region-specific URLs don't work with CycleTLS (complex query structures)
- Future optimization: add detail page scraping for complete property data

### Future Enhancements
- Add detail page scraping for full property information
- Consider Playwright fallback for region-specific filtering
- Implement incremental scraping (new/updated listings only)
- Extract additional metadata from detail pages

## Configuration
```bash
# Port (default 8088)
PORT=8088

# Worker concurrency for detail fetching (default 30)
WORKER_CONCURRENCY=30

# Ingest API (shared config)
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_OC_HU=dev_key_hu_1
```

## API Endpoints
- `GET /health` - Health check with queue stats and worker info
- `POST /scrape` - Start scraping (optional: `maxPages`)
  ```json
  {
    "maxPages": 100
  }
  ```

## Known Limitations
- **DataLayer Only**: Basic data only (ID, price, location, type, area)
- **No Regional Filtering**: CycleTLS limitation; scrapes all listings globally
- **Missing Details**: No amenities, condition, heating, construction type
- **No Media**: Images and descriptions not available in current implementation
- **No Agent Info**: Seller/agent information not extracted
- **Static Field Set**: Limited by what's in ecommerce.items structure

## Performance Notes
- Estimated 30-45 minutes for full scrape (all pages)
- DataLayer extraction is fast (minimal parsing)
- HTTP requests and CycleTLS overhead dominate runtime
- Pagination-based; terminates when no next page detected
- Deduplication prevents duplicate records from multi-page crawl

## Future Optimization
To significantly enhance data completeness:
1. Scrape detail pages from discovered listing IDs
2. Extract full property information (descriptions, images, amenities)
3. Parse condition, heating type, construction materials
4. Extract agent contact information
5. Implement regional filtering via Playwright (Cloudflare bypass)

## Notes
- OC.hu is Hungary's largest real estate portal by traffic
- DataLayer approach is reliable and resistant to layout changes
- Fundamental limitation: DataLayer is analytics-focused, not data-rich
- Current implementation captures market listing volume effectively
- Detail page enhancement would require separate orchestration
