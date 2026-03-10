# booli-se Scraper

Scraper for [Booli.se](https://www.booli.se), Sweden's second-largest real estate portal (~8% market share), owned by SBAB Bank. Booli aggregates listings from multiple Swedish portals and exposes them through a documented REST API with HMAC-SHA1 authentication.

---

## Overview

| Field | Value |
|---|---|
| Portal | booli.se |
| Country | Sweden |
| Currency | SEK |
| Transport | Official REST API (`https://api.booli.se`) |
| Auth | HMAC-SHA1 (callerId + unique + time + secret) |
| Port | 8221 |
| Source platform | `booli` |
| Portal ID prefix | `booli-{booliId}` |

### Listing modes

| Mode | Endpoint | Description |
|---|---|---|
| `sale` | `GET /listings` | Active for-sale listings (till salu) |
| `rent` | `GET /rentals` | Active rental listings (hyra) |

---

## Architecture

```
POST /scrape
    └── runScraper()
            ├── ListingsScraper.scrapeAll()
            │       ├── scrapeEndpoint('sale')  → paginate GET /listings
            │       └── scrapeEndpoint('rent')  → paginate GET /rentals
            │
            ├── transformBooliListing(listing, transactionType)
            │       ├── detectCategory()        → apartment | house | land | commercial
            │       └── category transformer    → TierI object
            │
            └── IngestAdapter.sendProperties()  → POST /api/v1/properties/bulk-ingest
```

---

## Directory Structure

```
scrapers/Sweden/booli-se/
├── Dockerfile
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md                          (this file)
└── src/
    ├── index.ts                           Express server, scrape orchestration
    ├── adapters/
    │   └── ingestAdapter.ts               HTTP client for ingest API
    ├── scrapers/
    │   └── listingsScraper.ts             Booli API pagination + HMAC auth
    ├── transformers/
    │   ├── index.ts                       Category routing (dispatcher)
    │   ├── apartments/
    │   │   └── apartmentTransformer.ts    → ApartmentPropertyTierI
    │   ├── houses/
    │   │   └── houseTransformer.ts        → HousePropertyTierI
    │   ├── land/
    │   │   └── landTransformer.ts         → LandPropertyTierI
    │   └── commercial/
    │       └── commercialTransformer.ts   → CommercialPropertyTierI
    ├── types/
    │   └── booliTypes.ts                  Booli API response interfaces + category map
    └── utils/
        ├── categoryDetector.ts            objectType → Landomo category
        └── userAgents.ts                  Rotating user-agent pool
```

---

## API Authentication

Booli uses a custom HMAC-SHA1 scheme. Every request must include four query parameters:

| Parameter | Description |
|---|---|
| `callerId` | Registered Booli API caller ID |
| `unique` | 16-character random alphanumeric string, unique per request |
| `time` | Current Unix timestamp in seconds |
| `hash` | `SHA1(callerId + unique + time + secret)` |

The `secret` is never transmitted; it is used only for the local hash computation.

---

## Pagination

- Page size: 500 (Booli API hard maximum)
- Offset-based: increments by the number of listings actually returned
- Termination: stops when a page returns fewer results than the limit, or when offset reaches `totalCount`
- Country-wide scope: `country=Sverige` (no regional subdivision)

---

## Category Detection

The `objectType` field in the Booli API response determines the Landomo category.

### Direct mapping (`booliTypes.ts`)

| Booli `objectType` | Landomo category |
|---|---|
| Lägenhet, Bostadsrätt, Hyresrätt | `apartment` |
| Villa, Radhus, Kedjehus, Parhus, Fritidshus, Vinterbonat fritidshus, Gård, Gård/Skog, Skog, Övrig | `house` |
| Tomt, Mark, Tomt/Mark | `land` |
| Lokaler | `commercial` |

### Fallback logic (`categoryDetector.ts`)

When the `objectType` is not in the direct map, `detectCategory()` applies partial substring matching (case-insensitive). If no match is found at all, the listing is defaulted to `apartment` (the most common type on Booli) and a `warn` log entry is emitted.

### House subtypes (`getHouseSubtype`)

| Booli `objectType` contains | `property_subtype` |
|---|---|
| radhus | `townhouse` |
| parhus | `semi_detached` |
| kedjehus | `terraced` |
| fritidshus | `cottage` |
| gård / skog | `farmhouse` |
| villa / övrig (default) | `villa` |

---

## Field Mapping

### Swedish conventions applied across all transformers

- **Rooms include the living room** (Swedish standard). `bedrooms = rooms - 1`. A 1-room listing (1 rum) is treated as a studio (0 bedrooms).
- **Area fields**: `livingArea` = BOA (boyta, usable living area); `additionalArea` = biarea (secondary area, e.g. garage, storage); `plotArea` = land/plot area.
- **Currency**: always SEK.

### Apartment (`ApartmentPropertyTierI`)

| Booli field | TierI field | Notes |
|---|---|---|
| `listPrice` | `price` | 0 if not disclosed |
| `livingArea` | `sqm` | BOA in sqm |
| `rooms` | `rooms` | Swedish total (incl. living room) |
| `rooms - 1` | `bedrooms` | min 0 |
| `floor` | `floor` | |
| `hasElevator` | `has_elevator` | |
| `hasBalcony \|\| hasPatio` | `has_balcony` | |
| `rent` (non-Hyresrätt) | `hoa_fees` | Monthly HOA fee (avgift) for bostadsrätt |
| `rent` (Hyresrätt) | `country_specific.se_monthly_rent` | Monthly rent for rental type |
| `listSqmPrice` | `country_specific.se_sqm_price` | |
| `constructionYear` | `country_specific.se_construction_year` | |
| `location.area` | `country_specific.se_area` | Neighbourhood |
| `location.municipality` | `country_specific.se_municipality` | |
| `location.county` | `country_specific.se_county` | |
| `hasPatio` | `country_specific.se_has_patio` | |
| `hasFireplace` | `country_specific.se_has_fireplace` | |

### House (`HousePropertyTierI`)

| Booli field | TierI field | Notes |
|---|---|---|
| `listPrice` | `price` | |
| `livingArea` | `sqm_living` | |
| `plotArea` | `sqm_plot` | |
| `rooms - 1` | `bedrooms` | |
| `plotArea > 0` | `has_garden` | Inferred: plot exists → garden assumed |
| `constructionYear` | `country_specific.se_construction_year` | |
| `rent` | `country_specific.se_monthly_fee` | HOA fee if applicable |

### Land (`LandPropertyTierI`)

| Booli field | TierI field | Notes |
|---|---|---|
| `plotArea ?? livingArea` | `area_plot_sqm` | plotArea preferred; falls back to livingArea |
| `listSqmPrice` | `country_specific.se_sqm_price` | Price per sqm of land |

### Commercial (`CommercialPropertyTierI`)

| Booli field | TierI field | Notes |
|---|---|---|
| `livingArea ?? plotArea` | `sqm_total` | |
| `rent` (rent mode) | `monthly_rent` | Only set when `transactionType === 'rent'` |
| `hasElevator` | `has_elevator` | |

### Fields not available from Booli API at listing-level

- `has_parking`, `has_basement`, `has_garage` — set to `false` (not exposed by Booli at list level)
- `construction_type`, `renovation_year` — not provided
- `has_bathrooms` (commercial) — not provided

---

## Tier II (Country-Specific) Fields

All transformers populate `country_specific` with Sweden-specific data:

| Key | Description |
|---|---|
| `se_object_type` | Original Booli `objectType` string (Swedish) |
| `se_sqm_price` | Price per sqm in SEK (`listSqmPrice`) |
| `se_monthly_fee` | Monthly HOA fee (avgift) for bostadsrätt |
| `se_monthly_rent` | Monthly rent for hyresrätt |
| `se_additional_area` | Biarea (secondary area) in sqm |
| `se_construction_year` | Year of construction |
| `se_area` | Neighbourhood/district name |
| `se_postal_area` | Postal area name |
| `se_municipality` | Municipality name |
| `se_county` | County/region name |
| `se_has_patio` | Has patio/deck (apartments) |
| `se_has_fireplace` | Has fireplace |

---

## Tier III (Portal Metadata) Fields

All transformers populate `portal_metadata`:

| Key | Description |
|---|---|
| `booli_id` | Booli internal listing ID (`booliId`) |
| `source_name` | Source portal name (e.g. Hemnet, Blocket) |
| `source_id` | Source portal listing ID |
| `source_type` | Source portal type |
| `seller_name` | Agent or agency name |
| `seller_url` | Agent contact URL |
| `source_created` | Date listing was created on source portal (ISO 8601) |

---

## Ingest Adapter

- **Target**: `POST {INGEST_API_URL}/api/v1/properties/bulk-ingest`
- **Chunk size**: configurable via `INGEST_CHUNK_SIZE` (default 500)
- **Retry policy**: up to 3 attempts with exponential backoff + jitter (max 30s)
- **Retryable errors**: network errors, HTTP 5xx, HTTP 429
- **Auth**: `Authorization: Bearer {INGEST_API_KEY}`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8221` | Express server port |
| `BOOLI_CALLER_ID` | (required) | Registered Booli API caller ID |
| `BOOLI_SECRET` | (required) | Booli API secret for HMAC signing |
| `REQUEST_DELAY_MS` | `400` | Delay between paginated requests (ms) |
| `INGEST_API_URL` | `http://ingest-sweden:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_se_1` | Bearer token for ingest API |
| `INGEST_CHUNK_SIZE` | `500` | Max properties per ingest POST |
| `MAX_RETRIES` | `3` | Ingest retry attempts |
| `INITIAL_RETRY_DELAY` | `1000` | Base retry delay in ms |
| `INGEST_TIMEOUT` | `60000` | Ingest HTTP timeout in ms |

---

## HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check; returns `{ status: "healthy", ... }` |
| `POST` | `/scrape` | Trigger a full scrape asynchronously; returns HTTP 202 immediately |

---

## Scrape Run Tracking

Uses `ScrapeRunTracker` from `@landomo/core`. The tracker is started before scraping begins and completed/failed at the end. It operates with a 5-second best-effort timeout so a tracking failure does not block ingestion.

Metrics reported on completion:

- `listings_found` — total listings returned by Booli API
- `listings_new` — total properties sent to ingest
- `listings_updated` — always 0 (no update detection at this layer)
- Prometheus metrics: `scrapeDuration`, `propertiesScraped`, `scrapeRuns`, `scrapeRunActive`

---

## Docker

The Dockerfile uses a two-stage build:

1. **Builder stage**: compiles `shared-components` and the scraper TypeScript source
2. **Runtime stage**: copies only the compiled output and installs production dependencies

```
Exposed port: 8221
Healthcheck: GET /health every 30s (3s timeout, 10s start period, 3 retries)
```

---

## Known Limitations

- `has_parking`, `has_basement`, `has_garage` are always `false` — Booli does not expose these at the listing-list level (only in individual listing detail pages, which this scraper does not fetch).
- Commercial listings are sparse on Booli; the portal is primarily residential.
- Booli is an aggregator — the same listing from Hemnet or Blocket may appear here and on those portals, resulting in duplicates if multiple Swedish scrapers are running. The `portal_id: booli-{booliId}` field ensures deduplication within the booli-se scraper itself.
- No checksum-based change detection is implemented; every scrape re-ingests all active listings.
