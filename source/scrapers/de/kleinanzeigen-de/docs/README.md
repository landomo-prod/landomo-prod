# Kleinanzeigen.de Scraper

## Overview
- Portal: kleinanzeigen.de (formerly eBay Kleinanzeigen), ~20% German market share
- Country: Germany (de)
- Port: 8082
- Categories: Apartments, Houses, Land, Commercial, Parking, Temporary/Shared, Vacation, Containers, New Construction, Miscellaneous (12 categories)
- Method: REST API (mobile API with Basic auth) + JAXB response normalization
- Status: Active

## Architecture

### Three-Phase Flow

1. **Phase 1 - Discovery:** Iterates through 12 real estate category IDs. For each category, calls `fetchListingsByState()` which queries the Kleinanzeigen mobile API across all German states. Uses a mobile user agent for API access. Listings are returned in JAXB XML-like JSON format and normalized to flat structures via `normalizeJaxb.ts`.

2. **Phase 2 - Checksum Comparison:** Generates checksums from price, title, description, bedrooms (rooms - 1), and sqm. Processes in batches of 5000. Compares against the ingest API checksum endpoint. Unchanged listings are skipped.

3. **Phase 3 - Detail Queue:** New/changed listings are queued to a BullMQ `kleinanzeigen-details` queue. Workers fetch individual listing details via the mobile API (`fetchListingDetail`), transform to StandardProperty, and batch-send to ingest (batch size 50, flush interval 10s).

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape trigger, queue drain loop |
| `src/scraper/threePhaseOrchestrator.ts` | Three-phase orchestration with per-category processing |
| `src/scrapers/listingsScraper.ts` | ListingsScraper class (alternative scraper with optional detail enrichment) |
| `src/utils/checksumExtractor.ts` | Checksum field extraction (price, title, description, sqm) |
| `src/utils/normalizeJaxb.ts` | JAXB API response normalization to flat structure |
| `src/utils/fetchData.ts` | API client (fetchListings, fetchListingDetail, fetchListingsByState) |
| `src/utils/userAgents.ts` | Mobile user agent rotation |
| `src/queue/detailQueue.ts` | BullMQ queue, detail worker with jitter (100-500ms) |
| `src/transformers/kleinanzeigenTransformer.ts` | Raw listing to StandardProperty + German-specific fields |
| `src/types/kleinanzeigenTypes.ts` | KleinanzeigenListing, category constants, API response types |
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
| WORKER_CONCURRENCY | 10 | Detail worker concurrency (REST API handles parallelism) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats |
| /scrape | POST | Trigger full three-phase scrape (async, returns 202) |
| /metrics | GET | Prometheus metrics |

## Category Mapping

| Portal Category (ID) | TierI Type | property_category |
|----------------------|------------|-------------------|
| Mietwohnungen (203) | ApartmentPropertyTierI | apartment |
| Eigentumswohnungen (196) | ApartmentPropertyTierI | apartment |
| Haeuser zur Miete (205) | HousePropertyTierI | house |
| Haeuser zum Kauf (208) | HousePropertyTierI | house |
| Grundstuecke & Gaerten (207) | LandPropertyTierI | land |
| Gewerbeimmobilien (277) | CommercialPropertyTierI | commercial |
| Garagen & Stellplaetze (197) | CommercialPropertyTierI | commercial (parking) |
| Auf Zeit & WG (199) | ApartmentPropertyTierI | apartment (room) |
| Ferien- & Auslandsimmobilien (275) | ApartmentPropertyTierI | apartment |
| Container (402) | CommercialPropertyTierI | commercial |
| Neubauprojekte (403) | ApartmentPropertyTierI | apartment |
| Weitere Immobilien (198) | ApartmentPropertyTierI | apartment |

## Field Mapping

| Portal Field | StandardProperty Field |
|-------------|----------------------|
| price.amount | price |
| price.currencyIsoCode | currency |
| title | title |
| description.value | description |
| location.city | location.city |
| location.zipCode | location.postal_code |
| location.latitude/longitude | location.coordinates |
| livingSpace | details.sqm |
| rooms | details.rooms |
| rooms - 1 | details.bedrooms |
| constructionYear | details.year_built |
| attributes[] | various (extracted by name matching) |
| images[].largeUrl | media.images |

German-specific Tier 1 fields: condition, heating_type, furnished, available_from, published_date, deposit, parking_spaces. German indexed columns: german_ownership, german_hausgeld, german_courtage, german_kfw_standard, german_is_denkmalschutz.

## Running Locally

```bash
# Build (from repo root)
docker build -f scrapers/Germany/kleinanzeigen-de/Dockerfile -t kleinanzeigen-de .

# Run
docker run -e PORT=8082 -e INGEST_API_URL=http://host.docker.internal:3010 \
  -e REDIS_HOST=host.docker.internal -p 8082:8082 kleinanzeigen-de

# Trigger scrape
curl -X POST http://localhost:8082/scrape

# Check health
curl http://localhost:8082/health
```

## Known Issues / Notes
- The Kleinanzeigen mobile API uses Basic auth (`YW5kcm9pZDpUYVI2MHBFdHRZ`) and JAXB-format responses that need normalization.
- JAXB responses have nested value wrappers (e.g., `title.value` instead of flat `title`) handled by `normalizeJaxb.ts`.
- Total estimated listings across all categories: ~530k.
- Worker concurrency is 10 (higher than Playwright-based scrapers) since it only makes REST API calls.
- Detail worker adds 100-500ms random jitter between requests to avoid rate limiting.
- Batch size for ingest is 50 with 10s periodic flush.
- Runs as non-root `scraper` user in Docker (UID 1001).
- Dockerfile Exposes port 3000 internally but the app defaults to PORT=8082; ensure PORT env var is set correctly in Docker.
