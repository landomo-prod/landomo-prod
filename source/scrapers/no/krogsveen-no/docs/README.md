# krogsveen-no Scraper

Scraper for [krogsveen.no](https://www.krogsveen.no), a Norwegian real estate broker portal operated by Krogsveen AS. Covers residential sales, new development projects, commercial properties, and upcoming listings across Norway.

## Overview

| Field | Value |
|-------|-------|
| Portal | krogsveen.no |
| Country | Norway (`no`) |
| Currency | NOK |
| Transaction type | Sale |
| Categories | apartment, house, land, commercial |
| Typical listing volume | ~1,000–1,200 active listings |
| HTTP port | 8212 |
| API strategy | GraphQL BFF (no pagination — full dataset per query) |

## Architecture

```
POST /scrape
    └── ListingsScraper.scrapeAll()
            ├── fetchEstates(RESIDENTIAL_FOR_SALE, ACTIVE)
            ├── fetchEstates(PROJECT_FOR_SALE, ACTIVE)
            ├── fetchEstates(COMMERCIAL_FOR_SALE, ACTIVE)
            └── fetchEstates(RESIDENTIAL_FOR_SALE + PROJECT_FOR_SALE, UPCOMING)
                    │
                    ▼  (streaming callback per bucket)
            transformKrogsveenEstate()
                    │
                    ├── detectCategory() → apartment / house / land / commercial
                    ├── transformKrogsveenApartment()
                    ├── transformKrogsveenHouse()
                    ├── transformKrogsveenLand()
                    └── transformKrogsveenCommercial()
                            │
                            ▼  (batches of 500)
                    IngestAdapter.sendProperties()
                            │
                            ▼
                    POST /api/v1/properties/bulk-ingest  →  ingest-norway:3000
```

## Data Source

The scraper queries Krogsveen's internal GraphQL Backend-for-Frontend (BFF):

```
POST https://www.krogsveen.no/bsr-api
Content-Type: application/json

{
  "query": "query KrogsveenSearch($commissionStates, $commissionTypes) { estatesSearch(...) { total hits { ... estate { ... } } } }",
  "variables": {
    "commissionStates": ["ACTIVE"],
    "commissionTypes": ["RESIDENTIAL_FOR_SALE"]
  }
}
```

The API returns all matching listings in a single response — no pagination is required. Each commission type bucket is fetched sequentially with a 1,500 ms polite delay between requests.

### Commission Buckets

| Label | commissionStates | commissionTypes |
|-------|-----------------|-----------------|
| `residential-for-sale` | `ACTIVE` | `RESIDENTIAL_FOR_SALE` |
| `project-for-sale` | `ACTIVE` | `PROJECT_FOR_SALE` |
| `commercial-for-sale` | `ACTIVE` | `COMMERCIAL_FOR_SALE` |
| `upcoming` | `UPCOMING` | `RESIDENTIAL_FOR_SALE`, `PROJECT_FOR_SALE` |

Deduplication by estate UUID is applied across all buckets, so listings appearing in multiple buckets are only processed once.

## Source File Layout

```
src/
├── index.ts                              # Express server, scrape orchestration, metrics
├── scrapers/
│   └── listingsScraper.ts               # GraphQL fetching, bucket iteration, deduplication
├── transformers/
│   ├── index.ts                         # Entry point: detectCategory → route to transformer
│   ├── shared.ts                        # extractSqm(), buildLocation(), buildSourceUrl()
│   ├── apartments/
│   │   └── apartmentTransformer.ts      # → ApartmentPropertyTierI
│   ├── houses/
│   │   └── houseTransformer.ts          # → HousePropertyTierI
│   ├── land/
│   │   └── landTransformer.ts           # → LandPropertyTierI
│   └── commercial/
│       └── commercialTransformer.ts     # → CommercialPropertyTierI
├── adapters/
│   └── ingestAdapter.ts                 # POST to bulk-ingest with exponential backoff
├── types/
│   └── krogsveenTypes.ts                # KrogsveenEstate interface + GraphQL query string
└── utils/
    ├── categoryDetector.ts              # bsrPropertyType → Landomo category
    └── userAgents.ts                    # Rotating user-agent strings
```

## Category Detection

Category routing is performed in `src/utils/categoryDetector.ts` using two signals:

1. **`commissionType`** (primary for commercial): `COMMERCIAL_FOR_SALE` → `commercial`
2. **`bsrPropertyType`** (normalised string from API):

| bsrPropertyType | Landomo category | Notes |
|-----------------|-----------------|-------|
| `leilighet` | apartment | Standard apartment |
| `tomt` | land | Plot/land |
| `enebolig` | house | Detached house |
| `rekkehus` | house | Terraced/townhouse |
| `tomannsbolig` | house | Semi-detached / duplex |
| `hytter/fritid` | house | Cabin / leisure |
| `gårdsbruk/småbruk` | house | Farm / smallholding |
| `annet` | house | Catch-all fallback |
| _(unknown)_ | apartment | Default fallback |

If `bsrPropertyType` does not match any known value, the detector falls back to substring matching on `typeName` (checking for `leilighet`, `hybel`, `tomt`, `fritidstomt`, `næring`). If still unresolved, defaults to `apartment`.

## Field Mapping

### Shared helpers (`shared.ts`)

**`extractSqm(estate)`** — Area priority (Norwegian BRA standard):
1. `braI` — BRA-i (indoor usable area, the primary marketed figure)
2. `bra` — Total BRA
3. `boa` — Boareal (older standard)
4. `brua` — Bruksareal (synonym, older)
5. `areaSize` — Generic area
6. `parea` — Primary room area (P-ROM)

**`buildLocation(estate)`** — Constructs `PropertyLocation`:
- `address`: concatenation of `vadr`, `zip`, `city` (city normalised from ALL-CAPS to Title Case)
- `city`: title-cased `city`
- `postal_code`: `zip`
- `region`: `localAreaName`
- `country`: `'Norway'`
- `coordinates`: `{ lat, lon }` when both are non-null

**`buildSourceUrl(estate)`** — Constructs listing URL:
```
https://www.krogsveen.no/kjope/{bsrPropertyType-slug}/{estate.id}
```
Norwegian characters are transliterated (`å→a`, `æ→ae`, `ø→o`) and `/` replaced with `-`.

### Apartment transformer

| TierI field | Source field | Notes |
|-------------|-------------|-------|
| `bedrooms` | `estate.bedrooms` | Defaults to 0 |
| `sqm` | `extractSqm()` | BRA-i priority |
| `has_elevator` | `estate.lift` | Direct boolean flag |
| `has_balcony` | `estate.veranda` | Direct boolean flag |
| `has_parking` | `estate.garage` | Direct boolean flag |
| `has_basement` | `estate.braB > 0` or `head` contains `kjeller` | Inferred |
| `price` | `estate.price` | Asking price (prisantydning) |
| `currency` | — | Hardcoded `NOK` |
| `transaction_type` | — | Hardcoded `sale` |
| `published_date` | `estate.publishedAt` | ISO datetime |
| `portal_id` | `krogsveen-no-{estate.id}` | |
| `source_url` | `buildSourceUrl()` | |
| `source_platform` | — | Hardcoded `krogsveen-no` |
| `status` | — | Hardcoded `active` |

**Subtype detection:**
- `studio` — `bedrooms === 0`, or `typeName` includes `hybel`/`studio`
- `penthouse` — `head` includes `penthouse`
- `loft` — `head` or `typeName` includes `loft`
- `standard` — default

### House transformer

| TierI field | Source field | Notes |
|-------------|-------------|-------|
| `bedrooms` | `estate.bedrooms` | Defaults to 0 |
| `sqm_living` | `extractSqm()` | BRA-i priority |
| `sqm_plot` | `estate.plotSize` or `estate.landarea` | Defaults to 0 |
| `has_garden` | `estate.plotSize > 0` or `head` contains `hage` | Inferred |
| `has_garage` | `estate.garage` | Direct boolean flag |
| `has_parking` | `estate.garage` | Garage implies parking |
| `has_basement` | `estate.braB > 0` or `head` contains `kjeller` | Inferred |

**Subtype detection:**

| bsrPropertyType / typeName | Subtype |
|---------------------------|---------|
| `hytter/fritid`, `hytte`, `fritid` | `cottage` |
| `gårdsbruk/småbruk`, `gårdsbruk`, `småbruk` | `farmhouse` |
| `rekkehus`, `rekke` | `terraced` |
| `tomannsbolig`, `tomanns`, `halvpart` | `semi_detached` |
| `villa` | `villa` |
| `enebolig` | `detached` |

### Land transformer

| TierI field | Source field | Notes |
|-------------|-------------|-------|
| `area_plot_sqm` | `plotSize` → `landarea` → `areaSize` → `bra` | Priority chain |
| `price` | `estate.price` | Asking price |

### Commercial transformer

| TierI field | Source field | Notes |
|-------------|-------------|-------|
| `sqm_total` | `extractSqm()` | BRA-i priority |
| `has_elevator` | `estate.lift` | Direct boolean flag |
| `has_parking` | `estate.garage` | Direct boolean flag |
| `has_bathrooms` | — | Always `false` (not exposed by API) |

### Norway-specific JSONB fields (`country_specific`)

All four transformers populate the following Norway-specific keys in `country_specific`:

| Key | Source field | Description |
|-----|-------------|-------------|
| `no_ownership_type` | `ownershipType` or `ownershipName` | e.g. `Selveiet`, `Andel`, `Aksje` |
| `no_total_price` | `totalPrice` | Total price including shared debt (totalpris) |
| `no_commission_type` | `commissionType` | e.g. `RESIDENTIAL_FOR_SALE` |
| `no_property_type_name` | `typeName` | Verbose type name e.g. `Enebolig - Frittliggende` |
| `no_rooms` | `rooms` | Total room count (apartments and houses only) |
| `no_built_year` | `built` | Year of construction (apartments and houses only) |
| `no_floors` | `floors` | Number of floors (apartments and houses only) |
| `no_bra_total` | `bra` | Total BRA in sqm (apartments and houses only) |
| `no_bra_i` | `braI` | BRA-i (indoor) in sqm (apartments and houses only) |

## Ingest Adapter

`IngestAdapter` posts batches to `POST /api/v1/properties/bulk-ingest` with:
- **Payload:** `{ portal, country: 'no', properties: [...], scrape_run_id? }`
- **Auth:** `Authorization: Bearer <INGEST_API_KEY>`
- **Retry:** Exponential backoff with jitter, up to `MAX_RETRIES` attempts
  - Retries on network errors, HTTP 5xx, and HTTP 429
  - Non-retryable errors (4xx except 429) throw immediately
  - Max backoff capped at 30,000 ms

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{ status: 'healthy', scraper, version, timestamp }` |
| `POST` | `/scrape` | Triggers a scrape run asynchronously (responds 202 immediately) |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8212` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-norway:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_no_1` | Bearer token for ingest API |
| `INGEST_API_KEY_KROGSVEEN_NO` | — | Portal-specific key override (takes priority) |
| `MAX_RETRIES` | `3` | Max ingest retry attempts |
| `INITIAL_RETRY_DELAY` | `1000` | Initial backoff delay in ms |
| `INGEST_TIMEOUT` | `60000` | Ingest HTTP request timeout in ms |

## Docker

Built with a two-stage Dockerfile. Build context must be the repository root (the shared-components workspace is copied from `../../..` relative to the scraper).

```bash
# Build from repo root
docker build -f scrapers/Norway/krogsveen-no/Dockerfile -t krogsveen-no .

# Run
docker run -p 8212:8212 \
  -e INGEST_API_URL=http://ingest-norway:3000 \
  -e INGEST_API_KEY=dev_key_no_1 \
  krogsveen-no

# Trigger a scrape
curl -X POST http://localhost:8212/scrape

# Health check
curl http://localhost:8212/health
```

The container health check polls `/health` every 30 seconds with a 3-second timeout.

## Metrics

Uses `@landomo/core` `scraperMetrics`:

| Metric | Labels | Description |
|--------|--------|-------------|
| `scrape_run_active` | `portal` | 1 while a scrape is running |
| `scrape_duration_seconds` | `portal, category` | Total scrape duration |
| `properties_scraped_total` | `portal, category, result` | Count of scraped properties |
| `scrape_runs_total` | `portal, status` | Total scrape runs by success/failure |

## Known Limitations

- **`has_bathrooms` always false** for commercial listings — the Krogsveen search API does not expose bathroom counts.
- **`has_parking` / `has_garage`** are derived from the single `garage` boolean; there is no separate surface parking flag.
- **`has_basement`** is inferred (from `braB` area or heading text) rather than being a direct API field.
- **Upcoming listings** are ingested as `status: 'active'`; the `commissionState: UPCOMING` signal is not mapped to a distinct Landomo status.
- **No checksum mode** — every scrape run fetches and re-ingests all ~1,000–1,200 listings regardless of changes.
