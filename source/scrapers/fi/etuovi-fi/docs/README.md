# Etuovi.fi Scraper

Scraper for [Etuovi.com](https://www.etuovi.com), Finland's major real estate portal. Etuovi.com is owned by Alma Media and shares its listing infrastructure with [asunnot.oikotie.fi](https://asunnot.oikotie.fi). The underlying search API is the Oikotie API.

## Overview

| Field | Value |
|-------|-------|
| Portal | `etuovi` |
| Country | Finland (`fi`) |
| API Base | `https://asunnot.oikotie.fi` |
| Default Port | `8231` |
| Categories | apartment, house, land, commercial |
| Transport | HTTP JSON (Oikotie search API) |
| Auth | Session cookies + OTA meta-tag tokens |

## Architecture

```
index.ts (Express)
  └── ListingsScraper.scrapeAll()        # Streams batches per card type
        └── scrapeCardType()             # Parallel page fetching
              └── fetchSessionAuth()     # Fetch OTA token + cookies from page HTML
              └── fetchPage()            # GET /api/search?cardType=...
  └── transformOikotieToStandard()       # Routes to category transformer
        ├── detectCategory()             # cardType + cardSubType → category
        ├── transformOikotieApartment()
        ├── transformOikotieHouse()
        ├── transformOikovieLand()
        └── transformOikotieCommercial()
  └── IngestAdapter.sendProperties()     # POST /api/v1/properties/bulk-ingest
```

## Source Files

```
src/
├── index.ts                              # Express server + runScraper() orchestrator
├── scrapers/listingsScraper.ts           # HTTP fetch logic + pagination
├── transformers/
│   ├── index.ts                          # Entry point, routes to category transformers
│   ├── shared.ts                         # Shared parse/map helpers
│   ├── apartments/apartmentTransformer.ts
│   ├── houses/houseTransformer.ts
│   ├── land/landTransformer.ts
│   └── commercial/commercialTransformer.ts
├── adapters/ingestAdapter.ts             # Ingest API client with retry
├── types/etuoviTypes.ts                  # Oikotie API type definitions
└── utils/
    ├── categoryDetector.ts               # cardType + cardSubType → category
    └── userAgents.ts                     # Random user agent pool
```

## Authentication

The Oikotie API requires session authentication obtained by loading the search page HTML before each card type scrape. Three values are extracted from HTML meta tags:

| Header | Source |
|--------|--------|
| `OTA-token` | `<meta name="api-token" content="...">` |
| `OTA-loaded` | `<meta name="loaded" content="...">` |
| `OTA-cuid` | `<meta name="cuid" content="...">` |
| `Cookie` | `Set-Cookie` response headers (PHPSESSID, user_id, AWSALB, AWSALBCORS) |

Session tokens are refreshed every 500 pages (configurable) to prevent expiry during long scrape runs.

## Card Types (Property Categories)

The Oikotie API uses a `cardType` integer to categorize listings. This scraper covers:

| Card Type | Finnish URL segment | Category scraped |
|-----------|--------------------|--------------------|
| `100` | `myytavat-asunnot` | Sale properties (apartments + houses, split by `cardSubType`) |
| `101` | `vuokra-asunnot` | Rental properties (apartments + houses, split by `cardSubType`) |
| `104` | `myytavat-tontit` | Land / plots for sale |
| `105` | `myytavat-toimitilat` | Commercial properties |

Holiday/cottage properties (`cardType=102`) and other rentals (`cardType=103`) are defined in the type system but not enabled by default. Override with the `ETUOVI_CARD_TYPES` environment variable.

## Building Sub-Type to Category Mapping

For `cardType` 100 and 101, the `cardSubType` bitmask determines whether a listing is an apartment or a house:

| `cardSubType` | Finnish name | Category |
|--------------|--------------|----------|
| `1` | Kerrostalo (apartment block) | apartment |
| `2` | Rivitalo (row house) | house |
| `4` | Omakotitalo (detached house) | house |
| `8` | Paritalo (semi-detached) | house |
| `16` | Luhtitalo (corridor-access block) | apartment |
| `32` | Erillistalo (detached block of flats) | house |
| `64` | Puutalo-osake (wooden apartment building share) | apartment |
| `256` | Muu (other) | apartment (default) |

House bits: `2 | 4 | 8 | 32`. If any house bit is set, the listing becomes a house regardless of apartment bits present.

## Scraping Strategy

1. For each enabled card type, fetch the search page HTML to acquire session auth.
2. Fetch the first page (`offset=0`) to get the total listing count.
3. Calculate remaining pages and fetch them in parallel batches of up to 10 concurrent requests.
4. Wait 500 ms between concurrent batches to respect rate limits.
5. Wait 1000 ms between card types.
6. Each batch of raw cards is immediately streamed to the ingest API (no accumulation in memory beyond a single batch).
7. Chunks of up to 500 properties per ingest API call.

Page size is fixed at 24 listings per page (Oikotie API default).

## Field Mapping

### Apartment (`ApartmentPropertyTierI`)

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'apartment'` |
| `title` | `data.description` | Falls back to `"{buildingType} - {city}"` |
| `price` | `data.price` (string) | Parsed from e.g. `"297 000 €"` |
| `currency` | constant | `'EUR'` |
| `transaction_type` | `meta.contractType` | `1` = sale, `2` = rent |
| `bedrooms` | `data.rooms - 1` | Finnish rooms include kitchen; minimum 0 |
| `sqm` | `data.sizeMin` or `data.size` (string) | Parses e.g. `"83 m²"` |
| `floor` | `data.floor` | |
| `total_floors` | `data.buildingFloorCount` | |
| `rooms` | `data.rooms` | Total room count |
| `has_elevator` | `false` | Not exposed in list API |
| `has_balcony` | room config contains `parveke` or `terassi` | |
| `has_parking` | room config contains `autotalli`, `autopaikka`, or `autokatos` | |
| `has_basement` | room config contains `kellari` | |
| `year_built` | `data.buildYear` | |
| `condition` | `data.condition` (string) | Mapped to enum |
| `hoa_fees` | `data.maintenanceFee` | Monthly maintenance fee in EUR |
| `deposit` | `data.securityDeposit` | |
| `images` | `medias[]` | Desktop WebP preferred, large JPEG fallback |
| `location.address` | `location.address` | |
| `location.city` | `location.city` | |
| `location.region` | `location.district` | |
| `location.postal_code` | `location.zipCode` | |
| `location.coordinates` | `location.latitude/longitude` | |
| `source_url` | `card.url` | |
| `source_platform` | constant | `'etuovi'` |
| `portal_id` | `etuovi-{cardId}` | |
| `published_date` | `meta.published` | |
| `status` | constant | `'active'` |

### House (`HousePropertyTierI`)

Same as apartment, with these differences:

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'house'` |
| `sqm_living` | `data.sizeMin` or `data.size` | Living area |
| `sqm_plot` | `data.sizeLot` | Lot size in m² |
| `stories` | `data.buildingFloorCount` | |
| `has_garden` | `sqm_plot > 0` | |
| `has_garage` | room config contains `autotalli` or `garage` | |
| `has_terrace` | room config contains `terassi` or `parveke` | |

### Land (`LandPropertyTierI`)

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'land'` |
| `title` | `data.description` | Falls back to `"Tontti - {city}"` |
| `area_plot_sqm` | `data.sizeLot` or `data.sizeMin` or parsed `data.size` | |

### Commercial (`CommercialPropertyTierI`)

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'commercial'` |
| `title` | `data.description` | Falls back to `"Toimitila - {city}"` |
| `sqm_total` | `data.sizeMin` or parsed `data.size` | |
| `has_elevator` | `false` | Not exposed in list API |
| `has_parking` | room config contains parking keywords | |
| `has_bathrooms` | room config contains `wc` or `kph` | |
| `operating_costs` | `data.maintenanceFee` | |

## Finland-Specific Fields (`country_specific`)

All categories include these Finland-specific JSONB fields:

| Field | Type | Description |
|-------|------|-------------|
| `fi_building_type` | string | Finnish building type label (e.g. `Kerrostalo`, `Omakotitalo`) |
| `fi_room_configuration` | string | Raw room config string (e.g. `"2h + k + kph + parveke"`) |
| `fi_new_development` | boolean | Whether the listing is a new development |
| `fi_price_per_sqm` | number | Price per square metre in EUR |
| `fi_maintenance_fee` | number | Monthly maintenance fee in EUR |
| `fi_card_id` | number | Raw Oikotie card ID |
| `fi_vendor_id` | string | Portal vendor/agent ad ID |

Note: `fi_room_configuration` and `fi_maintenance_fee` are not populated for land and commercial listings.

## Condition Mapping

Finnish condition strings are mapped to the standardized enum:

| Finnish term | Standardized value |
|-------------|-------------------|
| `uusi` / `new` | `new` |
| `erinomainen` / `excellent` | `excellent` |
| `hyva` / `good` | `good` |
| `remontoitu` / `renovated` | `after_renovation` |
| `remontti` / `requires` | `requires_renovation` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8231` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-finland:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_fi_1` | Bearer token for ingest API |
| `ETUOVI_CARD_TYPES` | `100,101,104,105` | Comma-separated card type IDs to scrape |
| `MAX_RETRIES` | `3` | Maximum ingest retry attempts |
| `INITIAL_RETRY_DELAY` | `1000` | Initial retry delay in ms (exponential backoff) |
| `INGEST_TIMEOUT` | `60000` | Ingest request timeout in ms |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check; returns `200` with status JSON |
| `POST` | `/scrape` | Trigger a scrape run; returns `202` immediately, runs async |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

## Running

### Docker (recommended)

The build context is the repository root (`../../..` relative to the scraper directory). The Dockerfile performs a multi-stage build, first building `shared-components`, then the scraper.

```bash
# From repository root
docker build \
  -f scrapers/Finland/etuovi-fi/Dockerfile \
  -t landomo-scraper-etuovi-fi \
  .

docker run -d \
  -p 8231:8231 \
  -e INGEST_API_URL=http://ingest-finland:3000 \
  -e INGEST_API_KEY=your_key \
  landomo-scraper-etuovi-fi
```

### Local Development

```bash
cd scrapers/Finland/etuovi-fi
npm install
npm run dev
```

Then trigger a scrape:

```bash
curl -X POST http://localhost:8231/scrape
```

## Ingest Flow

1. `POST /scrape` returns `202` immediately.
2. `runScraper()` starts async, creates a `ScrapeRunTracker` run.
3. `ListingsScraper.scrapeAll(streamBatch)` is called with a streaming callback.
4. As each concurrent page batch completes, `streamBatch` is called.
5. Each batch is transformed, chunked to 500, and sent to `POST /api/v1/properties/bulk-ingest`.
6. The ingest adapter retries on HTTP 5xx or 429 with exponential backoff + jitter (max 30 s).
7. On completion, `ScrapeRunTracker.complete()` is called with summary counts.
8. On failure, `ScrapeRunTracker.fail()` is called and the error is logged.

## Portal ID Format

```
etuovi-{cardId}
```

Example: `etuovi-18234521`

## Known Limitations

- `has_elevator` is always `false` for apartments and commercial listings. The list API does not expose elevator information; it would require fetching the detail page per listing.
- Amenity inference for `has_balcony`, `has_parking`, `has_basement`, `has_garage`, and `has_terrace` relies on parsing the Finnish `roomConfiguration` string. Listings with non-standard or missing room configuration strings may miss these flags.
- `cardSubType` bitmask combinations are resolved with a house-first priority: if any house bit is set, the listing is classified as a house.
- Holiday/cottage rentals (`cardType=103`) and holiday/cottage sales (`cardType=102`) are defined in `CARD_TYPES` but `102` maps to house and `103` to commercial; neither is enabled by default.
