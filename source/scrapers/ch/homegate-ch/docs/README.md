# Homegate.ch Scraper (Switzerland)

## Overview
- Portal: homegate.ch, ~25% Swiss market
- Country: Switzerland (ch)
- Port: 8092
- Language regions: DE/FR/IT (multi-locale data extraction with DE priority)
- Currency: CHF
- Categories: apartment/house/land/commercial
- Method: HTML extraction (`__INITIAL_STATE__` JSON from page source)
- Status: Built (needs live API verification -- TODOs marked in code)

## Architecture

### Three-Phase Flow
- Phase 1: Fetch search result pages for 2 offer types (buy/rent). HTML pages are fetched and `window.__INITIAL_STATE__` JSON is extracted. Category is determined per-listing from the `categories` array (house/land/commercial keywords, default apartment).
- Phase 2: Checksum comparison via `ChecksumClient` from `@landomo/core`. Compares price, title, rooms, bathrooms, sqm.
- Phase 3: BullMQ detail queue (`homegate-ch-details`) for new/changed only. Workers fetch detail HTML pages, extract `__INITIAL_STATE__`, transform by detected category, and batch-ingest.

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape orchestration, queue drain loop |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase scan/checksum/queue logic with category detection |
| `src/scrapers/listingsScraper.ts` | Offer-type based listing fetch wrapper |
| `src/scrapers/detailScraper.ts` | Single property detail fetch (requires offerType) |
| `src/queue/detailQueue.ts` | BullMQ queue, worker (fetch + transform + batch ingest) |
| `src/adapters/ingestAdapter.ts` | POST to bulk-ingest API |
| `src/transformers/apartments/apartmentTransformer.ts` | Raw -> ApartmentPropertyTierI |
| `src/transformers/houses/houseTransformer.ts` | Raw -> HousePropertyTierI |
| `src/transformers/land/landTransformer.ts` | Raw -> LandPropertyTierI |
| `src/transformers/commercial/commercialTransformer.ts` | Raw -> CommercialPropertyTierI |
| `src/types/homegateChTypes.ts` | Homegate data structure types |
| `src/utils/fetchData.ts` | HTML fetch, `__INITIAL_STATE__` extraction, pagination |
| `src/utils/checksumExtractor.ts` | Checksum field extraction from nested Homegate structure |
| `src/utils/userAgents.ts` | User agent + Swiss locale Accept-Language rotation |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8092 | HTTP server port |
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

Category is dynamically detected from each listing's `listing.categories` array:

| Portal Categories Keywords | TierI Type | property_category |
|---------------------------|------------|-------------------|
| house, haus, villa, chalet | HousePropertyTierI | house |
| land, grundstueck, terrain | LandPropertyTierI | land |
| commercial, gewerbe, bureau, office | CommercialPropertyTierI | commercial |
| (default / wohnung) | ApartmentPropertyTierI | apartment |

Offer types: `BUY` and `RENT` (fetched as separate search configs).

## Field Mapping

| Portal Field | TierI Field | Notes |
|-------------|-------------|-------|
| prices.buy.price / prices.rent.gross / prices.rent.net | price | Rent prefers gross over net |
| prices.currency | currency | Default CHF |
| characteristics.numberOfRooms | bedrooms | rooms - 1 (min 1) |
| characteristics.livingSpace | sqm / sqm_living | Category-dependent |
| characteristics.lotSize | sqm_plot / area_plot_sqm | House/land |
| characteristics.hasElevator | has_elevator | Direct boolean |
| characteristics.hasBalcony | has_balcony | Direct boolean |
| characteristics.hasParking | has_parking | Direct boolean |
| characteristics.hasGarage | has_garage | Direct boolean |
| characteristics.isNewBuilding | condition | Maps to "new" |
| characteristics.isFurnished | furnished | "furnished" or undefined |
| localization.{de/en/fr}.text.title | title | DE priority, then EN, then FR |
| localization.{de/en/fr}.text.description | description | DE priority |
| localization.{de/en/fr}.attachments | images | Filtered by type=IMAGE |
| address.geoCoordinates | location.coordinates | lat/lon |
| address.locality | location.city | Direct |
| address.region | location.region | Direct |

## Swiss-Specific Fields

Stored in `country_specific` JSONB:

| Field | Description |
|-------|-------------|
| is_minergie | Minergie energy certification (boolean) |
| is_new_building | New construction flag |
| is_first_occupancy | First-time occupancy flag |
| monthly_charges | Rent charges/Nebenkosten (rent only) |
| year_built | Construction year |
| year_renovated | Last renovation year |
| lot_size | Plot area (house category) |

## Running Locally

```bash
docker build -t homegate-ch .
docker run -e PORT=8092 -e INGEST_API_URL=http://host.docker.internal:3010 -e INGEST_API_KEY=dev_key_ch_1 -e REDIS_HOST=host.docker.internal -p 8092:8092 homegate-ch
curl -X POST http://localhost:8092/scrape
```

## TODO / Verification Needed

- `src/utils/fetchData.ts`: `__INITIAL_STATE__` extraction regex patterns need verification against current Homegate page structure. Two patterns are tried: `window.__INITIAL_STATE__ = {...};` and alternative script tag pattern.
- `src/utils/fetchData.ts`: Search URL pattern (`/en/{rent|buy}/real-estate/{location}/matching-list?ep={page}`) needs verification.
- `src/utils/fetchData.ts`: Detail page data path (`state.listing`) needs verification.
- `src/types/homegateChTypes.ts`: Nested data structure (`resultList.search.fullSearch.result`) based on reverse engineering and needs live verification.
