# ImmoScout24.ch Scraper (Switzerland)

## Overview
- Portal: immoscout24.ch, ~30% Swiss market
- Country: Switzerland (ch)
- Port: 8091
- Language regions: DE/FR/IT (rotated Accept-Language headers)
- Currency: CHF
- Categories: apartment/house/land/commercial
- Method: REST API (`rest-api.immoscout24.ch/v4`)
- Status: Built (needs live API verification -- TODOs marked in code)

## Architecture

### Three-Phase Flow
- Phase 1: Paginated search across 7 category configs (apartment buy/rent, house buy/rent, land buy, commercial buy/rent). Fetches all listing summaries via REST API with pagination headers (`is24-meta-pagenumber`, `is24-meta-pagesize`).
- Phase 2: Checksum comparison via `ChecksumClient` from `@landomo/core`. Compares price, title, rooms, sqm. Stores updated checksums after comparison.
- Phase 3: BullMQ detail queue (`immoscout24-ch-details`) for new/changed listings only. Workers fetch full property detail from `/v4/en/properties/{id}`, transform, and batch-ingest.

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape orchestration, queue drain loop |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase scan/checksum/queue logic |
| `src/scrapers/listingsScraper.ts` | Category-based listing fetch wrapper |
| `src/scrapers/detailScraper.ts` | Single property detail fetch wrapper |
| `src/queue/detailQueue.ts` | BullMQ queue, worker (fetch + transform + batch ingest) |
| `src/adapters/ingestAdapter.ts` | POST to bulk-ingest API |
| `src/transformers/apartments/apartmentTransformer.ts` | Raw -> ApartmentPropertyTierI |
| `src/transformers/houses/houseTransformer.ts` | Raw -> HousePropertyTierI |
| `src/transformers/land/landTransformer.ts` | Raw -> LandPropertyTierI |
| `src/transformers/commercial/commercialTransformer.ts` | Raw -> CommercialPropertyTierI |
| `src/types/immoscout24ChTypes.ts` | API response type definitions |
| `src/utils/fetchData.ts` | HTTP client with retry, backoff, pagination |
| `src/utils/checksumExtractor.ts` | Checksum field extraction + batch creation |
| `src/utils/userAgents.ts` | User agent + Accept-Language rotation |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8091 | HTTP server port |
| INGEST_API_URL | http://localhost:3010 | Ingest service base URL |
| INGEST_API_KEY | dev_key_ch_1 | API key for ingest service |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis password (optional) |
| WORKER_CONCURRENCY | 3 | Parallel detail fetch workers |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats |
| /scrape | POST | Trigger full three-phase scrape (async, returns 202) |
| /metrics | GET | Prometheus metrics (via setupScraperMetrics) |

## Category Mapping

| Portal Category | Offer Type | TierI Type | property_category |
|-----------------|------------|------------|-------------------|
| apartment | buy/rent | ApartmentPropertyTierI | apartment |
| house | buy/rent | HousePropertyTierI | house |
| land | buy | LandPropertyTierI | land |
| commercial | buy/rent | CommercialPropertyTierI | commercial |

Search configs use `s` (offerType: 1=buy, 2=rent) and `t` (propertyType string) parameters.

## Field Mapping

| Portal Field | TierI Field | Notes |
|-------------|-------------|-------|
| price | price | Direct |
| currency | currency | Default CHF |
| numberOfRooms | bedrooms | rooms - 1 (min 1) |
| surfaceLiving | sqm / sqm_living | Category-dependent |
| surfaceProperty | sqm_plot / area_plot_sqm | House/land |
| characteristics.hasLift | has_elevator | Fallback to property.lift |
| characteristics.hasBalcony | has_balcony | Fallback to property.balcony |
| characteristics.hasParking | has_parking | Fallback to property.parking |
| characteristics.hasCellar | has_basement | Fallback to property.cellar |
| condition | condition | Normalized (new/good/after_renovation) |
| heatingType | heating_type | Normalized (central/floor/gas/oil/heat_pump/electric/district) |
| characteristics.isFurnished | furnished | "furnished" or undefined |

## Swiss-Specific Fields

Stored in `country_specific` JSONB:

| Field | Description |
|-------|-------------|
| canton_id | Canton identifier (numeric) |
| minergie | Swiss Minergie energy standard certification |
| energy_label | Energy efficiency label |
| monthly_charges | Nebenkosten (monthly service charges) |
| year_built | Construction year |
| year_renovated | Last renovation year |
| surface_usable | Usable surface area (distinct from living space) |
| surface_property | Plot area (house category) |

## Running Locally

```bash
docker build -t immoscout24-ch .
docker run -e PORT=8091 -e INGEST_API_URL=http://host.docker.internal:3010 -e INGEST_API_KEY=dev_key_ch_1 -e REDIS_HOST=host.docker.internal -p 8091:8091 immoscout24-ch
curl -X POST http://localhost:8091/scrape
```

## TODO / Verification Needed

- `src/scrapers/listingsScraper.ts`: API parameters `s` (offerType) and `t` (propertyType) need verification against live API
- `src/scraper/threePhaseOrchestrator.ts`: `offerTypeId` and `propertyType` params need verification
- `src/utils/fetchData.ts`: Exact query parameters (s, t, pn, inp) need live API verification; pagination header names (`is24-meta-pagenumber`, `is24-meta-pagesize`) need confirmation
- `src/types/immoscout24ChTypes.ts`: Property type IDs (apartment=[1-5], house=[6-10], land=[14-15], commercial=[11-13]) need verification
