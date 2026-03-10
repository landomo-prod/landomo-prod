# boligsiden-dk Scraper

Scraper for [boligsiden.dk](https://www.boligsiden.dk) — Denmark's largest real estate portal, aggregating listings from all Danish real estate agents. Covers apartments (condos), houses (villas, terraced houses, holiday houses, farms), and land (building plots, holiday plots) for sale across Denmark.

## Overview

| Property | Value |
|----------|-------|
| Portal | `boligsiden-dk` |
| Country | Denmark (`dk`) |
| API Type | Public REST API (no authentication required) |
| API Base URL | `https://api.boligsiden.dk` |
| Default Port | `8200` |
| Currency | DKK |
| Transaction Type | Sale only |
| Categories | apartment, house, land (commercial: not surfaced by API) |

## Architecture

```
GET /scrape (HTTP trigger)
    └── scrapeAll()                        # listingsScraper.ts
         └── for each addressType (9 types)
              └── scrapeAddressType()
                   └── fetchPage() x N    # 100 listings/page, 300ms delay between pages
                        └── streamBatch() callback (index.ts)
                             ├── transformBoligsidenToStandard()   # transformers/index.ts
                             │    ├── detectCategory()             # utils/categoryDetector.ts
                             │    └── transformBoligsiden{Apartment,House,Land,Commercial}()
                             └── IngestAdapter.sendProperties()    # adapters/ingestAdapter.ts
                                  └── POST /api/v1/properties/bulk-ingest
```

The scraper uses a **streaming / batch-flush pattern**: listings are transformed and sent to the ingest API in batches of 500 as each page is fetched, rather than accumulating all listings in memory first. This keeps memory usage bounded regardless of the total listing count.

## API Details

### Endpoint

```
GET https://api.boligsiden.dk/search/cases
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `pageSize` | integer | Number of results per page (scraper uses 100) |
| `pageNumber` | integer | 1-based page index |
| `addressTypes` | string | Comma-separated address type filter |

**Response shape:**

```json
{
  "_links": { "self": { "href": "..." } },
  "cases": [ /* BoligsidenCase[] */ ],
  "totalHits": 12345
}
```

The API is public and requires no API key or session tokens.

### Address Types Scraped

The scraper iterates over all 9 address types sequentially:

| Boligsiden `addressType` | Landomo Category | Danish Term |
|--------------------------|-----------------|-------------|
| `villa` | house | Villa / Parcelhus |
| `condo` | apartment | Ejerlejlighed / Andelsbolig |
| `terraced house` | house | Rækkehus |
| `holiday house` | house | Fritidsbolig / Sommerhus |
| `full year plot` | land | Helårsgrund / Byggegrund |
| `holiday plot` | land | Sommerhusgrund |
| `cattle farm` | house | Kvæggård |
| `farm` | house | Landbrug |
| `hobby farm` | house | Hobbyland |

Commercial (`erhverv`) listings are not exposed through this API endpoint. The commercial transformer exists to handle any unexpected commercial cases that may appear.

## File Structure

```
boligsiden-dk/
├── Dockerfile
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md                          # This file
└── src/
    ├── index.ts                           # Express server, scrape orchestration
    ├── scrapers/
    │   └── listingsScraper.ts             # Pagination + streaming fetch logic
    ├── adapters/
    │   └── ingestAdapter.ts               # HTTP client for ingest API (with retries)
    ├── transformers/
    │   ├── index.ts                       # Router: category detection → transformer dispatch
    │   ├── shared.ts                      # Shared helpers (address, URL, building, energy label)
    │   ├── apartments/
    │   │   └── apartmentTransformer.ts    # condo → ApartmentPropertyTierI
    │   ├── houses/
    │   │   └── houseTransformer.ts        # villa/terraced/holiday/farm → HousePropertyTierI
    │   ├── land/
    │   │   └── landTransformer.ts         # plots → LandPropertyTierI
    │   └── commercial/
    │       └── commercialTransformer.ts   # (fallback) → CommercialPropertyTierI
    ├── types/
    │   └── boligsidenTypes.ts             # TypeScript interfaces for API response shapes
    └── utils/
        ├── categoryDetector.ts            # addressType → PropertyCategory mapping
        └── userAgents.ts                  # Rotating User-Agent strings
```

## Field Mappings

### Apartment (`condo`)

| Boligsiden Field | TierI Field | Notes |
|------------------|------------|-------|
| `caseID` | `portal_id` | Prefixed: `boligsiden-{caseID}` |
| `slug` / `slugAddress` | `source_url` | `https://www.boligsiden.dk/adresse/{slug}` |
| `priceCash` / `address.casePrice` | `price` | DKK |
| `housingArea` | `sqm` | Falls back to `building.housingArea`, then `building.totalArea` |
| `numberOfRooms` | `bedrooms` | `rooms - 1` (Danish convention: rooms includes kitchen) |
| `numberOfBathrooms` | `bathrooms` | Falls back to building data, defaults to 1 |
| `hasElevator` | `has_elevator` | — |
| `hasBalcony` | `has_balcony` | — |
| `hasTerrace` | `has_terrace` | — |
| `yearBuilt` / `building.yearBuilt` | `year_built` | — |
| `building.yearRenovated` | `renovation_year` | — |
| `energyLabel` / `address.energyLabel` | `energy_class` | Normalized (see Energy Labels) |
| `address.municipality.name` | `country_specific.municipality` | — |
| `address.municipality.municipalityCode` | `country_specific.municipality_code` | — |
| `address.province.name` | `country_specific.province` | — |
| `daysOnMarket` | `country_specific.days_on_market` | — |
| `monthlyExpense` | `country_specific.monthly_expense` | — |
| `perAreaPrice` | `country_specific.per_area_price` | DKK/sqm |
| `weightedArea` / `address.weightedArea` | `country_specific.weighted_area` | — |
| `address.latestValuation` | `country_specific.latest_valuation` | Public valuation |
| `address.gstkvhx` | `country_specific.gstkvhx` | Danish cadastral identifier |

Fixed values: `has_parking = false`, `has_basement = false` (not in API).

### House (`villa`, `terraced house`, `holiday house`, `cattle farm`, `farm`, `hobby farm`)

| Boligsiden Field | TierI Field | Notes |
|------------------|------------|-------|
| `housingArea` | `sqm_living` | Living area; falls back to building data |
| `lotArea` | `sqm_plot` | Plot/land area |
| `numberOfRooms` | `bedrooms` | `rooms - 1` |
| `lotArea > 0` / `hasTerrace` / `hasBalcony` | `has_garden` | Plot present implies garden |
| `building.buildingName` contains "garage"/"carport" | `has_garage` | Inferred from buildings array |
| `has_garage` | `has_parking` | Garage implies parking |
| `building.buildingName` contains "kælder"/"basement" | `has_basement` | Inferred from buildings array |
| `addressType` | `country_specific.address_type` | Original type stored for reference |
| `addressType === 'holiday house'` | `features: ['holiday_property']` | — |
| `addressType` in `['cattle farm','farm','hobby farm']` | `features: ['agricultural']` | — |

### Land (`full year plot`, `holiday plot`)

| Boligsiden Field | TierI Field | Notes |
|------------------|------------|-------|
| `lotArea` | `area_plot_sqm` | Primary; falls back to `housingArea`, then `weightedArea` |
| `utilitiesConnectionFee` | `country_specific.utilities_connection_fee` | Tilslutningsbidrag |
| `address.municipality.landValueTaxLevelPerThousand` | `country_specific.land_value_tax_per_thousand` | — |
| `addressType === 'holiday plot'` | `features: ['holiday_plot']` | — |
| `addressType === 'full year plot'` | `features: ['building_plot']` | — |

### Commercial (fallback)

Uses `housingArea` → `sqm_total`. This transformer handles any commercial listings that appear unexpectedly through the API. The Boligsiden search/cases endpoint does not normally return commercial properties.

## Energy Label Normalization

Boligsiden uses Danish energy label variants that are normalized to the standard European scale:

| Raw API value | Normalized |
|--------------|-----------|
| `a2020` | `A+` |
| `a2015` | `A` |
| `a2010` | `A` |
| `a` | `A` |
| `b`–`g` | `B`–`G` |
| Unknown / missing | `undefined` |

## Category Detection

Category is determined from `listing.addressType` using the `ADDRESS_TYPE_CATEGORIES` map in `boligsidenTypes.ts`. If the address type is not recognized, a keyword-based fallback runs (checking for "condo", "plot", "land", "commercial", "erhverv"). Any remaining unknown types default to `house` with a warning log.

## Scraping Behavior

### Pagination

- Page size: 100 listings per request
- Termination: stops when `cases.length === 0` or `totalSoFar >= totalHits`
- Delay between pages: 300 ms
- Delay between address types: 500 ms
- Request timeout: 30 seconds
- Headers: rotating `User-Agent` strings, `Accept-Language: da-DK`

### Streaming / Batching

Listings are accumulated in `pendingBatch` and flushed to the ingest API whenever the batch reaches 500 items. After all address types are exhausted, any remaining items are flushed in 500-item chunks.

### Error Handling

- Page fetch errors: logged and the address type loop breaks (partial data accepted)
- Transform errors: per-listing `try/catch`; failed listings are skipped and logged
- Ingest errors: retried with exponential backoff (see Ingest Adapter below)

## Ingest Adapter

File: `src/adapters/ingestAdapter.ts`

| Setting | Default | Env Override |
|---------|---------|--------------|
| Ingest URL | `http://ingest-denmark:3000` | `INGEST_API_URL` |
| API key | `dev_key_dk_1` | `INGEST_API_KEY_BOLIGSIDEN_DK` or `INGEST_API_KEY` |
| Max retries | 3 | `MAX_RETRIES` |
| Initial retry delay | 1000 ms | `INITIAL_RETRY_DELAY` |
| Request timeout | 60000 ms | `INGEST_TIMEOUT` |

**Retry policy:** Exponential backoff with jitter, capped at 30 seconds. Retries on HTTP 5xx and 429. Non-retryable errors (4xx except 429) are thrown immediately.

**Payload format:**

```json
{
  "portal": "boligsiden-dk",
  "country": "dk",
  "scrape_run_id": "<uuid>",
  "properties": [
    {
      "portal_id": "boligsiden-<caseID>",
      "data": { /* TierI property object */ },
      "raw_data": { /* original BoligsidenCase */ }
    }
  ]
}
```

## HTTP API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check; returns `{ status: "healthy", scraper, version, timestamp }` |
| `/scrape` | POST | Triggers a scrape run; responds `202 Accepted` immediately, runs asynchronously |
| `/metrics` | GET | Prometheus metrics (via `setupScraperMetrics`) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8200` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-denmark:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_dk_1` | Fallback ingest API key |
| `INGEST_API_KEY_BOLIGSIDEN_DK` | — | Portal-specific ingest API key (preferred) |
| `MAX_RETRIES` | `3` | Ingest request max retries |
| `INITIAL_RETRY_DELAY` | `1000` | Initial backoff delay in ms |
| `INGEST_TIMEOUT` | `60000` | Ingest HTTP timeout in ms |

## Docker

The multi-stage Dockerfile builds `shared-components` first (required for `@landomo/core` types), then compiles the scraper TypeScript source, and produces a lean production image.

**Build context:** Repository root (not the scraper directory). The compose file must set `context: ../../..` relative to `docker/`.

**Port:** `8200` (exposed and health-checked).

**Health check:** HTTP GET to `http://localhost:8200/health`, every 30 seconds, 3-second timeout, 3 retries.

### Build manually

```bash
# From repository root
docker build \
  -f scrapers/Denmark/boligsiden-dk/Dockerfile \
  -t boligsiden-dk \
  .
```

### Run locally

```bash
docker run -p 8200:8200 \
  -e INGEST_API_URL=http://host.docker.internal:3000 \
  -e INGEST_API_KEY=dev_key_dk_1 \
  boligsiden-dk
```

## Known Limitations

- **No rental listings:** Boligsiden's `/search/cases` endpoint only returns for-sale listings. All properties are ingested with `transaction_type: 'sale'`.
- **No commercial listings:** The `commercial` address type is absent from the Boligsiden public API. The commercial transformer is a safety net only.
- **Parking not in API:** `has_parking` is `false` for apartments (no data); for houses it is inferred from the presence of a garage building.
- **Basement not in API:** `has_basement` is `false` for apartments. For houses it is inferred from building names containing "kælder" or "basement".
- **No checksum optimization:** The scraper always fetches all pages for all address types on every run. There is no incremental / checksum-based skip mechanism.
- **Sequential address types:** Address types are scraped one after another. Parallelism across types could reduce run time but is not implemented to avoid overloading the API.

## Troubleshooting

**Scrape does not start / returns 500**
Check the container logs for transformer errors. A single bad listing will not abort the run (per-listing try/catch), but a persistent API failure on the first page of an address type will cause that type to be skipped.

**Zero listings ingested**
Verify the ingest service is reachable at `INGEST_API_URL` and that the API key is correct. The ingest adapter will log retry attempts.

**`Unknown addressType, defaulting to house` warning**
Boligsiden has added a new address type not yet in the `ADDRESS_TYPE_CATEGORIES` map in `boligsidenTypes.ts`. Update both `ADDRESS_TYPE_CATEGORIES` and `ALL_ADDRESS_TYPES` to handle it explicitly.

**High memory usage**
The streaming batch size is 500. If ingest is slow and batches pile up, `pendingBatch` can grow. Reduce `BATCH_SIZE` in `index.ts` or ensure the ingest service can keep up.
