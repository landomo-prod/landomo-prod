# hybel-no Scraper

Scraper for [hybel.no](https://www.hybel.no), Norway's dedicated rental housing portal. Covers the full national listing inventory (all of Norway) and produces `apartment` and `house` category records in the Landomo three-tier schema.

## Overview

| Property | Value |
|----------|-------|
| Portal | hybel.no |
| Country | Norway |
| Currency | NOK |
| Transaction type | Rent only |
| Categories produced | `apartment`, `house` |
| Port | 8211 |
| Package name | `@landomo/scraper-hybel-no` |

## Architecture

The scraper follows the standard Landomo two-phase pattern:

```
Phase 1: Listing pages (paginated)
  GET /bolig-til-leie/Norge/?page=N
  → HybelListingSummary[]  (id, url, title, address, price, image, housing type)

Phase 2: Detail pages (concurrent, p-limit controlled)
  GET /bolig-til-leie/{id}-{slug}
  → HybelListingDetail     (full fields: sqm, rooms, bedrooms, amenities, coords, images …)

Phase 3: Transform + Ingest
  detectCategory(housingTypeRaw) → 'apartment' | 'house'
  transformApartment / transformHouse → TierI schema
  POST /api/v1/properties/bulk-ingest  (batches of 500)
```

## Directory Structure

```
scrapers/Norway/hybel-no/
├── Dockerfile
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md                          # this file
└── src/
    ├── index.ts                           # Express server, scrape orchestration
    ├── scrapers/
    │   └── listingsScraper.ts             # HTML fetch + cheerio parsing
    ├── transformers/
    │   ├── index.ts                       # Category router
    │   ├── apartments/
    │   │   └── apartmentTransformer.ts    # → ApartmentPropertyTierI
    │   └── houses/
    │       └── houseTransformer.ts        # → HousePropertyTierI
    ├── adapters/
    │   └── ingestAdapter.ts               # Batched POST to ingest API
    ├── types/
    │   └── hybelTypes.ts                  # HybelListingSummary, HybelListingDetail
    └── utils/
        ├── categoryDetector.ts            # Category detection + parse helpers
        └── userAgents.ts                  # Rotating User-Agent headers
```

## Data Flow

### Phase 1 — Listing Summaries

`fetchAllListingSummaries()` fetches `https://www.hybel.no/bolig-til-leie/Norge/?page=N` sequentially with a configurable delay between pages.

The first page is fetched to determine the total listing count (parsed from `<strong>N</strong> treff`) and total page count (from `.pagination-hybel` text). Subsequent pages follow with a 500 ms delay (configurable via `REQUEST_DELAY_MS`).

Each listing card (`a.card.card-listing`) yields a `HybelListingSummary`:

| Field | Source |
|-------|--------|
| `id` | `id` attribute of the card element |
| `url` | `href` attribute, prefixed with `https://www.hybel.no` |
| `title` | `.card-title` text |
| `address` | First `<p>` text |
| `priceRaw` | `.listing-price` text |
| `imageUrl` | `img.card-img-top[src]` |
| `housingTypeRaw` | `img.card-img-top[alt]` (e.g. "Leilighet", "Hybel") |
| `isPremium` | Presence of `.badge-premium` |

### Phase 2 — Listing Details

`fetchListingDetails()` fetches all detail pages concurrently, limited to 5 simultaneous requests (configurable via `DETAIL_CONCURRENCY`). Each request adds a jittered delay of `REQUEST_DELAY_MS + rand(0–200) ms`.

`fetchListingDetail()` parses the following from each detail page:

**Structured fields** (from `.overview ul li` key/value pairs):

| Norwegian field key | Mapped to |
|--------------------|-----------|
| `Areal` | `sqm` |
| `Antall rom` | `rooms` |
| `Antall soverom` | `bedrooms` |
| `Etasje` | `floor` (via `parseFloor`) |
| `Månedsleie` | `monthlyRent` (via `parsePrice`) |
| `Depositum` | `deposit` (via `parsePrice`) |
| `Inkludert` | `utilitiesIncluded` (comma-split) |
| `Ledig fra` | `availableFrom` (via `parseNorwegianDate`) |
| `Leieperiode` | `leaseType` |
| `Boligtype` | `boligtype` |

**Location:**
- Full address parsed from `.map-address span` (format: `Street, PostalCode City`)
- Coordinates extracted from Google Maps embed `<iframe title="Kartposisjon">` `src` attribute (`q=lat%2Clng`)

**Amenities** (from `ul.amenities` text, Norwegian keyword matching):

| Flag | Norwegian keyword(s) |
|------|----------------------|
| `hasBroadband` | bredbånd |
| `hasWashingMachine` | vaskemaskin |
| `hasDishwasher` | oppvask |
| `hasParking` | parkering, garasje |
| `hasFurnished` | møblert |
| `hasElevator` | heis |
| `hasBalcony` | balkong |
| `hasTerrace` | terrasse |
| `hasFireplace` | peis, ildsted |
| `hasGarden` | hage |
| `hasGarage` | garasje |
| `hasBasement` | kjeller |
| `hasWhiteGoods` | hvitevarer |
| `hasBathroom` | always `true` |

**Images:** All `<img>` sources containing `hybel-production` or `s3.amazonaws.com`, with thumbnail size suffixes (`.NxN_qNN.`) stripped to obtain originals. Duplicates are removed.

**Description:** Resolved in order from `h2:contains("Utfyllende informasjon")` sibling, `#description`, or `[class*="description"]`.

**Published date:** `<meta itemprop="datePublished">` content attribute.

### Phase 3 — Category Detection

`detectCategory(housingTypeRaw)` classifies each listing using keyword matching on the housing type string. House keywords take priority; all other types default to apartment.

**House keywords:** `enebolig`, `rekkehus`, `tomannsbolig`, `halvpart`, `fritidsbolig`, `hytte`, `villa`

**Apartment keywords (default):** `leilighet`, `hybel`, `rom i bofellesskap`, `bofellesskap`, `rom`, `sokkel`, `garasjeleilighet`, `studentbolig`

### Phase 3 — Transformation

#### Apartment transformer (`transformApartment`)

Produces `ApartmentPropertyTierI` with `property_category: 'apartment'`.

Bedroom inference logic when `bedrooms` is not directly specified:
- Shared flat types (`bofellesskap`, `rom i`) → `0` bedrooms
- Other types → `rooms - 1` (Norwegian convention: N-roms = N-1 bedrooms + 1 living room)

TierI fields mapped:

| TierI field | Source |
|-------------|--------|
| `price` | `monthlyRent` (0 if null) |
| `currency` | `'NOK'` (hardcoded) |
| `transaction_type` | `'rent'` (hardcoded) |
| `bedrooms` | inferred (see above) |
| `sqm` | `detail.sqm` (0 if null) |
| `rooms` | `detail.rooms` |
| `floor` | `detail.floor` |
| `has_elevator` | `detail.hasElevator` |
| `has_balcony` | `detail.hasBalcony` |
| `has_parking` | `detail.hasParking` |
| `has_basement` | `detail.hasBasement` |
| `has_terrace` | `detail.hasTerrace` |
| `has_garage` | `detail.hasGarage` |
| `furnished` | `'furnished'` if `hasFurnished`, else `undefined` |
| `deposit` | `detail.deposit` |
| `available_from` | `detail.availableFrom` (ISO date) |
| `portal_id` | `hybel-no-{detail.id}` |
| `source_platform` | `'hybel-no'` |
| `location.country` | `'Norway'` |

`country_specific` JSONB:

| Key | Value |
|-----|-------|
| `hybel_id` | Raw listing ID from hybel.no |
| `housing_type_raw` | Raw Norwegian housing type string |
| `boligtype` | `Boligtype` field value from detail page |
| `lease_type` | `Leieperiode` value (e.g. "Langtidsleie") |
| `utilities_included` | Array of included utilities, or null |
| `has_broadband` | boolean |
| `has_washing_machine` | boolean |
| `has_dishwasher` | boolean |
| `has_white_goods` | boolean |
| `is_premium` | boolean |

`features` array: human-readable Norwegian feature labels (e.g. `Bredbånd`, `Vaskemaskin`, `Møblert`, `Inkludert: Internett, Strøm`).

#### House transformer (`transformHouse`)

Produces `HousePropertyTierI` with `property_category: 'house'`.

Identical structure to the apartment transformer with the following differences:

| TierI field | Value |
|-------------|-------|
| `property_category` | `'house'` |
| `sqm_living` | `detail.sqm` (0 if null) |
| `sqm_plot` | `0` (not available on hybel.no) |
| `has_garden` | `detail.hasGarden` |
| `has_garage` | `detail.hasGarage` |

### Phase 3 — Ingest

`sendToIngest()` chunks the transformed properties into batches of 500 (configurable via `INGEST_BATCH_SIZE`) and POSTs each batch to `POST /api/v1/properties/bulk-ingest`.

Failed batches are retried with exponential backoff (up to 4 attempts, capped at 30 s). HTTP 5xx and 429 responses are considered retryable; 4xx are not.

Payload structure per batch:

```json
{
  "portal": "hybel-no",
  "country": "no",
  "properties": [
    {
      "portal_id": "hybel-no-{id}",
      "data": { /* TierI property object */ },
      "raw_data": { /* HybelListingDetail */ }
    }
  ]
}
```

## HTTP API

The scraper exposes an Express server on port `8211`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check. Returns `{ status: "healthy", scraper: "hybel-no", version: "1.0.0" }` |
| `POST` | `/scrape` | Triggers a full scrape run asynchronously. Returns `202` immediately. |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics` from `@landomo/core`) |

## Configuration

All configuration is environment-variable driven.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8211` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-norway:3000` | Base URL of the ingest API |
| `INGEST_API_KEY` | `''` | Bearer token for ingest API authentication |
| `INGEST_BATCH_SIZE` | `500` | Properties per ingest POST request |
| `REQUEST_DELAY_MS` | `500` | Delay between HTTP requests (ms) |
| `DETAIL_CONCURRENCY` | `5` | Max concurrent detail page fetches |

## Docker

The scraper is built with a multi-stage Dockerfile based on `node:20-alpine`.

Build context must be set to the monorepo root (three levels up from the scraper directory) so that `shared-components` is accessible during the builder stage.

```dockerfile
# Stage 1: builder
#   - Builds shared-components
#   - Installs all dependencies
#   - Compiles TypeScript

# Stage 2: runtime
#   - Copies compiled output
#   - Installs production dependencies only
#   - Exposes port 8211
#   - Healthcheck via Node HTTP request to /health
#   - CMD: npm start  →  node dist/hybel-no/src/index.js
```

Docker healthcheck: polls `http://localhost:8211/health` every 30 s with a 3 s timeout, 10 s start period, and 3 retries.

## Parse Utilities

All parsing helpers live in `src/utils/categoryDetector.ts`:

| Function | Input | Output | Notes |
|----------|-------|--------|-------|
| `detectCategory(raw)` | Housing type string | `'apartment'` or `'house'` | House keywords take priority |
| `parsePrice(raw)` | `"28 000,-"` | `28000` or `null` | Strips all non-digits |
| `parseFloor(text)` | `"2. etasje"` | `2` | `kjeller` → `-1`, `loft` → `99` |
| `parseNorwegianDate(str)` | `"01.03.2026"` | `"2026-03-01"` | DD.MM.YYYY → ISO |
| `parseRoomCount(text)` | `"3 roms leilighet"` | `3` | Regex on `\d+ rom` |
| `parseSqm(text)` | `"67m²"` | `67` | Regex on `\d+ m[²2]` |

## User-Agent Rotation

`src/utils/userAgents.ts` cycles through 5 desktop browser User-Agent strings (Chrome macOS, Chrome Windows, Chrome Linux, Safari macOS, Firefox Windows) in round-robin order. All outgoing requests include Norwegian language preference headers (`Accept-Language: nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7`).

## Metrics

The scraper reports the following Prometheus metrics via `@landomo/core`'s `scraperMetrics`:

| Metric | Labels | Description |
|--------|--------|-------------|
| `scrape_run_active` | `portal` | 1 while a run is in progress |
| `scrape_runs_total` | `portal`, `status` | Completed run count (success/failure) |
| `properties_scraped_total` | `portal`, `category`, `result` | Per-result property count |
| `scrape_duration_seconds` | `portal`, `category` | Total scrape wall-clock time |

## Known Limitations

- `sqm_plot` is always `0` for house listings — hybel.no does not publish plot area.
- Coordinates depend on the Google Maps embed being present on the detail page; listings without a map embed will have `lat: null, lng: null`.
- The listing ID is read from the HTML `id` attribute of the card element; if hybel.no changes this attribute the ID extraction will break.
- The scraper fetches all pages sequentially (Phase 1) and does not implement checksum-based skipping — every run fetches all detail pages.
- `listings_updated` is always reported as `0` to the `ScrapeRunTracker`; the ingest API handles UPSERT logic internally.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@landomo/core` | Shared types, logger, `ScrapeRunTracker`, metrics |
| `axios` | HTTP client |
| `cheerio` | Server-side HTML parsing |
| `express` | HTTP server for `/health`, `/scrape`, `/metrics` |
| `p-limit` | Concurrency limiter for detail fetches |
