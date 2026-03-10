# Newhome.ch Scraper (Switzerland)

## Overview
- Portal: newhome.ch, ~10% Swiss market (strong in new construction segment)
- Country: Switzerland (ch)
- Port: 8095
- Language regions: DE/FR/IT
- Currency: CHF
- Categories: Apartments (buy/rent), Houses (buy/rent), Land (buy), Commercial (buy/rent)
- Method: REST API (`https://api.newhome.ch/api/v1/search` POST, `https://api.newhome.ch/api/v1/objects/:id` GET)
- Status: Built - needs live API verification (multiple TODO markers in code)

## Architecture

### Three-Phase Flow
- Phase 1: Paginated POST search across 7 category combinations (apartment/house/land/commercial x buy/rent). Uses concurrent page fetching (5 pages in parallel by default, configurable via `CONCURRENT_PAGES`). Page size is 50.
- Phase 2: Checksum comparison via `ChecksumClient` from `@landomo/core`. Checksums computed from price, title, description, rooms, and livingSpace. Compared in batches of 5000.
- Phase 3: BullMQ detail queue (`newhome-ch-details`) for new/changed listings only. Workers fetch detail if listing data lacks description, then transform and batch-send to ingest API in groups of 100.

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape orchestration, graceful shutdown |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase scrape logic with per-category processing |
| `src/scrapers/listingsScraper.ts` | ListingsScraper class (alternative entry point) |
| `src/scrapers/detailScraper.ts` | Sequential detail fetcher with 200-500ms delays |
| `src/queue/detailQueue.ts` | BullMQ queue, worker (concurrency 50), batch flush to ingest |
| `src/transformers/newhomeTransformer.ts` | Category detection (multilingual: DE/FR/EN) and router |
| `src/transformers/apartments/apartmentTransformer.ts` | Newhome -> ApartmentPropertyTierI |
| `src/transformers/houses/houseTransformer.ts` | Newhome -> HousePropertyTierI |
| `src/transformers/land/landTransformer.ts` | Newhome -> LandPropertyTierI |
| `src/transformers/commercial/commercialTransformer.ts` | Newhome -> CommercialPropertyTierI |
| `src/adapters/ingestAdapter.ts` | HTTP client for bulk-ingest API |
| `src/utils/fetchData.ts` | Newhome API client with concurrent pagination and retry |
| `src/utils/checksumExtractor.ts` | Checksum field extraction and batch creation |
| `src/utils/userAgents.ts` | Random user agent rotation (8 agents) |
| `src/types/newhomeTypes.ts` | TypeScript interfaces for Newhome API responses |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8095 | HTTP server port |
| INGEST_API_URL | http://localhost:3000 | Ingest service URL (checksums) / http://localhost:3004 (adapter) |
| INGEST_API_KEY | (empty) | Ingest service API key |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis password (optional) |
| WORKER_CONCURRENCY | 50 | BullMQ worker concurrency |
| CONCURRENT_PAGES | 5 | Number of search pages fetched concurrently |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats |
| /scrape | POST | Trigger three-phase scrape (returns 202 immediately) |
| /metrics | GET | Prometheus metrics (via setupScraperMetrics) |

## Category Mapping

| Portal Property Type | Offer Type | TierI Type | property_category |
|---------------------|-----------|------------|-------------------|
| apartment | buy/rent | ApartmentPropertyTierI | apartment |
| house | buy/rent | HousePropertyTierI | house |
| land | buy | LandPropertyTierI | land |
| commercial | buy/rent | CommercialPropertyTierI | commercial |

Category detection supports multilingual keywords:
- **Apartment:** apartment, wohnung, flat, studio, loft, attika, appartement
- **House:** house, haus, villa, chalet, maison, einfamilienhaus, reihenhaus
- **Land:** land, grundstuck, terrain, plot, bauland
- **Commercial:** commercial, gewerbe, buro, office, laden
- **Fallback:** if `plotArea` exists without `livingSpace` -> land, otherwise apartment

## Field Mapping

### Apartment
| Newhome Field | TierI Field |
|---------------|-------------|
| title | title |
| price / priceFrom | price |
| numberOfRooms / rooms | rooms, bedrooms (floor(rooms) - 1) |
| livingSpace / usableSpace | sqm |
| floor | floor |
| numberOfFloors | total_floors |
| city | location.city |
| latitude/longitude | location.coordinates |
| hasElevator / features[elevator] | has_elevator |
| hasBalcony / features[balcony] | has_balcony |
| hasParking / features[parking] | has_parking |
| yearBuilt | year_built |
| isNewConstruction | condition ('new') |
| isFurnished | furnished ('furnished') |
| canton | country_specific.canton |
| zipCode | country_specific.zip_code |
| isNewConstruction | country_specific.is_new_construction |

### House
Same as apartment except: `livingSpace` -> `sqm_living`, `plotArea` -> `sqm_plot`, `hasGarden` -> `has_garden`, `hasGarage` -> `has_garage`.

### Land
`plotArea / livingSpace` -> `area_plot_sqm`, `transaction_type` always 'sale'.

### Commercial
`livingSpace / usableSpace` -> `sqm_total`, `has_bathrooms` always true.

## Running Locally

```bash
# Build
docker build -t newhome-ch -f scrapers/Switzerland/newhome-ch/Dockerfile .

# Run
docker run -e PORT=8095 -e INGEST_API_URL=http://host.docker.internal:3004 -e REDIS_HOST=host.docker.internal -p 8095:8095 newhome-ch

# Trigger scrape
curl -X POST http://localhost:8095/scrape

# Check health
curl http://localhost:8095/health
```

## TODO / Verification Needed

- **API endpoint not verified:** `https://api.newhome.ch/api/v1/search` (POST) and `https://api.newhome.ch/api/v1/objects/:id` (GET) are assumed endpoints. Actual Newhome API structure needs live verification.
- **Response shape uncertain:** Code handles multiple response formats (`items`, `results`, `objects`) as fallbacks -- actual field names need confirmation.
- **Property type codes:** `NEWHOME_PROPERTY_TYPES` mapping is placeholder -- verify actual codes used by Newhome API.
- **Type fields:** `NewhomeListing` interface field names (camelCase) are assumed -- verify actual API response field names.
- `has_basement` is hardcoded to false for all categories.
- `has_bathrooms` for commercial is hardcoded to true.
- IngestAdapter default URL is `http://localhost:3004` but ChecksumClient default is `http://localhost:3000` -- verify which is correct for deployment.
- Land `transaction_type` is hardcoded to 'sale' even though the CATEGORIES array only has `buy` for land -- this is consistent but may miss rental land if it exists.
- Rate limiting: 500-1000ms between page batches, 200-500ms between detail fetches -- may need tuning for Newhome's actual rate limits.
