# Immowelt.de Scraper

## Overview
- Portal: immowelt.de, ~15% German market share
- Country: Germany (de)
- Port: 8088
- Categories: Apartments, Houses, Land, Commercial, Offices, Warehouses, Hospitality, Parking (sale + rent)
- Method: Playwright with UFRN extraction (`__UFRN_FETCHER__` LZ-String compressed JSON) + DataDome bypass
- Status: Active

## Architecture

### Three-Phase Flow

1. **Phase 1 - Discovery:** Launches a stealth Playwright browser and navigates through 15 category URLs (sale/rent combinations). On each search results page, extracts the `__UFRN_FETCHER__` JavaScript object, decompresses it from LZ-String Base64, and parses all listing data directly from the search page JSON -- no individual detail page visits needed for most data. Paginates using the `sp` query parameter.

2. **Phase 2 - Checksum Comparison:** Generates checksums from price, title, description, and sqm fields. Compares against the ingest API in batches of 5000. Unchanged listings are skipped entirely.

3. **Phase 3 - Detail Queue:** New/changed listings are queued to a BullMQ `immowelt-de-details` queue. Workers primarily transform from search data (no detail page visit). Falls back to Playwright detail page fetch with UFRN extraction if search data is missing. Batches of 100 are sent to the ingest API.

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape trigger, queue drain loop |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase orchestration logic |
| `src/scrapers/listingsScraper-ufrn.ts` | Playwright-based UFRN data extraction with pagination |
| `src/utils/checksumExtractor.ts` | Checksum field extraction (price, title, description, sqm) |
| `src/queue/detailQueue.ts` | BullMQ queue, detail worker (search-data or Playwright fallback) |
| `src/transformers/immoweltTransformer.ts` | Raw listing to StandardProperty + German-specific fields |
| `src/types/immoweltTypes.ts` | ImmoweltListing, NextDataProperty, ScraperConfig types |
| `src/adapters/ingestAdapter.ts` | HTTP adapter for bulk-ingest API |
| `src/utils/browser.ts` | Stealth browser launch, context creation, random delays |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8088 | HTTP server port |
| INGEST_API_URL | http://localhost:3010 | Ingest service URL |
| INGEST_API_KEY | dev_key_de_1 | Ingest API key |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis password |
| WORKER_CONCURRENCY | 3 | Detail worker concurrency (low for Playwright memory) |
| HEADLESS | true | Run Playwright in headless mode |
| STEALTH_MODE | true | Enable stealth browser fingerprinting |
| RANDOM_DELAYS | true | Enable randomized delays between requests |
| MIN_DELAY | 1000 | Minimum delay between pages (ms) |
| MAX_DELAY | 3000 | Maximum delay between pages (ms) |
| RATE_LIMIT_DELAY | 2000 | Base rate limit delay (ms) |
| MAX_RETRIES | 3 | Max retries per page navigation |
| TIMEOUT | 60000 | Page navigation timeout (ms) |
| MAX_PAGES_PER_CATEGORY | 10000 | Max pages to paginate per category |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats and feature list |
| /scrape | POST | Trigger full three-phase scrape (async, returns 202) |
| /metrics | GET | Prometheus metrics |

## Category Mapping

| Portal Category | TierI Type | property_category |
|-----------------|------------|-------------------|
| Wohnungen (kaufen/mieten) | ApartmentPropertyTierI | apartment |
| Haeuser (kaufen/mieten) | HousePropertyTierI | house |
| Grundstuecke (kaufen) | LandPropertyTierI | land |
| Gewerbe (kaufen/mieten) | CommercialPropertyTierI | commercial |
| Bueros (kaufen/mieten) | CommercialPropertyTierI | commercial |
| Hallen (kaufen/mieten) | CommercialPropertyTierI | commercial |
| Gastgewerbe (kaufen/mieten) | CommercialPropertyTierI | commercial |
| Garagen (kaufen/mieten) | CommercialPropertyTierI | commercial |

## Field Mapping

| Portal Field | StandardProperty Field |
|-------------|----------------------|
| hardFacts.price.formatted | price |
| hardFacts.facts[livingSpace] | details.sqm |
| hardFacts.facts[numberOfRooms] | details.rooms |
| location.address.city | location.city |
| location.address.zipCode | location.postal_code |
| location.address.state | location.region |
| energyClass.value | energy_rating |
| gallery.images[].url | media.images |
| mainDescription.description | description |

German-specific Tier 1 fields: condition, heating_type, furnished, parking_spaces, available_from, published_date. German indexed columns: german_ownership, german_hausgeld, german_courtage, german_kfw_standard, german_is_denkmalschutz.

## Running Locally

```bash
# Build (from repo root)
docker build -f scrapers/Germany/immowelt-de/Dockerfile -t immowelt-de .

# Run
docker run -e PORT=8088 -e INGEST_API_URL=http://host.docker.internal:3010 \
  -e REDIS_HOST=host.docker.internal -p 8088:8088 immowelt-de

# Trigger scrape
curl -X POST http://localhost:8088/scrape

# Check health
curl http://localhost:8088/health
```

## Known Issues / Notes
- Uses Playwright base image (`mcr.microsoft.com/playwright`) which is large (~2GB).
- DataDome anti-bot protection may block scraping; stealth mode and random delays help but residential proxies may be needed.
- UFRN extraction is fragile -- if Immowelt changes their frontend framework, the `__UFRN_FETCHER__` object may disappear.
- Worker concurrency is kept at 3 due to Playwright's high memory usage per browser context.
- The `lz-string` dependency is required to decompress the Base64-encoded UFRN data.
- Batch flush occurs every 5 seconds or when batch reaches 100 items.
