# Wohnnet.at Scraper

## Overview
- **Portal**: Wohnnet Austria
- **URL**: https://www.wohnnet.at/
- **Country**: Austria
- **Categories**: Apartments (sale/rent), Houses (sale/rent)
- **Data Source**: HTML parsing + JSON-LD structured data
- **Anti-bot**: None (standard HTTP, no Cloudflare)
- **Architecture**: HTTP-based HTML scraping with Cheerio, JSON-LD extraction, no workers (stateless)

## Quick Stats
- **Active Listings**: ~40,000-60,000 (estimated)
- **Scrape Frequency**: Configurable (12-24 hour typical)
- **Technology**: TypeScript/Express, Axios HTTP client, Cheerio HTML parser
- **Scope**: Primary apartment and house sales/rentals
- **No Checksum Optimization**: Each run fetches full data (stateless architecture)

## Data Flow

```
Wohnnet.at Website
    ↓
Axios HTTP + Cheerio HTML Parser
    ↓
Phase 1: Fetch Listing Pages (Pagination)
    ↓ fetchListingPage() with human-like behavior
Extract from HTML: cards + JSON-LD structured data
    ↓ parseListingsPage() + JSON-LD extraction
Parse property fields from HTML + JSON metadata
    ↓
Phase 2: (Optional) Detail Page Fetch
    ↓ fetchDetailPage() if ENABLE_DETAIL_SCRAPING=true
Optional enrichment with full property data
    ↓
Transform (TierI standardization)
    ↓ wohnnetTransformer.ts
Ingest API
    ↓ POST /api/v1/properties/bulk-ingest
PostgreSQL (partitioned by property_category)
```

## Key Features

### HTML Parsing + JSON-LD
- Primary data from HTML card parsing
- Fallback to JSON-LD structured data (schema.org Property)
- Dual-source extraction improves data completeness
- JSON-LD provides standardized property metadata

### Stateless Architecture
- No worker queue or checksum optimization
- Each scrape fetches full data from scratch
- Simpler deployment (no Redis/BullMQ required)
- Best for moderate-sized catalogs

### Human-Like Rate Limiting
- Configurable requests per second (default: 2 req/s)
- Random delays between requests (100-500ms variation)
- User-Agent rotation
- Respects server load

### Optional Detail Enrichment
- Detail page scraping optional (ENABLE_DETAIL_SCRAPING)
- Enriches with full property information
- Adds ~2-3x time to scrape if enabled
- Disabled by default for efficiency

### Pagination
- Configurable max pages (default: 1500, ~45k listings)
- Automatic pagination detection
- Graceful end-of-results detection

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| HTTP Client | Axios 1.6.0 | Page fetching with header rotation |
| HTML Parser | Cheerio 1.0.0-rc.12 | DOM manipulation & CSS selectors |
| Framework | Express 4.18.2 | Health check & /scrape endpoint |
| Type System | TypeScript 5.0 | Type safety for data structures |
| Transformation | Native TS | StandardProperty mapping |

## Key Files

### Core Scraper Logic
- `src/index.ts` - Express server, main orchestration, metrics
- `src/scrapers/listingsScraper.ts` - Pagination loop, optional detail enrichment

### Data Fetching & Parsing
- `src/utils/fetchData.ts` - Axios requests, human-like rate limiting, header rotation
- `src/utils/htmlParser.ts` - HTML parsing via Cheerio, JSON-LD extraction

### Transformation & Ingestion
- `src/transformers/wohnnetTransformer.ts` - HTML/JSON-LD data → StandardProperty
- `src/adapters/ingestAdapter.ts` - POST to ingest service bulk-ingest endpoint
- `src/types/wohnnetTypes.ts` - TypeScript interfaces for listing data

### Configuration
- `package.json` - Dependencies (Axios, Cheerio, Express, BullMQ for queue)
- Env vars: `INGEST_API_URL`, `INGEST_API_KEY_WOHNNET_AT`, `PORT`, `MAX_PAGES`, `REQUESTS_PER_SECOND`, `ENABLE_DETAIL_SCRAPING`

## Endpoints

### Health Check
```
GET /health
```
Returns scraper status, portal info.

### Trigger Scrape
```
POST /scrape
```
Responds 202 immediately, runs scraper asynchronously. Triggers full scrape with optional detail enrichment.

