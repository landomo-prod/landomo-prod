# Immonet.de Scraper

## Overview
- Portal: immonet.de (redirects to immowelt.de after AVIV Group merger)
- Country: Germany (de)
- Port: 8088
- Categories: apartment, house, land, commercial (sale + rent), plus offices, warehouses, parking
- Method: Three-phase checksum with Playwright UFRN extraction
- Status: Active

## Architecture

### Three-Phase Flow

**Phase 1 - Discovery (Playwright + UFRN):** Launches Chromium via Playwright and navigates to immowelt.de search pages (immonet.de redirects here after the AVIV Group merger). Extracts listing data from the `__UFRN_FETCHER__` JavaScript object embedded in the page, which contains pre-parsed classified data. Supports both LZ-string compressed format and newer JSON.parse unicode-escaped format. Falls back to DOM scraping if UFRN data is unavailable. Paginates through all pages for 13 search categories.

**Phase 2 - Checksum Comparison:** Creates checksums from listing ID + price + title + bedrooms + bathrooms + sqm. Compares against the ingest API in batches of 5000. Only `new` and `changed` listings proceed to Phase 3.

**Phase 3 - Detail Fetch (BullMQ):** Queues new/changed listings as BullMQ jobs. Workers use a shared Playwright browser instance to fetch individual listing detail pages. Extracts data from `__NEXT_DATA__` or falls back to HTML DOM extraction. Transformed data is batched (50 per batch) and sent to the ingest API. Rate-limited at 3 jobs per 5 seconds with 2s+ jitter delays.

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape trigger, queue polling |
| `src/scraper/threePhaseOrchestrator.ts` | Orchestrates phases 1-3, checksum comparison |
| `src/scrapers/listingsScraper.ts` | Playwright-based scraper with UFRN extraction, DOM fallback, pagination |
| `src/utils/checksumExtractor.ts` | Generates checksums from listing fields |
| `src/utils/browser.ts` | Stealth context, network idle, scroll, header rotation utilities |
| `src/utils/userAgents.ts` | Random user agent rotation |
| `src/queue/detailQueue.ts` | BullMQ queue/worker for detail fetches, shared browser, batched ingestion |
| `src/transformers/immonetTransformer.ts` | Maps ImmonetListing to StandardProperty + GermanSpecificFields |
| `src/types/immonetTypes.ts` | TypeScript interfaces for Immonet/Immowelt data |
| `src/adapters/ingestAdapter.ts` | HTTP client for bulk-ingest API |

## Data Flow

