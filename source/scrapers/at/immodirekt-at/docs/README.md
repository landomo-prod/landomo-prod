# Immodirekt.at Scraper

## Overview
- **Portal**: Immodirekt Austria
- **URL**: https://www.immodirekt.at/
- **Country**: Austria
- **Categories**: Apartments (sale/rent), Houses (sale/rent)
- **Data Source**: HTML + JavaScript (SPA with dynamic content)
- **Anti-bot**: Cloudflare protection (intermediate level)
- **Architecture**: Browser-based with Cloudflare bypass, three-phase checksum-optimized, BullMQ workers

## Quick Stats
- **Active Listings**: ~15,000-25,000 (estimated)
- **Scrape Frequency**: Configurable (12-24 hour typical)
- **Technology**: TypeScript/Express, Playwright browser automation, Stealth mode
- **Scope**: Primary apartment and house sales/rentals

## Data Flow

```
Immodirekt.at Website (Cloudflare-protected)
    ↓
Playwright Browser (Stealth mode)
    ↓
Phase 1: Fetch Search Results (SPA pagination)
    ↓ navigateWithCloudflareBypass()
Extract listing cards → ID, title, price, location basics
    ↓
Phase 2: Checksum Comparison (Change Detection)
    ↓ compareChecksums() via ingest service
Categorize: new | changed | unchanged
    ↓
Phase 3: Queue Detail Page Fetches
    ↓ addDetailJobs()
BullMQ Workers (3 concurrent) → Detail page browse
    ↓
Extract from rendered HTML + meta tags
    ↓
Transform (TierI standardization)
    ↓ immodirektTransformer.ts
Ingest API
    ↓ POST /api/v1/properties/bulk-ingest
PostgreSQL (partitioned by property_category)
```

## Key Features

### Browser Automation with Stealth Mode
- Uses Playwright for browser control
- Stealth plugin removes common automation detection markers
- Cookie consent handling (multiple selector patterns)
- 60-second timeout per page (tuned for Cloudflare delays)

### Cloudflare Bypass
- Implemented via `navigateWithCloudflareBypass()` utility
- Waits for Cloudflare challenge resolution
- Retries up to 3 times with exponential backoff
- 2-3 second per-page delays to avoid rate limiting

### Checksum Optimization
- Phase 1: Discover all listings from SPA (pagination through all result pages)
- Phase 2: Compare checksums with ingest service (70-85% skip rate on stable periods)
- Phase 3: Only fetch full details for new/changed listings
- Typical savings: 70-85% browser page loads on repeat runs

### Worker Queue
- BullMQ (v5 API) processes detail fetches in parallel
- 3 concurrent workers (configurable via WORKER_CONCURRENCY)
- Queue drained before each scrape run
- Workers handle Cloudflare delays transparently

### Transaction Type Support
- **Sale**: Apartment sale, House sale (category routing)
- **Rent**: Apartment rent, House rent (category routing)

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Browser | Playwright 1.40.0 | HTML rendering & DOM extraction |
| Stealth Mode | playwright-extra + stealth plugin | Avoid detection as bot |
| HTML Parser | Cheerio (via Playwright DOM) | Extract data from rendered HTML |
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
- `src/utils/browser.ts` - Stealth browser launch, context creation, Cloudflare bypass
- `src/scrapers/listingsScraper.ts` - Pagination logic, SPA handling, consent popup detection

### Data Fetching & Extraction
- `src/utils/checksumExtractor.ts` - Create checksums from listing cards

### Transformation & Ingestion
- `src/transformers/immodirektTransformer.ts` - HTML/SPA data → StandardProperty
- `src/adapters/ingestAdapter.ts` - POST to ingest service bulk-ingest endpoint
- `src/types/immodirektTypes.ts` - TypeScript interfaces for listing data

### Configuration
- `package.json` - Dependencies (Playwright, Stealth plugin, BullMQ, Express)
- Env vars: `INGEST_API_URL`, `INGEST_API_KEY_IMMODIREKT_AT`, `WORKER_CONCURRENCY`, `PORT`, `HEADLESS`, `STEALTH_MODE`, `BYPASS_CLOUDFLARE`

## Endpoints

### Health Check
```
GET /health
```
Returns scraper status, queue stats, worker count, features (Playwright, Cloudflare bypass, checksum optimization).

### Trigger Scrape
```
POST /scrape
```
Responds 202 immediately, runs scraper asynchronously. Triggers full three-phase workflow with browser automation.

