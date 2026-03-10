# Comparis.ch Scraper (Switzerland)

## Overview
- Portal: comparis.ch, ~15% Swiss market (aggregator)
- Country: Switzerland (ch)
- Port: 8093
- Language regions: DE/FR/IT
- Currency: CHF
- Categories: apartment/house/land/commercial
- Method: REST API (POST `api.comparis.ch/property/v1/search`)
- Status: Built (needs live API verification -- TODOs marked in code)

## Architecture

### Three-Phase Flow
- Phase 1: Paginated search across 7 category configs (apartment buy/rent, house buy/rent, land buy, commercial buy/rent). Uses concurrent page fetching (default 5 pages in parallel via `CONCURRENT_PAGES`).
- Phase 2: Checksum comparison via `ChecksumClient` from `@landomo/core`. Compares price, title, description, rooms, bathrooms, sqm.
- Phase 3: BullMQ detail queue (`comparis-ch-details`) for new/changed only. Workers use listing data if already complete, otherwise fetch detail from `/property/v1/details/{id}`. Auto-detects category via `comparisTransformer` router.

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape orchestration, queue drain loop |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase scan/checksum/queue with 7 categories |
| `src/scrapers/listingsScraper.ts` | `ListingsScraper` class with configurable category list |
| `src/scrapers/detailScraper.ts` | Sequential detail batch fetch with progress callback |
| `src/queue/detailQueue.ts` | BullMQ queue, worker with conditional detail fetch |
| `src/adapters/ingestAdapter.ts` | POST to bulk-ingest API (supports portal-specific API key env var) |
| `src/transformers/comparisTransformer.ts` | Category router: detects type and delegates to specific transformer |
| `src/transformers/apartments/apartmentTransformer.ts` | Raw -> ApartmentPropertyTierI |
| `src/transformers/houses/houseTransformer.ts` | Raw -> HousePropertyTierI |
| `src/transformers/land/landTransformer.ts` | Raw -> LandPropertyTierI |
| `src/transformers/commercial/commercialTransformer.ts` | Raw -> CommercialPropertyTierI |
| `src/types/comparisTypes.ts` | Comparis listing and search response types |
| `src/utils/fetchData.ts` | HTTP client with retry, concurrent page fetching |
| `src/utils/checksumExtractor.ts` | Checksum field extraction (handles id/adId/listingId) |
| `src/utils/userAgents.ts` | User agent rotation pool (15 agents) |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8093 | HTTP server port |
| INGEST_API_URL | http://localhost:3004 | Ingest service base URL |
| INGEST_API_KEY | (empty) | API key for ingest service |
| INGEST_API_KEY_COMPARIS_CH | (empty) | Portal-specific API key (takes priority) |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis password (optional) |
| WORKER_CONCURRENCY | 50 | Parallel detail fetch workers (high default) |
| CONCURRENT_PAGES | 5 | Pages fetched in parallel during Phase 1 |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats |
| /scrape | POST | Trigger full three-phase scrape (async, returns 202) |
| /metrics | GET | Prometheus metrics (via setupScraperMetrics) |

## Category Mapping

Category is auto-detected from `propertyType` field via keyword matching in `comparisTransformer.ts`:

| Portal propertyType Keywords | TierI Type | property_category |
|-----------------------------|------------|-------------------|
| apartment, wohnung, flat, studio, loft, attic, attika, appartement | ApartmentPropertyTierI | apartment |
| house, haus, villa, chalet, maison, einfamilienhaus, reihenhaus | HousePropertyTierI | house |
| land, grundstuck, terrain, plot, bauland | LandPropertyTierI | land |
| commercial, gewerbe, buro, office, retail, laden | CommercialPropertyTierI | commercial |
| (fallback: plotArea without livingSpace -> land, else apartment) | -- | -- |

Deal types sent as numeric codes: `buy=10`, `rent=20`.

## Field Mapping

| Portal Field | TierI Field | Notes |
|-------------|-------------|-------|
| price / priceValue | price | Fallback chain |
| (hardcoded) | currency | Always CHF |
| numberOfRooms / rooms | bedrooms | floor(rooms) - 1 (min 1) |
| livingSpace / surfaceLiving | sqm / sqm_living / sqm_total | Category-dependent |
| plotArea | sqm_plot / area_plot_sqm | House/land |
| hasElevator | has_elevator | Direct boolean |
| hasBalcony | has_balcony | Direct boolean (apartment) |
| hasParking | has_parking | Direct boolean |
| hasGarage | has_garage | Direct boolean (house) |
| hasGarden | has_garden | Direct boolean (house) |
| isFurnished | furnished | "furnished" or undefined |
| dealType | transaction_type | 10=sale, 20=rent, or string "buy"/"rent" |
| url | source_url | Fallback to `comparis.ch/immobilien/detail/{id}` |
| features | features | Array passthrough |

## Swiss-Specific Fields

Stored in `country_specific` JSONB:

| Field | Description |
|-------|-------------|
| canton | Canton name/code |
| zip_code | Swiss postal code |

## Running Locally

```bash
docker build -t comparis-ch .
docker run -e PORT=8093 -e INGEST_API_URL=http://host.docker.internal:3004 -e INGEST_API_KEY=dev_key_ch_1 -e REDIS_HOST=host.docker.internal -p 8093:8093 comparis-ch
curl -X POST http://localhost:8093/scrape
```

## TODO / Verification Needed

- `src/types/comparisTypes.ts`: "Verify field names against actual Comparis API response after deployment"
- `src/types/comparisTypes.ts`: "Verify actual codes used by Comparis API" (COMPARIS_PROPERTY_TYPES, COMPARIS_DEAL_TYPES)
- `src/utils/fetchData.ts`: "Verify actual Comparis search API endpoint" -- `api.comparis.ch/property/v1/search` is assumed
- `src/utils/fetchData.ts`: "Verify actual detail endpoint URL pattern" -- `api.comparis.ch/property/v1/details/{id}` is assumed
- `src/utils/fetchData.ts`: Search POST payload structure (dealType, propertyTypes, cantons, sortField, etc.) needs live verification
