# finn-no Scraper

Scraper for [finn.no](https://www.finn.no), Norway's largest real estate marketplace. Covers residential sale, residential rental, land/plots, and leisure properties across all of Norway.

## Overview

| Field | Value |
|---|---|
| Portal | `finn-no` |
| Country | Norway (`no`) |
| Default port | `8210` |
| Transport | REST (JSON API — no HTML parsing, no browser required) |
| Property categories | apartment, house, land, commercial |
| Offer types | sale, rent |

## Architecture

```
Express HTTP server (port 8210)
  └── POST /scrape
        └── ListingsScraper.scrapeAll()
              ├── SEARCH_ID_REALESTATE_HOMES       (sale)
              ├── SEARCH_ID_REALESTATE_LETTINGS     (rent)
              ├── SEARCH_ID_REALESTATE_PLOTS        (sale)
              └── SEARCH_ID_REALESTATE_LEISURE_SALE (sale)
                    └── per search key:
                          page 1 → discover total pages
                          pages 2..N → 5 concurrent, 300ms inter-batch delay
                          └── onBatch() → transformFinnListing() → IngestAdapter.sendProperties()
```

## Source Files

```
src/
├── index.ts                              # Express server, runScraper() orchestration
├── scrapers/
│   └── listingsScraper.ts               # Pagination + concurrency logic
├── types/
│   └── finnTypes.ts                     # FinnListing, FinnSearchResponse, FINN_SEARCH_CONFIGS
├── transformers/
│   ├── index.ts                         # Entry point, routes to category transformer
│   ├── shared.ts                        # extractSqm, extractPrice, extractFurnished, etc.
│   ├── apartments/apartmentTransformer.ts
│   ├── houses/houseTransformer.ts
│   ├── land/landTransformer.ts
│   └── commercial/commercialTransformer.ts
├── utils/
│   ├── categoryDetector.ts              # Maps property_type_description → category
│   └── userAgents.ts                    # Random UA rotation pool
└── adapters/
    └── ingestAdapter.ts                 # POST /api/v1/properties/bulk-ingest with retry
```

## API Used

```
GET https://www.finn.no/api/search-qf
  ?searchkey=SEARCH_ID_REALESTATE_HOMES
  &vertical=realestate
  &page=1
```

Returns a JSON object:
```json
{
  "docs": [ /* FinnListing[] */ ],
  "metadata": {
    "result_size": { "match_count": 12500 },
    "paging": { "current": 1, "last": 50 }
  }
}
```

Pagination caps: 50 results per page, 50 pages maximum = 2,500 listings per search key.

## Search Keys

| Search key | Label | Offer type | Maps to categories |
|---|---|---|---|
| `SEARCH_ID_REALESTATE_HOMES` | homes-sale | sale | apartment, house, commercial |
| `SEARCH_ID_REALESTATE_LETTINGS` | lettings | rent | apartment, house, commercial |
| `SEARCH_ID_REALESTATE_PLOTS` | plots-sale | sale | land |
| `SEARCH_ID_REALESTATE_LEISURE_SALE` | leisure-sale | sale | house (cottage), land |

## Category Detection

Category is assigned by `categoryDetector.ts` using two signals: the `main_search_key` and the `property_type_description` (Norwegian text returned by the API).

| Norwegian `property_type_description` | Category | Subtype |
|---|---|---|
| Leilighet | apartment | standard |
| Hybel | apartment | studio |
| Rom i bofellesskap | apartment | studio |
| Leilighet/Hybel | apartment | standard |
| Enebolig | house | detached |
| Rekkehus | house | townhouse |
| Tomannsbolig | house | semi_detached |
| Enebolig, Tomannsbolig | house | semi_detached |
| Hytte | house | cottage |
| Fritidsbolig | house | cottage |
| Villa | house | detached |
| Småbruk/Gårdsbruk | house | detached |
| Tomter | land | — |
| Fritidstomt | land | — |
| Garasje/Parkering | commercial | — |
| Næringseiendom / Næringsbygg | commercial | — |

Fallback rules when `property_type_description` is absent:
- `SEARCH_ID_REALESTATE_HOMES` or `SEARCH_ID_REALESTATE_LETTINGS` → `apartment`
- `SEARCH_ID_REALESTATE_PLOTS` → `land`
- `SEARCH_ID_REALESTATE_LEISURE_SALE` → `house`

## Field Mapping

### Shared utilities (`src/transformers/shared.ts`)

| Utility | Logic |
|---|---|
| `extractSqm` | Prefers `area_range` (averages `size_from`/`size_to` if a true range); falls back to `area.size` |
| `extractPlotSqm` | Reads `area_plot.size` |
| `extractPrice` | Prefers `price_suggestion.amount`; falls back to `price_total.amount`; currency defaults to NOK |
| `extractImages` | Prefers `image_urls[]`; falls back to single `image.url` |
| `buildSourceUrl` | Uses `canonical_url` from the API; constructs fallback URL from `ad_id` |
| `extractFurnished` | Maps Norwegian strings: "Møblert" → `furnished`, "Delvis møblert" → `partially_furnished`, "Umøblert" → `not_furnished` |
| `extractFeatures` | Scans `flags[]` + lowercase `heading` for keywords (balkong, terrasse, heis, garasje, parkering, kjeller, hage, nybygg) |

### Apartment (`ApartmentPropertyTierI`)

| TierI field | Source |
|---|---|
| `bedrooms` | `listing.number_of_bedrooms` (default 0) |
| `sqm` | `extractSqm()` |
| `has_balcony` | heading contains "balkong" or "terrasse" |
| `has_elevator` | heading contains "heis" |
| `has_parking` | heading contains "parkering" or "garasje" |
| `has_basement` | heading contains "kjeller" |
| `furnished` | `extractFurnished(listing.furnished_state)` |
| `property_subtype` | "hybel" or 0 bedrooms → `studio`; heading "penthouse" → `penthouse`; heading "loft" → `loft`; else `standard` |
| `country_specific.no_ownership_type` | `owner_type_description` (e.g. "Eier (Selveier)", "Andel") |
| `country_specific.no_search_key` | `main_search_key` |

### House (`HousePropertyTierI`)

| TierI field | Source |
|---|---|
| `bedrooms` | `listing.number_of_bedrooms` (default 0) |
| `sqm_living` | `extractSqm()` |
| `sqm_plot` | `extractPlotSqm()` |
| `has_garden` | `sqm_plot > 0` OR heading contains "hage"/"tomt" |
| `has_garage` | heading contains "garasje" |
| `has_parking` | `has_garage` OR heading contains "parkering" |
| `has_basement` | heading contains "kjeller"/"underetasje" |
| `property_subtype` | enebolig → `detached`; tomannsbolig → `semi_detached`; rekkehus → `townhouse`; hytte/fritidsbolig → `cottage` |
| `country_specific.no_ownership_type` | `owner_type_description` |
| `country_specific.no_search_key` | `main_search_key` |

### Land (`LandPropertyTierI`)

| TierI field | Source |
|---|---|
| `area_plot_sqm` | `extractPlotSqm()` (reads `area_plot.size`) |
| `country_specific.no_ownership_type` | `owner_type_description` |
| `country_specific.no_search_key` | `main_search_key` |

### Commercial (`CommercialPropertyTierI`)

| TierI field | Source |
|---|---|
| `sqm_total` | `extractSqm()` |
| `has_elevator` | heading contains "heis" |
| `has_parking` | `property_type_description` or heading contains "parkering"/"garasje" |
| `has_bathrooms` | always `false` (not in search results) |
| `country_specific.no_ownership_type` | `owner_type_description` |
| `country_specific.no_search_key` | `main_search_key` |

### Common fields (all categories)

| TierI field | Source |
|---|---|
| `title` | `listing.heading` |
| `price` / `currency` | `extractPrice()` |
| `transaction_type` | `offerType` from search config (`sale` / `rent`) |
| `location.address` | `listing.location` |
| `location.city` | last non-numeric comma-segment of `listing.location` |
| `location.region` | `listing.local_area_name` |
| `location.country` | `"Norway"` (hardcoded) |
| `location.coordinates` | `listing.coordinates.{lat,lon}` |
| `images` / `media.images` | `extractImages()` |
| `features` | `extractFeatures()` |
| `published_date` | `new Date(listing.timestamp).toISOString()` |
| `source_url` | `buildSourceUrl()` |
| `source_platform` | `"finn-no"` |
| `portal_id` | `finn-no-{ad_id}` |
| `status` | `"active"` |

## Pagination and Concurrency

- Page size is fixed at 50 results per page (finn.no controlled).
- The first page is fetched to discover `metadata.paging.last` (capped at 50).
- Pages 2 through N are fetched in concurrent batches of 5 with a 300 ms delay between batches.
- A 1,000 ms delay separates sequential processing of different search keys.
- Each concurrent batch uses `Promise.allSettled` so individual page failures do not abort the entire run.

## Streaming / Batching

The scraper uses a streaming callback pattern: `onBatch()` is invoked after every page (or batch of concurrent pages). This triggers transformation and immediate ingest to the API. Ingest calls are chunked at 2,000 properties per HTTP request to stay within API limits.

## Ingest Adapter

The adapter posts to `POST /api/v1/properties/bulk-ingest` on the Norway ingest API.

| Config | Env var | Default |
|---|---|---|
| API base URL | `INGEST_API_URL` | `http://ingest-norway:3000` |
| API key | `INGEST_API_KEY_FINN_NO` or `INGEST_API_KEY` | `dev_key_no_1` |
| Max retries | `MAX_RETRIES` | `3` |
| Initial retry delay | `INITIAL_RETRY_DELAY` | `1000` ms |
| Request timeout | `INGEST_TIMEOUT` | `60000` ms |

Retry policy: exponential backoff with jitter (`delay = initialDelay * 2^attempt + rand(0..1000) ms`, capped at 30 s). Retryable errors: network errors, HTTP 5xx, HTTP 429.

## HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check; returns `{ status: "healthy", scraper: "finn-no", version: "1.0.0" }` |
| `POST` | `/scrape` | Triggers a full scrape run asynchronously; responds immediately with `202` |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8210` | Listening port |
| `INGEST_API_URL` | No | `http://ingest-norway:3000` | Norway ingest service URL |
| `INGEST_API_KEY` | Yes (prod) | `dev_key_no_1` | Bearer token for ingest API |
| `MAX_RETRIES` | No | `3` | Ingest retry attempts |
| `INITIAL_RETRY_DELAY` | No | `1000` | Initial retry backoff in ms |
| `INGEST_TIMEOUT` | No | `60000` | Ingest HTTP timeout in ms |

## Docker

The Dockerfile uses a two-stage build:
1. **Builder stage** — builds `shared-components` then compiles TypeScript to `dist/`.
2. **Runtime stage** — copies compiled output and runs `npm install --production`.

```bash
# Build (from monorepo root)
docker build -f scrapers/Norway/finn-no/Dockerfile -t landomo/finn-no .

# Run
docker run -p 8210:8210 \
  -e INGEST_API_URL=http://ingest-norway:3000 \
  -e INGEST_API_KEY=<key> \
  landomo/finn-no

# Trigger a scrape
curl -X POST http://localhost:8210/scrape

# Health check
curl http://localhost:8210/health
```

## Known Limitations

- **2,500 listings per search key cap.** finn.no enforces a hard limit of 50 pages × 50 results. Listings beyond page 50 are not reachable from the search API. For high-volume search keys (e.g. HOMES) this may leave a portion of total inventory unreachable.
- **Amenity flags are heuristic-only.** The search API does not return structured boolean amenity fields (balcony, elevator, etc.). Values are inferred from heading keyword matches and will have false negatives.
- **`has_bathrooms` is always `false` for commercial.** This field is not exposed in search results.
- **Single-phase (search only).** There is no detail-page fetch step. All data comes from the search API response, which has a limited field set compared to individual listing pages.
