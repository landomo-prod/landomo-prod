# oikotie-fi Scraper

Scraper for [asunnot.oikotie.fi](https://asunnot.oikotie.fi) — Finland's primary real estate portal operated by Sanoma Media Finland. Covers for-sale residential, rental, land plots, and commercial spaces across the country.

## Overview

| Property | Value |
|----------|-------|
| Portal | `oikotie-fi` |
| Country | Finland (`fi`) |
| Port | `8230` |
| Source platform | `oikotie` |
| Total listings | ~88,000 (as of Feb 2026) |
| Expected runtime | 5–15 minutes |

### Listing Volumes by Card Type

| Card Type | Finnish Name | Category | Volume |
|-----------|-------------|----------|--------|
| 100 | myytavat-asunnot (for sale) | apartment / house | ~54,000 |
| 101 | vuokra-asunnot (rental) | apartment / house | ~29,000 |
| 102 | tontit (land plots) | land | ~3,400 |
| 103 | liiketilat (commercial) | commercial | ~1,500 |

Card type 104 (loma-asunnot / vacation properties) is intentionally excluded — these are niche summer cottages. Add a `SCRAPE_TARGETS` entry to re-enable.

## Architecture

```
POST /scrape
    │
    ▼
fetchAuthTokens()          ← GET asunnot.oikotie.fi/myytavat-asunnot (HTML meta tags)
    │
    ▼
scrapeTarget() × 4 targets
    │  10 pages concurrently, 300ms between batches, 1s between targets
    │
    ▼  streaming batch callback
transformOikotieCard()     ← detectCategory() → category-specific transformer
    │
    ▼
IngestAdapter.sendProperties()  ← POST /api/v1/properties/bulk-ingest (chunks of 500)
```

## Authentication

Oikotie's Angular frontend embeds three session tokens in HTML `<meta>` tags. These must be passed as request headers on every API call.

| Meta tag name | HTTP header | Description |
|--------------|-------------|-------------|
| `api-token` | `OTA-token` | SHA-256 session hash |
| `loaded` | `OTA-loaded` | Unix timestamp |
| `cuid` | `OTA-cuid` | User identity hash |

Tokens are fetched once per scrape run via `fetchAuthTokens()` by loading `https://asunnot.oikotie.fi/myytavat-asunnot` and extracting the meta tags with a regex. They rotate per session so a fresh fetch is required each run.

## API

Base URL: `https://asunnot.oikotie.fi/api`

```
GET /api/search?cardType={n}&limit=24&offset={n}&sortBy=published_sort_desc
```

**Required headers:** `OTA-token`, `OTA-loaded`, `OTA-cuid`, `Referer`, `User-Agent`

**Response shape:**
```typescript
{
  found: number;    // total results for pagination
  start: number;
  cards: OikotieCard[];
}
```

## Category Detection

`detectCategory()` in `src/utils/categoryDetector.ts` maps card fields to Landomo categories:

| cardType | cardSubType | Category | Finnish name |
|----------|-------------|----------|-------------|
| 100 / 101 | 1 | `apartment` | Kerrostalo |
| 100 / 101 | 2 | `house` | Rivitalo |
| 100 / 101 | 4 | `house` | Omakotitalo |
| 100 / 101 | 32 | `house` | Huvila |
| 100 / 101 | 64 | `house` | Paritalo |
| 100 / 101 | 256 | `house` | Muu |
| 102 | any | `land` | Tontti |
| 103 | any | `commercial` | Liiketila |
| 104 | 1 | `apartment` | Kerrostalo (vacation) |
| 104 | other | `house` | Loma-asunto |
| unknown subtype | — | `apartment` | (fallback) |

Transaction type is detected from `cardType === 101` (always rental) or `meta.contractType === 4`.

## Field Mapping

### Shared helpers (`src/transformers/shared.ts`)

| Helper | Input | Output | Notes |
|--------|-------|--------|-------|
| `parseOikotiePrice` | `"297 000 €"` / `"663 € / kk"` | `number` | Strips Finnish thousands separator (space), `/kk` |
| `parseOikotieSqm` | `"57 m²"` / `"100/156 m²"` | `number` | Slash format → takes first number (living area) |
| `parseRooms` | `number \| null` | `number` | Finnish rooms field = bedrooms |
| `buildLocation` | `OikotieLocation` | `PropertyLocation` | Maps district → region, zipCode → postal_code |
| `buildMedia` | `OikotieMedia[]` | `{ images, main_image }` | Uses `imageLargeJPEG` from each media entry |
| `buildPortalId` | `OikotieCard` | `"oikotie-{cardId}"` | Stable ID for deduplication |

### Apartment (`ApartmentPropertyTierI`)

| Oikotie field | Landomo field | Notes |
|--------------|---------------|-------|
| `data.rooms` | `bedrooms` | Finnish rooms convention = bedrooms |
| `data.size` | `sqm` | Parsed from string |
| `data.floor` | `floor` | |
| `data.buildingFloorCount` | `total_floors` | Used to derive `floor_location` |
| `data.buildYear` | `year_built` | |
| `data.maintenanceFee` | `hoa_fees` | Monthly vastike in EUR |
| `data.securityDeposit` | `deposit` | Rental deposit |
| `data.condition` | `condition` | Normalized from Finnish: uusi/erinomainen/hyvä/remontoitu/remonttia |
| `meta.published` | `published_date` | ISO string |
| `company.*` | `agent` | realtorName → name, companyName → agency |
| `has_elevator/balcony/parking/basement` | (all false) | Not available in search card results |

`floor_location` is derived: floor 1 = `ground_floor`, floor = total floors = `top_floor`, otherwise `middle_floor`.

### House (`HousePropertyTierI`)

| Oikotie field | Landomo field | Notes |
|--------------|---------------|-------|
| `data.rooms` | `bedrooms` | |
| `data.size` | `sqm_living` | First number of slash format |
| `data.size` (slash) | `sqm_total` | Second number of `100/156 m²` format |
| `data.sizeLot` | `sqm_plot` | Explicit lot field, defaults to 0 |
| `data.buildYear` | `year_built` | |
| `data.buildingFloorCount` | `stories` | |
| `data.maintenanceFee` | `hoa_fees` | Applicable for rivitalo in housing companies |
| `has_garden` | derived | `true` when `sqm_plot > 0` |
| `has_garage/parking/basement` | (all false) | Not available in search cards |

### Land (`LandPropertyTierI`)

| Oikotie field | Landomo field | Notes |
|--------------|---------------|-------|
| `data.sizeLot` | `area_plot_sqm` | Preferred; falls back to parsed `data.size` |
| `data.price` | `price` | |

### Commercial (`CommercialPropertyTierI`)

| Oikotie field | Landomo field | Notes |
|--------------|---------------|-------|
| `data.size` | `sqm_total` | |
| `data.price` | `price` + `monthly_rent` | `monthly_rent` set only when `transaction_type === 'rent'` |
| `data.maintenanceFee` | `hoa_fees` | |
| `has_elevator/parking/bathrooms` | (all false) | Not available in search cards |

### Country-specific JSONB fields (`country_specific`)

All categories include these Finnish-specific fields stored in the `country_specific` JSONB column:

| Field | Source | Description |
|-------|--------|-------------|
| `fi_card_type` | `card.cardType` | API card type (100–103) |
| `fi_card_sub_type` | `card.cardSubType` | Building subtype |
| `fi_listing_type` | `meta.listingType` | 1=freehold, 3=housing company share, 4=rental |
| `fi_contract_type` | `meta.contractType` | Contract type number |
| `fi_property_type_name` | derived | Finnish type name (Kerrostalo, Rivitalo, etc.) |
| `fi_room_configuration` | `data.roomConfiguration` | E.g. "3h+k+s" |
| `fi_price_per_sqm` | `data.pricePerSqm` | EUR/m² |
| `fi_vendor_ad_id` | `meta.vendorAdId` | Portal's own ad ID |
| `fi_vendor_company_id` | `meta.vendorCompanyId` | Agency company ID |
| `fi_sell_status` | `meta.sellStatus` | Sale status code |
| `fi_new_development` | `data.newDevelopment` | New build flag |
| `fi_size_min/max` | `data.sizeMin/sizeMax` | Size range for variable units |
| `fi_lot_size` | `data.sizeLot` | Raw lot size value |
| `fi_is_vacation_property` | `cardType === 104` | Houses only |

## Concurrency and Rate Limiting

| Parameter | Value |
|-----------|-------|
| Items per page | 24 |
| Concurrent pages | 10 |
| Delay between page batches | 300ms |
| Delay between card type targets | 1,000ms |
| Request timeout | 30,000ms |
| Ingest chunk size | 500 listings per API call |

## Ingest Adapter

Posts to `POST /api/v1/properties/bulk-ingest` on the Finland ingest service.

- Default URL: `http://ingest-finland:3000`
- Override with env var: `INGEST_API_URL`
- API key resolution order:
  1. `INGEST_API_KEY_OIKOTIE_FI`
  2. `INGEST_API_KEY`
  3. Hardcoded fallback: `dev_key_fi_1`
- Retry: up to 3 attempts with exponential backoff + jitter (max 30s delay)
- Retryable: 5xx responses and HTTP 429; non-retryable: 4xx client errors

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{ status: "healthy", scraper: "oikotie-fi", version: "1.0.0" }` |
| `POST` | `/scrape` | Triggers scrape run asynchronously; returns 202 immediately |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8230` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-finland:3000` | Ingest service URL |
| `INGEST_API_KEY` | `dev_key_fi_1` | Bearer token for ingest API |
| `INGEST_API_KEY_OIKOTIE_FI` | — | Portal-specific key (takes priority) |
| `MAX_RETRIES` | `3` | Max ingest retry attempts |
| `INITIAL_RETRY_DELAY` | `1000` | Initial retry delay in ms |
| `INGEST_TIMEOUT` | `60000` | Axios timeout for ingest calls in ms |

## Docker

The Dockerfile uses a multi-stage build. Build context must be the monorepo root (not the scraper directory) because `shared-components` is a sibling dependency.

```bash
# Build from monorepo root
docker build -f scrapers/Finland/oikotie-fi/Dockerfile -t oikotie-fi .

# Run
docker run -p 8230:8230 \
  -e INGEST_API_URL=http://ingest-finland:3000 \
  -e INGEST_API_KEY=your_key \
  oikotie-fi
```

Health check: `GET /health` every 30s, 3s timeout, 3 retries.

## File Structure

```
scrapers/Finland/oikotie-fi/
├── Dockerfile
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md
└── src/
    ├── index.ts                          # Express server, scrape orchestration
    ├── adapters/
    │   └── ingestAdapter.ts              # POST to ingest API with retry
    ├── scrapers/
    │   └── listingsScraper.ts            # Auth token fetch + pagination + streaming
    ├── transformers/
    │   ├── index.ts                      # Category router (transformOikotieCard)
    │   ├── shared.ts                     # Parse helpers, buildLocation/Media/PortalId
    │   ├── apartments/
    │   │   └── apartmentTransformer.ts   # → ApartmentPropertyTierI
    │   ├── houses/
    │   │   └── houseTransformer.ts       # → HousePropertyTierI
    │   ├── land/
    │   │   └── landTransformer.ts        # → LandPropertyTierI
    │   └── commercial/
    │       └── commercialTransformer.ts  # → CommercialPropertyTierI
    ├── types/
    │   └── oikotieTypes.ts               # OikotieCard, OikotieSearchResponse, etc.
    └── utils/
        ├── categoryDetector.ts           # detectCategory(), detectTransactionType()
        └── userAgents.ts                 # Random UA rotation (6 browser strings)
```

## Triggering a Scrape

```bash
# Trigger scrape (returns 202 immediately, runs async)
curl -X POST http://localhost:8230/scrape

# Check health
curl http://localhost:8230/health

# View Prometheus metrics
curl http://localhost:8230/metrics
```

## Known Limitations

- **Amenity fields unavailable in search cards:** `has_elevator`, `has_balcony`, `has_parking`, `has_basement` are all hardcoded to `false` for apartments and commercial. Oikotie only exposes these fields on individual listing detail pages, which would require a separate detail-fetch phase.
- **Single-phase scrape:** The scraper uses search result cards only (no detail-fetch step), so fields like full descriptions and amenities are incomplete. A two-phase approach (search IDs → detail fetch) could unlock more data at the cost of significantly more requests.
- **Auth token sensitivity:** If Oikotie changes the meta tag names (`api-token`, `loaded`, `cuid`) or the Angular app structure, token extraction will fail and the entire run will error. Monitor for `Failed to extract meta tag` errors.
- **No checksum/deduplication:** Every run fetches and ingests all ~88,000 listings. Implementing checksum comparison before ingestion (as done for Czech scrapers) could reduce ingest API load by 80–90% on stable periods.