## Environmental Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| PORT | 8088 | Express server port |
| INGEST_API_URL | http://localhost:3011 | Ingest service base URL |
| INGEST_API_KEY_IMMODIREKT_AT | dev_key_at_1 | Portal-specific API key |
| WORKER_CONCURRENCY | 3 | Parallel detail page fetchers |
| HEADLESS | false | Run browser in headless mode |
| STEALTH_MODE | true (default) | Enable stealth plugin to avoid detection |
| BYPASS_CLOUDFLARE | true (default) | Use Cloudflare bypass strategy |
| TIMEOUT | 60000 | Page load timeout (ms) - increased for Cloudflare |
| MAX_RETRIES | 3 | Retry attempts for Cloudflare challenges |
| RATE_LIMIT_DELAY | 2000 | Delay between page loads (ms) - respectful of server |

## Notable Quirks & Limitations

### Single-Page Application (SPA)
- Immodirekt uses dynamic JavaScript rendering
- Must use browser automation (Playwright) instead of HTTP requests
- Pagination handled via URL query params or infinite scroll
- All content rendered in browser context

### Cloudflare Protection
- Intermediate-level protection (not Enterprise)
- Cloudflare challenge detection: wait for "Checking your browser..." to disappear
- Challenge typically resolves in 5-15 seconds
- Failed challenges trigger automatic retry (up to 3 times)
- Stealth mode helps reduce challenge frequency

### Field Availability
- **Always present**: price, property_type (inferred from title/URL), address, city
- **Often present**: bedrooms, area (sqm), transaction type (from URL/category)
- **Rarely present**: bathrooms, renovation_year, parking_spaces, condition
- **Missing**: available_from, deposit, energy_rating (not provided by portal)

### Checksum Strategy
- Checksums calculated from: `portalId` + `title` + `price` + `area` + `location` + `transaction_type`
- Allows 70-85% skip rate on stable markets
- Checksums stored in ingest service

### Property Type Inference
- Immodirekt may not always specify property_type explicitly
- Fallback logic infers from: page URL path, title keywords, listing context
- Defaults to 'apartment' if classification unclear

### Cookie & Consent Handling
- Automatically clicks consent buttons (multiple selector patterns)
- Waits 2 seconds after consent click for page stabilization
- Handles various layouts: OneTrust, custom popups

### Category Routing
- All properties must specify `property_category` (apartment/house)
- Mapped from listing classification (not always explicitly provided by portal)
- Transaction type (sale/rent) stored separately, category = property structure only

## Troubleshooting

### "Cloudflare challenge timeout"
- Challenge takes >60 seconds. Increase `TIMEOUT` env var to 90000 or higher.
- Try increasing `RATE_LIMIT_DELAY` to 3000-5000ms to avoid rate limits triggering challenges.
- Check if IP is blocked by Cloudflare (try from different network).

### "Stealth mode detection"
- Stealth plugin may not be working correctly. Verify Playwright browser is updated: `npm run install:browsers`
- Try disabling stealth mode: `STEALTH_MODE=false` (less effective against Cloudflare)
- Check user-agent: should be recent Chrome on macOS/Linux/Windows.

### "Workers stuck on detail pages"
- Worker concurrency too high. Reduce `WORKER_CONCURRENCY` to 2 or 1.
- Browser memory exhausted. Restart container or reduce worker count.
- Check for hanging promises in detail extraction (infinite wait selectors).

### "Consent popup not found / page stuck"
- Immodirekt may have changed consent popup markup. Update `consentSelectors` in `listingsScraper.ts`.
- Add logs to detect actual HTML structure: `page.screenshot()` at consent stage.
- Try increasing `waitForTimeout(5000)` for consent popup to appear.

### "No listings found"
- SPA may not be loading search results. Check if page structure changed.
- Verify network requests in browser console for data endpoints.
- Check if Cloudflare is blocking all traffic (503 Service Unavailable).

## Performance Notes

- **Phase 1 (Discovery)**: ~3-8 minutes for 20k listings (browser bottleneck, SPA pagination)
- **Phase 2 (Checksum comparison)**: ~1-2 minutes (batched in 5k chunks)
- **Phase 3 (Detail fetch & ingest)**: ~8-15 minutes (browser + parsing overhead)
- **Total typical run**: 15-30 minutes
- **Expected data savings**: 70-85% of page loads on repeat runs (checksums)
- **Browser overhead**: SPA rendering adds 2-3x latency vs API-based scrapers

## Related Documentation
- `/docs/FIELD_MAPPING.md` - Complete portal field to TierI field mapping
- `src/transformers/immodirektTransformer.ts` - Field transformation logic
- `src/types/immodirektTypes.ts` - Data structure interfaces
- `src/utils/browser.ts` - Stealth & Cloudflare implementation details