```
Immowelt.de Search Pages ──→ Playwright ──→ UFRN Extraction ──→ Listing IDs + Data
                                              (or DOM fallback)
                                                    │
                                           Checksum Compare
                                                    │
                                              BullMQ Queue
                                                    │
                              Playwright Detail Fetch ◄──┘
                                        │
                              __NEXT_DATA__ / DOM
                                        │
                           immonetTransformer ──→ IngestAdapter ──→ Ingest API
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8088 | HTTP server port |
| INGEST_API_URL | http://localhost:3010 | Ingest service URL |
| INGEST_API_KEY | (empty) | Ingest API auth key |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis auth password |
| WORKER_CONCURRENCY | 3 | BullMQ worker concurrency |
| HEADLESS | true | Run Playwright in headless mode |
| TIMEOUT | 30000 | Page navigation timeout (ms) |
| MAX_RETRIES | 3 | Max retries per page |
| RATE_LIMIT_DELAY | 1000 | Base delay between requests (ms) |
| DETAIL_RATE_LIMIT_MS | 2000 | Delay between detail fetches (ms) |
| BATCH_SIZE | 50 | Ingestion batch size |
| MAX_PAGES_PER_CATEGORY | 999999 | Max pages to paginate per category |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats and feature list |
| /scrape | POST | Trigger scrape run (returns 202 immediately) |
| /queue/stats | GET | BullMQ queue statistics |
| /metrics | GET | Prometheus metrics |

## Category Mapping

| Search Category | URL Path | property_category |
|-----------------|----------|-------------------|
| Apartments for Sale | /suche/wohnungen/kaufen | apartment |
| Apartments for Rent | /suche/wohnungen/mieten | apartment |
| Houses for Sale | /suche/haeuser/kaufen | house |
| Houses for Rent | /suche/haeuser/mieten | house |
| Land/Plots for Sale | /suche/grundstuecke/kaufen | land |
| Commercial for Sale | /suche/gewerbe/kaufen | commercial |
| Commercial for Rent | /suche/gewerbe/mieten | commercial |
| Offices for Sale | /suche/bueros/kaufen | commercial |
| Offices for Rent | /suche/bueros/mieten | commercial |
| Warehouses for Sale | /suche/hallen/kaufen | commercial |
| Warehouses for Rent | /suche/hallen/mieten | commercial |
| Parking for Sale | /suche/garagen/kaufen | commercial |
| Parking for Rent | /suche/garagen/mieten | commercial |

## Field Mapping

| Immonet/Immowelt Field | TierI Field | Notes |
|------------------------|------------|-------|
| price | price | EUR, parsed from German format |
| area | details.sqm | |
| rooms | details.rooms | |
| bedrooms | details.bedrooms | |
| bathrooms | details.bathrooms | |
| floor | details.floor | Normalized from "Erdgeschoss"/"EG" = 0 |
| constructionYear | details.year_built | |
| parkingSpaces | parking_spaces | |
| condition | condition | Normalized (new/good/after_renovation/etc.) |
| heatingType | heating_type | Normalized (gas/oil/central/district/etc.) |
| energyRating | energy_rating | A-G scale |
| furnished | furnished | furnished/partially_furnished/not_furnished |
| balcony/terrace/garden/elevator/cellar | amenities.has_* | Boolean flags |
| ownershipType | german_ownership | eigentum/erbbaurecht/mietkauf/etc. |
| hausgeld | german_hausgeld | |
| courtage | german_courtage | |
| kfwStandard | german_kfw_standard | |
| denkmalschutz | german_is_denkmalschutz | Listed building protection |

## Running Locally

```bash
# Build
docker build -t immonet-de -f scrapers/Germany/immonet-de/Dockerfile .

# Run
docker run \
  -e PORT=8088 \
  -e INGEST_API_URL=http://host.docker.internal:3010 \
  -e INGEST_API_KEY=dev_key_de_1 \
  -e REDIS_HOST=host.docker.internal \
  -p 8088:8088 \
  immonet-de

# Trigger scrape
curl -X POST http://localhost:8088/scrape
```

## Known Issues / Notes

- **AVIV Group merger:** immonet.de now redirects to immowelt.de. The scraper targets immowelt.de `/suche/` URLs directly.
- **UFRN extraction:** Primary data source is `window.__UFRN_FETCHER__` which contains pre-rendered search data. Supports LZ-string compressed (old format), JSON.parse unicode-escaped (new format), and direct object (pre-parsed) formats.
- **DataDome protection:** The `/classified-search` URL format gets blocked by DataDome bot detection. The scraper uses `/suche/` URLs which work with UFRN extraction.
- **Cookie consent:** Handles Usercentrics / AVIV Group consent popups automatically with multiple selector strategies.
- **Fresh browser per category:** Browser is restarted for each search category to avoid state issues and browser disconnections.
- **Header rotation:** User agents and headers are rotated per category and per page request to reduce detection.
- **Rate limiting:** Workers use BullMQ rate limiter (3 jobs per 5 seconds) plus per-job jitter delays. Occasional long pauses are inserted via `rateLimitedDelay` to appear more human.
- **Shared scraper instance:** Detail fetch workers share a single `ListingsScraper` instance to reuse the Playwright browser, reducing resource overhead.
- **lz-string dependency:** Required for decompressing legacy UFRN data format.
- **Batch flush with retry:** Failed batch sends are re-queued to the front of the batch array for the next flush attempt.
