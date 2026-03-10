# danbolig-dk Scraper

Scraper for [danbolig.dk](https://danbolig.dk), one of Denmark's largest real estate portals operated by the Danbolig broker network. Covers all four property categories (apartment, house, land, commercial) and supports both sale and rental listings.

## Overview

| Field | Value |
|---|---|
| Portal | danbolig.dk |
| Country | Denmark |
| Currency | DKK |
| Port | 8204 |
| Categories | apartment, house, land, commercial |
| Transaction types | sale, rent |
| Estimated listings | ~38,000 |
| Scrape duration | ~6-8 minutes (300ms delay, sequential) |
| API type | JSON REST (POST) |

## Architecture

```
index.ts
  └── listingsScraper.ts        # Paginates POST /api/v1/properties/list (30/page, sequential)
        └── transformers/
              ├── index.ts              # Category dispatch via detectCategory()
              ├── factParser.ts         # Parses factsDesktop[] name/value pairs
              ├── apartments/apartmentTransformer.ts
              ├── houses/houseTransformer.ts
              ├── land/landTransformer.ts
              └── commercial/commercialTransformer.ts
        └── utils/
              ├── categoryDetector.ts   # Danish type string → Landomo category
              └── userAgents.ts         # Random UA rotation pool
  └── adapters/ingestAdapter.ts  # POST bulk-ingest with exponential backoff
```

## API

The portal exposes a single JSON endpoint used for all listings:

```
POST https://danbolig.dk/api/v1/properties/list
Content-Type: application/json

{
  "filters": [],
  "orderBy": "relevant",
  "page": 1
}
```

- Returns 30 items per page as a `DanboligListResponse`
- Each response item has a `responseType` field; only `"property"` items are processed (ads are filtered out)
- `totalCount` in the response is used to compute the total number of pages

## HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check, returns `{ status: "healthy" }` |
| POST | `/scrape` | Trigger a full scrape run (async, returns 202 immediately) |

## Scraping Strategy

Pagination is **sequential** with a polite inter-request delay:

1. Fetch page 1 to determine `totalCount` and compute `totalPages = ceil(totalCount / 30)`
2. Iterate pages 2..N with a `REQUEST_DELAY_MS` (default 300ms) sleep between each
3. Each page is passed via `onPage` callback immediately after fetching — properties are never buffered in memory all at once
4. Page errors are logged and skipped (scrape continues to next page)
5. Per-request retry: up to 3 attempts with exponential backoff (`delay * 2^attempt`)

Progress is logged at every 50 pages and on the final page.

## Category Detection

The `type` field in each raw listing is a Danish string. `categoryDetector.ts` maps it to a Landomo category:

| Danish type(s) | Category |
|---|---|
| Lejlighed, Andelsbolig, Ejerlejlighed | apartment |
| Villa, Rækkehus, Fritidsbolig, Liebhaveri, Landejendom, Villa/Fritidsbolig, Villa/Helårsgrund, Helårshus | house |
| Helårsgrund, Sommerhusgrund, Grund, *grund* (substring) | land |
| Erhverv, Erhvervsejendom, Butik, Kontor, Lager | commercial |

Unknown types fall back to `house`.

## Fact Parsing

Each listing includes a `factsDesktop` array of `{ name, label, value }` objects. `factParser.ts` extracts the following known fact names:

| Fact name | Maps to | Notes |
|---|---|---|
| `Price` / `Købspris` | `price` | Danish number format (`.` thousands, `,` decimal) |
| `LivingAreaM2` | `livingAreaM2` | HTML entity `&sup2;` stripped |
| `Rooms` | `rooms` | "5 rum" → 5 |
| `EnergyLabel` | `energyLabel` | "A2015" normalized to "A" |
| `MonthlyPayment` | `monthlyPayment` | Presence indicates rental listing |

Transaction type is inferred: if `monthlyPayment` is present → `rent`, otherwise → `sale`.

## Field Mapping

### Apartment (`ApartmentPropertyTierI`)

| TierI field | Source | Notes |
|---|---|---|
| `property_category` | hardcoded | `"apartment"` |
| `title` | `"{type} {address}, {city}"` | Constructed |
| `price` | `facts.price ?? raw.price` | DKK |
| `currency` | hardcoded | `"DKK"` |
| `transaction_type` | `monthlyPayment` presence | `"sale"` or `"rent"` |
| `location.country` | hardcoded | `"Denmark"` |
| `location.city` | `raw.city` | |
| `location.postal_code` | `raw.zipCode` | String |
| `bedrooms` | `rooms - 1` (min 0) | Danish "rum" includes living room |
| `sqm` | `facts.livingAreaM2 ?? raw.propertySize` | |
| `rooms` | `facts.rooms` | |
| `has_elevator` | `false` | Not in list API |
| `has_balcony` | `false` | Not in list API |
| `has_parking` | `false` | Not in list API |
| `has_basement` | `false` | Not in list API |
| `energy_class` | `facts.energyLabel` | Normalized |
| `images` | `raw.images` | Array of URLs |
| `source_url` | `"https://danbolig.dk" + raw.url` | |
| `source_platform` | hardcoded | `"danbolig-dk"` |
| `portal_id` | `"danbolig-{propertyId}-{brokerId}"` | |
| `status` | `raw.isSold ? "sold" : "active"` | |

### House (`HousePropertyTierI`)

Same mapping as apartment except:

| TierI field | Source | Notes |
|---|---|---|
| `property_category` | hardcoded | `"house"` |
| `sqm_living` | `facts.livingAreaM2 ?? raw.propertySize` | |
| `sqm_plot` | `0` | Not available in list API |
| `has_garden` | `false` | Not in list API |
| `has_garage` | `false` | Not in list API |

### Land (`LandPropertyTierI`)

| TierI field | Source | Notes |
|---|---|---|
| `property_category` | hardcoded | `"land"` |
| `area_plot_sqm` | `facts.livingAreaM2 ?? raw.propertySize` | `propertySize` used as plot area for land |

### Commercial (`CommercialPropertyTierI`)

| TierI field | Source | Notes |
|---|---|---|
| `property_category` | hardcoded | `"commercial"` |
| `sqm_total` | `facts.livingAreaM2 ?? raw.propertySize` | |
| `has_elevator` | `false` | Not in list API |
| `has_parking` | `false` | Not in list API |
| `has_bathrooms` | `false` | Not in list API |

### `country_specific` JSONB (all categories)

| Key | Source |
|---|---|
| `property_type_danish` | `raw.type` |
| `broker_id` | `raw.brokerId` |
| `property_id` | `raw.propertyId` |
| `is_new` | `raw.isNew` |
| `has_new_price` | `raw.hasNewPrice` |
| `is_under_sale` | `raw.isUnderSale` |
| `sold_date` | `raw.soldDate` |
| `open_house` | `raw.openHouse` |
| `open_house_signup_required` | `raw.openHouseSignupRequired` |
| `is_danbolig` | `raw.isDanbolig` |
| `is_luxurious` | `raw.luxurious` |
| `zip_code` | `raw.zipCode` |
| `monthly_payment` | `facts.monthlyPayment` |

## Portal ID Format

```
danbolig-{propertyId}-{brokerId}
```

Example: `danbolig-0870001262-087`

The raw URL (e.g. `/bolig/koebenhavn/2200/lejlighed/0870001262-087/`) contains both IDs, and the portal ID mirrors the unique combination used by the portal.

## Batch Ingestion

Properties are accumulated in a rolling in-memory batch and flushed to the ingest API when `BATCH_SIZE` (default 500) is reached. Remaining items are force-flushed after all pages are processed.

The ingest adapter (`ingestAdapter.ts`) sends to:

```
POST {INGEST_API_URL}/api/v1/properties/bulk-ingest
Authorization: Bearer {INGEST_API_KEY}
```

Retry policy: up to 3 attempts with exponential backoff (1s, 2s). 4xx errors (except 429) are not retried.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8204` | HTTP server port |
| `BATCH_SIZE` | `500` | Properties per ingest batch |
| `REQUEST_DELAY_MS` | `300` | Delay between paginated requests (ms) |
| `INGEST_API_URL` | `http://ingest-denmark:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_dk_1` | API key for ingest service |
| `INSTANCE_COUNTRY` | `dk` | Country identifier passed to ingest API |

## Docker

Built from the repo root with build context `../../..` (monorepo root):

```dockerfile
FROM node:20-alpine AS builder
# Builds shared-components first, then the scraper
EXPOSE 8204
HEALTHCHECK GET /health
CMD ["npm", "start"]
```

The multi-stage build copies only production artifacts into the final image.

## Running Locally

```bash
# Install deps (requires shared-components built first)
cd shared-components && npm ci && npm run build && cd -
cd scrapers/Denmark/danbolig-dk && npm install

# Dev mode (ts-node)
npm run dev

# Production build
npm run build && npm start

# Trigger scrape
curl -X POST http://localhost:8204/scrape

# Health check
curl http://localhost:8204/health
```

## Known Limitations

- **Boolean amenity fields** (`has_elevator`, `has_balcony`, `has_garden`, `has_garage`, `has_parking`, `has_basement`, `has_bathrooms`) are always `false` because the list API does not return this data. A detail-page fetch phase would be needed to populate them accurately.
- **Plot size for houses** (`sqm_plot`) is always `0` for the same reason.
- **No checksum optimization**: every scrape fetches all pages from scratch. Implementing checksum-based skip logic (as done for Czech scrapers) could reduce API calls by 60-80% on stable periods.
- **No parallel fetching**: pages are fetched sequentially. Concurrency could reduce scrape time from ~7 minutes to ~1-2 minutes at the cost of higher server load.
- **Address is street only**: `location` does not include a `street` or `district` sub-field beyond what is embedded in the title string.
