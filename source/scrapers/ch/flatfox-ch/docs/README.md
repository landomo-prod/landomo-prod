# Flatfox.ch Scraper (Switzerland)

## Overview
- Portal: flatfox.ch, ~15% Swiss rental market (strong in German-speaking regions)
- Country: Switzerland (ch)
- Port: 8094
- Language regions: DE/FR/IT
- Currency: CHF
- Categories: Apartments (rent/sale), Houses (rent/sale), Commercial (rent/sale)
- Method: Public REST API (`https://flatfox.ch/api/v1/flat/`)
- Status: Built - needs live API verification

## Architecture

### Three-Phase Flow
- Phase 1: Paginated fetch of all listings from the Flatfox public REST API (`GET /api/v1/flat/?limit=100&offset=N`), iterating over 6 category combinations (APARTMENT/HOUSE/COMMERCIAL x RENT/SALE). The list API returns full listing data including descriptions, so detail fetches are rarely needed.
- Phase 2: Checksum comparison via `ChecksumClient` from `@landomo/core`. Checksums are computed from price, title, description, bedrooms, and sqm fields. Compared in batches of 5000 against the ingest service.
- Phase 3: BullMQ detail queue (`flatfox-ch-details`) for new/changed listings only. Workers transform and batch-send to ingest API in groups of 100. Detail fetch is only triggered if `description` is missing from list data.

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape orchestration, graceful shutdown |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase scrape logic with per-category processing |
| `src/scrapers/listingsScraper.ts` | ListingsScraper class (alternative entry point) |
| `src/scrapers/detailScraper.ts` | Sequential detail fetcher with 200-500ms delays |
| `src/queue/detailQueue.ts` | BullMQ queue, worker (concurrency 50), batch flush to ingest |
| `src/transformers/flatfoxTransformer.ts` | Category detection and router (apartment/house/land/commercial) |
| `src/transformers/apartments/apartmentTransformer.ts` | Flatfox -> ApartmentPropertyTierI |
| `src/transformers/houses/houseTransformer.ts` | Flatfox -> HousePropertyTierI |
| `src/transformers/land/landTransformer.ts` | Flatfox -> LandPropertyTierI |
| `src/transformers/commercial/commercialTransformer.ts` | Flatfox -> CommercialPropertyTierI |
| `src/adapters/ingestAdapter.ts` | HTTP client for bulk-ingest API |
| `src/utils/fetchData.ts` | Flatfox API client with pagination and retry |
| `src/utils/checksumExtractor.ts` | Checksum field extraction and batch creation |
| `src/utils/userAgents.ts` | Random user agent rotation (8 agents) |
| `src/types/flatfoxTypes.ts` | TypeScript interfaces for Flatfox API responses |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8094 | HTTP server port |
| INGEST_API_URL | http://localhost:3000 | Ingest service URL (checksums) / http://localhost:3004 (adapter) |
| INGEST_API_KEY | (empty) | Ingest service API key |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis password (optional) |
| WORKER_CONCURRENCY | 50 | BullMQ worker concurrency |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats |
| /scrape | POST | Trigger three-phase scrape (returns 202 immediately) |
| /metrics | GET | Prometheus metrics (via setupScraperMetrics) |

## Category Mapping

| Portal Category | Offer Type | TierI Type | property_category |
|-----------------|-----------|------------|-------------------|
| APARTMENT | RENT/SALE | ApartmentPropertyTierI | apartment |
| HOUSE | RENT/SALE | HousePropertyTierI | house |
| COMMERCIAL | RENT/SALE | CommercialPropertyTierI | commercial |
| LAND* | - | LandPropertyTierI | land |
| SHARED/PARKING | - | ApartmentPropertyTierI | apartment (default) |

*Land is detected via `object_category` or `object_type` fields containing LAND/PLOT.

## Field Mapping

### Apartment
| Flatfox Field | TierI Field |
|---------------|-------------|
| public_title / short_title | title |
| rent_gross / rent_net / price_display | price (rent) |
| price_display | price (sale) |
| number_of_rooms | rooms, bedrooms (floor(rooms) - 1) |
| livingspace | sqm |
| floor | floor |
| city | location.city |
| latitude/longitude | location.coordinates |
| attributes[lift/elevator] | has_elevator |
| attributes[balcony/balkon] | has_balcony |
| attributes[garage/parking] | has_parking |
| attributes[cellar/keller] | has_basement |
| year_built | year_built |
| is_furnished | furnished |
| zipcode | country_specific.zip_code |
| moving_date | country_specific.moving_date |
| rent_net | country_specific.rent_net |
| rent_charges | country_specific.rent_charges |

### House
Same as apartment except: `livingspace` -> `sqm_living`, `sqm_plot` = 0, attributes[garden/garten] -> `has_garden`, attributes[garage] -> `has_garage`.

### Land
`livingspace` -> `area_plot_sqm`, `price_display` -> `price`.

### Commercial
`livingspace` -> `sqm_total`, `has_bathrooms` always true.

## Running Locally

```bash
# Build
docker build -t flatfox-ch -f scrapers/Switzerland/flatfox-ch/Dockerfile .

# Run
docker run -e PORT=8094 -e INGEST_API_URL=http://host.docker.internal:3004 -e REDIS_HOST=host.docker.internal -p 8094:8094 flatfox-ch

# Trigger scrape
curl -X POST http://localhost:8094/scrape

# Check health
curl http://localhost:8094/health
```

## TODO / Verification Needed

- Flatfox public API (`/api/v1/flat/`) needs live verification that it still returns full listing data in list results
- Land category has no dedicated Flatfox category in CATEGORIES array -- relies on `object_type` detection (LAND/PLOT)
- `sqm_plot` for houses is hardcoded to 0 (Flatfox may not expose plot size)
- `has_bathrooms` for commercial is hardcoded to true
- IngestAdapter default URL is `http://localhost:3004` but ChecksumClient default is `http://localhost:3000` -- verify which is correct for deployment
- Rate limiting: 300-500ms between pages, 200-500ms between detail fetches -- may need tuning
