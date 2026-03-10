# tori-fi Scraper (Oikotie)

Scraper for **asunnot.oikotie.fi** — the Finnish real estate portal operated by Schibsted. Tori.fi redirects all property listings to Oikotie, which is the actual data source.

Covers all four major listing categories (apartment, house, land, commercial) across both sale and rent transaction types.

---

## Overview

| Property | Value |
|----------|-------|
| Portal | Oikotie (`asunnot.oikotie.fi`) |
| Country | Finland |
| `source_platform` | `oikotie` |
| Port | `8233` |
| Listing volume | ~127k active listings (54k residential-sale, 29k residential-rent, 2.7k commercial-sale, 41k commercial-rent) |
| Scrape frequency | On-demand via `POST /scrape` |

---

## Architecture

```
GET /scrape
    └── scrapeAllListings()
            ├── fetchAuthHeaders()        # GET HTML, parse OTA meta tags
            └── for each cardType [100, 101, 105, 106]:
                    └── scrapeCardType()  # paginate at 100/req, 500ms delay
                            └── onBatch callback
                                    ├── transformCard()   # route to category transformer
                                    ├── detectCategory()  # classify card → apartment/house/land/commercial
                                    └── buffer → sendBatch() (every 500 listings)
```

This is a **single-phase scraper**: the Oikotie search API returns full listing data in the search response — no separate detail-page fetch is required.

---

## Authentication

Oikotie's API requires three session-derived headers that are embedded as `<meta>` tags in the server-rendered HTML page:

| Header | Meta tag name | Description |
|--------|--------------|-------------|
| `OTA-token` | `api-token` | Session API token |
| `OTA-loaded` | `loaded` | Server load timestamp |
| `OTA-cuid` | `cuid` | Client UID |

**Flow:**
1. `GET https://asunnot.oikotie.fi/myytavat-asunnot` — fetch the HTML listing page
2. Extract the three meta tag values via regex
3. Pass them as headers on all subsequent API calls

Auth headers are fetched once per scrape run. If a `401` response is encountered mid-scrape, headers are automatically refreshed and the failing card type is retried once.

---

## Card Types

The Oikotie API is segmented by `cardType`, which encodes both listing type and transaction type:

| cardType | Description | Volume |
|----------|-------------|--------|
| `100` | Residential for sale | ~54k |
| `101` | Residential for rent | ~29k |
| `105` | Commercial for sale | ~2.7k |
| `106` | Commercial for rent | ~41k |

Within residential card types, `cardSubType` further identifies the property type:

| cardSubType | Finnish term | Landomo category |
|-------------|-------------|-----------------|
| `1` | Kerrostalo (apartment building) | `apartment` |
| `2` | Rivitalo / paritalo (rowhouse) | `house` |
| `4` | Omakotitalo (detached house) | `house` |
| `5` | Tontti (land plot) | `land` |
| `8` | Toimitila (commercial premises) | `commercial` |
| `64` | Paritalo (semi-detached, own title) | `house` |

---

## Category Detection

`src/utils/categoryDetector.ts` implements `detectCategory(card)`:

1. `cardType === 105 || 106` → `commercial`
2. `cardSubType === 8` → `commercial` (commercial sub-type in residential card)
3. `cardSubType === 5` → `land`
4. `sizeLot > 0 && sizeMin == null` → `land` (heuristic: has plot but no living area)
5. `cardSubType === 2 || 4 || 64` → `house`
6. Default → `apartment`

Transaction type is determined separately: cardTypes `101`, `103`, `106` → `rent`; all others → `sale`.

---

## Transformers

Each category has a dedicated transformer under `src/transformers/`:

### Apartment (`apartmentTransformer.ts`)

Handles `cardSubType=1` (kerrostalo). Feature detection uses heuristics since amenity booleans are not present in the search API response:

| Landomo field | Source |
|---------------|--------|
| `bedrooms` | `rooms - 1` |
| `sqm` | Parsed from `data.size` (first number, handles "125/162 m²") |
| `floor` / `total_floors` | `data.floor` / `data.buildingFloorCount` |
| `has_balcony` | `roomConfiguration` contains `parveke`, `parv`, `terassi`, `terr` |
| `has_parking` | `roomConfiguration` contains `autotalli`, `at`, `autopaikka` or `description` contains `autopaikka` |
| `has_elevator` | `description` or `roomConfiguration` contains `hissi` |
| `has_basement` | `roomConfiguration`/`description` contains `varasto`, `var`, `kellari` |
| `year_built` | `data.buildYear` |
| `condition` | `'new'` when `data.newDevelopment === true` |

Title format: `"{sqm} m², {roomConfiguration}, {city}"` or `"{rooms}h, {sqm} m², {city}"`.

### House (`houseTransformer.ts`)

Handles `cardSubType` 2 (rivitalo), 4 (omakotitalo), 64 (paritalo).

| Landomo field | Source |
|---------------|--------|
| `sqm_living` | Parsed from `data.size` |
| `sqm_plot` | `data.sizeLot` (0 if null) |
| `has_garden` | `sizeLot != null && sizeLot > 0` |
| `has_garage` | `roomConfiguration`/`description` contains `autotalli` |
| `has_parking` | `has_garage` OR contains `autopaikka` |
| `has_basement` | Contains `kellari`, `var`, `varasto` |

Title format: `"{sqm} m², {rooms}h, {subtypeLabel}, {city}"`.

### Land (`landTransformer.ts`)

Handles `cardSubType=5` and the lot-size heuristic.

| Landomo field | Source |
|---------------|--------|
| `area_plot_sqm` | `data.sizeLot` (primary), falls back to parsed `data.size` |

