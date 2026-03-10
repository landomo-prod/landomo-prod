# ImmobilienScout24 Scraper

## Overview
- Portal: immobilienscout24.de, ~60% German market share
- Country: Germany (de)
- Port: 8082
- Categories: apartment, house, land, commercial (sale + rent)
- Method: Three-phase checksum with sitemap discovery + cloudflare-bypass detail fetch
- Status: Active (requires cloudflare-bypass service for detail pages)

## Architecture

### Three-Phase Flow

**Phase 1 - Discovery (Sitemap):** Fetches all active expose IDs from the portal's public XML sitemaps at `/Suche/sitemap/activeExposes.xml?realEstateType={TYPE}&page={N}`. This bypasses anti-bot detection entirely since sitemaps are public XML served without captcha. Covers 6 search categories across multiple real estate types (e.g., `APARTMENT_BUY`, `APARTMENT_RENT`, `HOUSE_BUY`, etc.). Commercial maps to 5 sub-types (`OFFICE`, `STORE`, `GASTRONOMY`, `INDUSTRY`, `SPECIAL_PURPOSE`).

**Phase 2 - Checksum Comparison:** Generates checksums from expose IDs (price, title, rooms, sqm) and compares against the ingest API's checksum store. Listings classified as `new` or `changed` proceed to Phase 3; `unchanged` listings are skipped. Checksums are sent/compared in batches of 5000.

**Phase 3 - Detail Fetch (BullMQ):** New/changed expose IDs are queued as BullMQ jobs. Workers fetch individual expose pages via the cloudflare-bypass service (curl_cffi with Chrome TLS fingerprint, Camoufox fallback). HTML is parsed to extract structured data from `__NEXT_DATA__`, `window.IS24`, `keyValues`, or `application/json` script tags. Transformed data is batched (100 per batch) and sent to the ingest API.

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server, scrape trigger, queue polling |
| `src/scraper/threePhaseOrchestrator.ts` | Orchestrates phases 1-3, checksum comparison |
| `src/utils/fetchData.ts` | Sitemap fetching (Phase 1), bypass service client (Phase 3), HTML data extraction |
| `src/utils/checksumExtractor.ts` | Generates checksums from expose_id + price + title + rooms + sqm |
| `src/queue/detailQueue.ts` | BullMQ queue/worker for detail fetches, batched ingestion |
| `src/transformers/immoscout24Transformer.ts` | Maps IS24 property data to StandardProperty + GermanSpecificFields |
| `src/types/immoscout24Types.ts` | TypeScript interfaces for IS24 API responses |
| `src/adapters/ingestAdapter.ts` | HTTP client for bulk-ingest API |

## Data Flow

```
XML Sitemaps ──→ Expose IDs ──→ Checksum Compare ──→ BullMQ Queue
                                                          │
                  Cloudflare-Bypass Service ◄──────────────┘
                         │
                    HTML Response
                         │
              Extract JSON from HTML ──→ immoscout24Transformer ──→ IngestAdapter ──→ Ingest API
              (__NEXT_DATA__ / IS24 /
               keyValues / json-script)
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8082 | HTTP server port |
| INGEST_API_URL | http://localhost:3010 | Ingest service URL |
| INGEST_API_KEY | (empty) | Ingest API auth key |
| REDIS_HOST | redis | Redis host for BullMQ |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | (none) | Redis auth password |
| WORKER_CONCURRENCY | 3 | BullMQ worker concurrency (capped at 2 for Playwright) |
| BYPASS_SERVICE_URL | (empty) | Cloudflare-bypass FastAPI service URL (required for detail pages) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check with queue stats |
| /scrape | POST | Trigger scrape run (returns 202 immediately) |
| /metrics | GET | Prometheus metrics |

## Category Mapping

| Search Category | Sitemap realEstateType | property_category |
|-----------------|----------------------|-------------------|
| apartment-sale | APARTMENT_BUY | apartment |
| apartment-rent | APARTMENT_RENT | apartment |
| house-sale | HOUSE_BUY | house |
| house-rent | HOUSE_RENT | house |
| land-sale | LIVING_BUY_SITE | land |
| commercial-sale | OFFICE, STORE, GASTRONOMY, INDUSTRY, SPECIAL_PURPOSE | commercial |

## Field Mapping

| IS24 Field | TierI Field | Notes |
|------------|------------|-------|
| objectData.priceInformation.price | price | EUR |
| area.livingArea / livingSpace | details.sqm | |
| objectData.numberOfBedRooms | details.bedrooms | |
| objectData.numberOfBathRooms | details.bathrooms | |
| objectData.floor | details.floor | |
| objectData.constructionYear | details.year_built | |
| objectData.condition | condition | Normalized (new/good/after_renovation/etc.) |
| objectData.heatingType | heating_type | Normalized (gas/oil/central/district/etc.) |
| objectData.energyCertificate.energyEfficiencyClass | energy_rating | A-G scale |
| priceInformation.deposit | deposit | |
| objectData.numberOfParkingSpaces | parking_spaces | |
| objectData.balcony/garden/cellar/lift | amenities.has_balcony/garden/basement/elevator | |
| ownershipType | german_ownership | eigentum/erbbaurecht/mietkauf/etc. |
| priceInformation.hausgeld | german_hausgeld | |
| priceInformation.courtage | german_courtage | Parsed from percentage string |
| energyCertificate.kfwStandard | german_kfw_standard | |
| denkmalschutz | german_is_denkmalschutz | Listed building protection |

## Running Locally

```bash
# Build
docker build -t immoscout24-de -f scrapers/Germany/immobilienscout24-de/Dockerfile .

# Run (requires cloudflare-bypass service for detail pages)
docker run \
  -e PORT=8082 \
  -e INGEST_API_URL=http://host.docker.internal:3010 \
  -e INGEST_API_KEY=dev_key_de_1 \
  -e REDIS_HOST=host.docker.internal \
  -e BYPASS_SERVICE_URL=http://host.docker.internal:8888 \
  -p 8082:8082 \
  immoscout24-de

# Trigger scrape
curl -X POST http://localhost:8082/scrape
```

## Known Issues / Notes

- **Anti-bot protection:** ImmobilienScout24 uses sophisticated anti-bot detection (browser fingerprinting, TLS analysis, behavioral analysis). Direct Playwright and Puppeteer+Stealth approaches are blocked. The cloudflare-bypass service is required for detail page fetches.
- **Sitemap discovery bypasses captcha:** Phase 1 uses public XML sitemaps which are served without anti-bot checks, providing reliable expose ID discovery.
- **Bypass service dependency:** Without `BYPASS_SERVICE_URL` set, detail fetches will fail. The service uses curl_cffi (Chrome TLS) with Camoufox browser fallback.
- **Worker concurrency capped at 2:** Even if `WORKER_CONCURRENCY` is set higher, effective concurrency is limited to 2 to avoid overwhelming the bypass service.
- **HTML extraction strategies:** The detail page parser tries 5 strategies to extract data: `__NEXT_DATA__`, `window.IS24`, `keyValues`, `application/json` script tags, and minimal HTML stub fallback.
- **Docker base image:** Uses `mcr.microsoft.com/playwright:v1.52.0-jammy` for Playwright browser support.
- **Batch flush:** Properties are batched (100) and flushed every 5 seconds or when batch is full.
