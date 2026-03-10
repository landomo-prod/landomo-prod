# WG-Gesucht.de Scraper

## Overview
- Portal: wg-gesucht.de, leading German shared housing platform
- Country: Germany (de)
- Port: 8082
- Categories: WG rooms, 1-room apartments, 2-room apartments (rental only)
- Method: Dual mode -- REST API (with auth) or HTML scraping (Cheerio, no auth needed)
- Status: Active

## Architecture

### Three-Phase Flow

1. **Phase 1 - Discovery:** Iterates through 5 major cities (Berlin, Munich, Hamburg, Cologne, Frankfurt) x 3 categories (WG-Zimmer, 1-Zimmer, 2-Zimmer). In API mode, paginates through the `fetchOffers` endpoint. In HTML mode, uses `scrapeListings` with Cheerio to parse search result pages. All listings are tagged as `rent` transaction type.

2. **Phase 2 - Checksum Comparison:** Generates checksums from rent/rent_cold, title, description, rooms, and size/apartment_size. Compares against the ingest API in batches of 5000. Unchanged listings are skipped.

3. **Phase 3 - Detail Queue:** New/changed listings are queued to a BullMQ `wg-gesucht-details` queue. Workers fetch detail pages via API (`fetchOfferDetail`) or HTML scraping (`fetchDetailPage`). Rate limited to 3 jobs per 15 seconds with 5-8s delays per job to avoid reCAPTCHA. Batches of 50 are sent to ingest with 10s periodic flush.

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, dual-mode auth, scrape trigger |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase orchestration with city x category iteration |
| `src/scrapers/listingsScraper.ts` | ListingsScraper class (API-based, requires auth) |
| `src/scrapers/htmlScraper.ts` | HTML-based scraping with Cheerio (no auth needed) |
| `src/utils/checksumExtractor.ts` | Checksum field extraction (rent, title, description, rooms, sqm) |
| `src/utils/fetchData.ts` | API client (fetchOffers, fetchOfferDetail, authenticate) |
| `src/queue/detailQueue.ts` | BullMQ queue, rate-limited detail worker (3/15s) |
| `src/transformers/wgGesuchtTransformer.ts` | Raw offer to StandardProperty + WG-specific fields |
| `src/types/wgGesuchtTypes.ts` | WGGesuchtOffer, city IDs, category types |
| `src/adapters/ingestAdapter.ts` | HTTP adapter for bulk-ingest API |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8082 | HTTP server port |
| INGEST_API_URL | http://localhost:3010 | Ingest service URL |
| INGEST_API_KEY | dev_key_de_1 | Ingest API key |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis password |
| WORKER_CONCURRENCY | 3 | Detail worker concurrency |
| DETAIL_RATE_LIMIT_MS | 5000 | Base delay between detail fetches (ms) |
| BATCH_SIZE | 50 | Ingest batch size |
| WG_GESUCHT_USERNAME | (none) | WG-Gesucht login email (enables API mode) |
| WG_GESUCHT_PASSWORD | (none) | WG-Gesucht login password (enables API mode) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with mode (api/html) and queue stats |
| /scrape | POST | Trigger full three-phase scrape (async, returns 202) |
| /metrics | GET | Prometheus metrics |

## Category Mapping

| Portal Category | TierI Type | property_category |
|-----------------|------------|-------------------|
| WG-Zimmer (0) | ApartmentPropertyTierI | apartment |
| 1-Zimmer-Wohnung (1) | ApartmentPropertyTierI | apartment |
| 2-Zimmer-Wohnung (2) | ApartmentPropertyTierI | apartment |
| 3-Zimmer-Wohnung (3) | ApartmentPropertyTierI | apartment |
| 4+ Zimmer-Wohnung (4) | ApartmentPropertyTierI | apartment |
| Haus (5) | HousePropertyTierI | house |
| Wohnung (6) | ApartmentPropertyTierI | apartment |

Note: Only categories 0, 1, 2 are scraped by default. All map to `apartment` partition since WG-Gesucht is rental-focused shared housing.

## Field Mapping

| Portal Field | StandardProperty Field |
|-------------|----------------------|
| rent / rent_cold | price |
| title | title |
| description | description |
| city | location.city |
| district | location.region |
| zip_code | location.postal_code |
| latitude / longitude | location.coordinates |
| size / apartment_size | details.sqm |
| rooms | details.rooms |
| 1 (WG) or rooms (apt) | details.bedrooms |
| floor | details.floor |
| total_floors | details.total_floors |
| year_built | details.year_built |
| utilities | hoa_fees |
| deposit | deposit |
| available_from | available_from |
| online_since | published_date |
| furniture / furnished | furnished |
| flatmates.* | country_specific.flatmates_* |
| images[] | media.images |

WG-specific country_specific fields: wg_type, flatmates_total/male/female, looking_for_gender, flatmate_age_range, has_internet, has_kitchen, smoking_allowed, pets_allowed, apartment_size, bedroom_size.

## Running Locally

```bash
# Build (from repo root)
docker build -f scrapers/Germany/wg-gesucht-de/Dockerfile -t wg-gesucht-de .

# Run (HTML mode - no auth needed)
docker run -e PORT=8082 -e INGEST_API_URL=http://host.docker.internal:3010 \
  -e REDIS_HOST=host.docker.internal -p 8082:8082 wg-gesucht-de

# Run (API mode - with auth)
docker run -e PORT=8082 -e INGEST_API_URL=http://host.docker.internal:3010 \
  -e REDIS_HOST=host.docker.internal \
  -e WG_GESUCHT_USERNAME=your@email.com -e WG_GESUCHT_PASSWORD=yourpass \
  -p 8082:8082 wg-gesucht-de

# Trigger scrape
curl -X POST http://localhost:8082/scrape

# Check health
curl http://localhost:8082/health
```

## Known Issues / Notes
- WG-Gesucht has aggressive rate limiting with reCAPTCHA. Detail worker is rate-limited to 3 jobs per 15 seconds with 5-8s random delays per request.
- HTML mode works without credentials but may be less reliable than API mode.
- Only covers 5 major cities by default. Additional cities can be added via the `CITY_IDS` constant (15 cities available).
- Only rental listings (transaction_type = 'rent'). WG-Gesucht does not have sale listings.
- WG rooms default to 1 bedroom. Apartments use the total rooms count.
- The `cheerio` dependency is used for HTML parsing in non-API mode.
- Dockerfile exposes port 3000 internally but the app defaults to PORT=8082; ensure PORT env var matches.
- Runs as non-root `scraper` user in Docker (UID 1001).