Title format: `"Tontti {area} m², {city}"` or `"Tontti {area} ha, {city}"` for plots >= 1 ha.

### Commercial (`commercialTransformer.ts`)

Handles `cardType` 105 and 106.

| Landomo field | Source |
|---------------|--------|
| `sqm_total` | Parsed from `data.size` |
| `has_parking` | Contains `autopaikka` or `autotalli` |
| `has_elevator` | Contains `hissi` |
| `has_bathrooms` | Contains `wc`, `ph`, `wc-tilat` |

Title format: `"Toimitila {sqm} m², {district}, {city}"`.

---

## Field Mapping Reference

All transformers populate the following common fields:

| Landomo field | Oikotie source |
|---------------|---------------|
| `portal_id` | `String(card.cardId)` |
| `source_url` | `card.url` |
| `source_platform` | `'oikotie'` (hardcoded) |
| `status` | `'active'` (hardcoded) |
| `currency` | `'EUR'` (hardcoded) |
| `price` | Parsed from `data.price` string (strips "€", "/ kk", thousands spaces) |
| `location.country` | `'Finland'` (hardcoded) |
| `location.city` | `location.city` |
| `location.region` | `location.district` |
| `location.address` | `location.address` |
| `location.postal_code` | `location.zipCode` |
| `location.coordinates` | `{lat, lon}` when both are non-null |
| `published_date` | `meta.published` |
| `description` | `data.description` |
| `images` | `medias[].imageLargeJPEG` |

### `country_specific` JSONB (all categories)

```jsonc
{
  "card_id": 12345678,
  "card_type": 100,
  "card_sub_type": 1,
  "room_configuration": "3h+k+s+parv",
  "maintenance_fee": 195,         // vastike EUR/month
  "size_lot": null,               // apartments only
  "price_per_sqm": 3200,
  "new_development": false,
  "vendor_ad_id": "...",
  "vendor_company_id": "...",
  "sell_status": null,
  "listing_type": 1
}
```

---

## Pagination

- Page size: `100` (Oikotie's maximum, `MAX_PAGE_SIZE`)
- First page fetched to determine total count (`found` field)
- Subsequent pages use `offset` incremented by actual cards returned (not fixed page size) to handle last-page edge cases
- Empty page response stops pagination
- Between pages: 500 ms delay (configurable via `REQUEST_DELAY_MS` env var)
- Between card types: 2 000 ms fixed delay

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8233` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-finland:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_fi_1` | Bearer token for ingest API |
| `INSTANCE_COUNTRY` | `fi` | Country code sent to ingest service |
| `BATCH_SIZE` | `500` | Property buffer size before flush |
| `REQUEST_DELAY_MS` | `500` | Delay between pagination requests (ms) |

---

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{ status: "healthy", scraper: "oikotie", ... }` |
| `POST` | `/scrape` | Triggers a full scrape run asynchronously, returns `202` immediately |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

---

## Ingest Adapter

`src/adapters/ingestAdapter.ts` posts batches to `POST /api/v1/properties/bulk-ingest`.

Retry policy: up to 3 attempts with exponential backoff (1 s, 2 s, 4 s). Client errors (4xx) are not retried.

---

## Docker

Build context is the repository root. The Dockerfile uses a multi-stage build:

1. **Builder** — compiles `shared-components` and the scraper TypeScript
2. **Runtime** — production-only `node_modules`, exposes port `8233`

Health check polls `GET /health` every 30 s with a 3 s timeout (10 s start period, 3 retries).

```bash
# Build (from repository root)
docker build -f scrapers/Finland/tori-fi/Dockerfile -t landomo/scraper-tori-fi .

# Run
docker run -p 8233:8233 \
  -e INGEST_API_URL=http://ingest-finland:3000 \
  -e INGEST_API_KEY=<key> \
  landomo/scraper-tori-fi

# Trigger scrape
curl -X POST http://localhost:8233/scrape
```

---

## Source Layout

```
scrapers/Finland/tori-fi/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                              # Express server, scrape orchestration
│   ├── adapters/
│   │   └── ingestAdapter.ts                  # POST bulk-ingest with retry
│   ├── scrapers/
│   │   └── listingsScraper.ts                # Auth fetch, pagination, card type loop
│   ├── transformers/
│   │   ├── index.ts                          # Route card → category transformer
│   │   ├── apartments/apartmentTransformer.ts
│   │   ├── houses/houseTransformer.ts
│   │   ├── land/landTransformer.ts
│   │   └── commercial/commercialTransformer.ts
│   ├── types/
│   │   └── toriTypes.ts                      # OikotieCard, OikotieApiResponse interfaces
│   └── utils/
│       ├── categoryDetector.ts               # detectCategory, parsePrice, parseSqm
│       └── userAgents.ts                     # Random UA pool (5 entries)
└── docs/
    └── README.md
```

---

## Known Limitations

- **No amenity booleans in search API**: `has_elevator`, `has_balcony`, `has_parking`, and `has_basement` are inferred via keyword matching on `roomConfiguration` and `description` strings. False negatives are possible when these fields are absent or use non-standard abbreviations.
- **Single-phase only**: Detail page data (full floor plan, energy certificate, exact amenity list) is not fetched. Extending to a two-phase approach would require additional HTTP requests per listing.
- **No checksum mode**: Every scrape run fetches all ~127k listings regardless of what has changed. Implementing checksum-based incremental scraping (as done for BezRealitky) would reduce load significantly.
- **Auth tokens expire**: OTA tokens are session-scoped. The scraper handles a single mid-run expiry with a refresh-and-retry but does not handle repeated expiries within the same run.