## Environmental Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| PORT | 8091 | Express server port |
| INGEST_API_URL | http://localhost:3011 | Ingest service base URL |
| INGEST_API_KEY_WOHNNET_AT | dev_key_at_1 | Portal-specific API key |
| MAX_PAGES | 1500 | Maximum pages to scrape (~30-45k listings) |
| REQUESTS_PER_SECOND | 2 | Rate limiting: requests per second |
| ENABLE_DETAIL_SCRAPING | false | Optional detail page enrichment (slow) |
| START_PAGE | 1 | Starting page for scrape (useful for recovery) |

## Notable Quirks & Limitations

### HTML-Based Scraping
- No API available - must parse HTML
- Prone to breakage if HTML structure changes
- Requires maintenance when portal redesigns
- CSS selectors must be kept up-to-date

### JSON-LD Structured Data
- Wohnnet includes schema.org Property JSON-LD in HTML
- Fallback data source when HTML parsing incomplete
- More stable than HTML selectors (standardized format)
- Both HTML and JSON-LD parsed for completeness

### Field Availability (HTML Parsing)
- **Always present**: Title, price, URL, location basics
- **Often present**: Area (sqm), rooms, property type
- **Sometimes present**: Bedrooms, coordinates
- **Rarely present**: Parking spaces, renovation year, condition
- **Missing**: bathrooms (not extracted), energy_rating, construction_type

### Field Availability (JSON-LD Fallback)
- Provides: floorSize, numberOfRooms, address, location
- Better coverage than HTML for structured fields
- Property.offers includes priceRange info
- Geo object includes coordinates

### Stateless Architecture
- No checksum optimization (unlike other scrapers)
- Advantage: simpler deployment, no Redis dependency
- Disadvantage: slower repeat runs, duplicative API calls
- Best for moderate-volume portals (40k-60k listings)

### Rate Limiting
- Configurable requests per second (default: 2)
- Random per-request delays (100-500ms variance)
- respects server load gracefully
- No aggressive blocking observed from Wohnnet

### Property Type Inference
- Property type inferred from title and URL context
- Transaction type (sale/rent) inferred similarly
- May fallback to 'apartment' if classification unclear

### Category Routing
- All properties must specify `property_category` (apartment/house)
- Mapped from inferred property type
- Transaction type stored separately

### Detail Page Enrichment
- Optional enrichment available (ENABLE_DETAIL_SCRAPING)
- Adds full HTML parsing + JSON-LD extraction per listing
- Significantly increases scrape time (2-3x multiplier)
- Disabled by default for efficiency

## Troubleshooting

### "No listings found"
- HTML structure may have changed. Check CSS selectors in htmlParser.ts.
- Wohnnet may have updated DOM classes/IDs.
- Test manually: inspect element on Wohnnet to verify selector.

### "Pagination not advancing"
- Pagination detection may need adjustment.
- Check `extractPaginationMeta()` logic in htmlParser.ts.
- Verify "next page" link/button structure hasn't changed.

### "Rate limiting causing timeouts"
- Increase `REQUESTS_PER_SECOND` (but be respectful)
- Check server response times (may be slow)
- Reduce concurrency if multiple scrapers running

### "Low data completeness"
- Enable detail scraping: `ENABLE_DETAIL_SCRAPING=true`
- Detail pages add more complete information
- Trade-off: 2-3x longer scrape time
- Or improve HTML parser selectors in htmlParser.ts

### "JSON-LD parsing failing"
- JSON-LD structure in HTML may have changed
- Check for `<script type="application/ld+json">` tags
- Verify JSON format is valid (try JSON.parse())

### "Property type inference incorrect"
- Improve title/URL-based inference in wohnnetTransformer.ts
- Add logic for German property type keywords
- Consider fetching detail page for classification

## Performance Notes

- **Total scrape**: ~10-20 minutes for 40k-60k listings
  - 1500 pages × 30 listings = 45k listings
  - 2 req/s = ~12.5 minutes just for page fetches
  - Plus HTML parsing & ingest time

- **With detail enrichment**: ~30-50 minutes (if ENABLE_DETAIL_SCRAPING=true)
  - Adds per-listing detail page fetch
  - 2-3x multiplier on total time
  - Only recommend if data completeness critical

- **Network-bound**: Not compute-bound
  - Rate limiting is primary bottleneck
  - Server response times matter
  - Random delays help avoid detection

- **Memory usage**: Low (stateless, no queue)
  - Single-threaded operation
  - No worker pool memory overhead
  - Suitable for modest infrastructure

## Related Documentation
- `/docs/FIELD_MAPPING.md` - Complete portal field to TierI field mapping
- `src/transformers/wohnnetTransformer.ts` - Field transformation logic
- `src/types/wohnnetTypes.ts` - Data structure interfaces
- `src/utils/htmlParser.ts` - HTML parsing selectors & JSON-LD extraction
