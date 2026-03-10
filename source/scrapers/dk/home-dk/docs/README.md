# home-dk Scraper

Scraper for [home.dk](https://home.dk), one of Denmark's primary real estate portals. Covers for-sale and for-rent listings across all property categories.

## Overview

| Field | Value |
|-------|-------|
| Portal | `home-dk` |
| Country | `denmark` |
| Base URL | `https://home.dk` |
| Port | `8203` |
| Categories | apartment, house, land, commercial |
| Transaction types | sale, rent |
| Currency | DKK |

## Architecture

```
index.ts
  └── scrapeAllListings()         # listingsScraper.ts
        ├── fetchListingPage()    # Fetch SSR HTML for category page
        │     └── parseListingPage()    # Extract Nuxt 3 payload → HomeListingSummary[]
        └── fetchDetailsBatch()   # Concurrent detail page fetch (default: 5 parallel)
              └── fetchDetailPage()    # Fetch SSR HTML for individual listing
                    └── parseDetailPage()   # Extract Nuxt 3 payload → HomeListingDetail
  └── transformListing()          # transformers/index.ts
        ├── detectCategory()      # utils/categoryDetector.ts
        ├── transformApartment()
        ├── transformHouse()
        ├── transformLand()
        └── transformCommercial()
  └── ingestProperties()          # adapters/ingestAdapter.ts
        └── POST /api/v1/properties/bulk-ingest  # batches of 500
```

## Scraping Strategy

### SSR Payload Extraction

home.dk is built on Nuxt 3. All listing data is embedded server-side in a `<script type="application/json">` tag as a flat reference array. Each element in the array is either:

- A primitive value (string, number, boolean, null)
- An object/array whose values are integer indices pointing to other elements in the same array
- A Nuxt reactive wrapper such as `['ShallowReactive', <index>]` or `['Ref', <index>]`

The scraper resolves this pointer graph via `resolveNuxtPayload()` (depth-limited to 15, with cycle detection) to reconstruct plain JavaScript objects.

This approach is used instead of the native search API (`api.home.dk/search/homedk/cases`) because that API requires proprietary browser-session request validation tokens that cannot be replicated without a headless browser.

### Two-Phase Fetch

1. **Index phase** - Fetch category listing pages to collect `HomeListingSummary` objects. Each page yields up to 12 listings (the default SSR page size). The first page of each category also provides the total listing count.

2. **Detail phase** - For each summary, fetch the individual property detail page to obtain the full `HomeListingDetail` with all stats (rooms, bathrooms, energy label, distances, etc.). Detail pages are fetched in batches of `DETAIL_CONCURRENCY` (default 5) with a randomised delay between requests.

### SSR Pagination Limitation

home.dk SSR always renders page 1 data regardless of the `?page=N` query parameter. Client-side navigation is handled by the Nuxt runtime in the browser. As a result, **only the first 12 listings per category URL are retrieved via SSR**. The scraper mitigates this by covering multiple category sub-pages:

**For-sale categories:**
- `/til-salg/lejligheder/` - apartments
- `/til-salg/andelsboliger/` - cooperative housing
- `/til-salg/huse-villaer/` - houses and villas
- `/til-salg/grunde/` - land plots
- `/til-salg/erhverv/` - commercial
- `/til-salg/sommerhuse/` - summer houses
- `/til-salg/landejendomme/` - rural properties
- `/til-salg/liebhaveri/` - luxury properties

**For-rent categories:**
- `/til-leje/lejligheder/` - rental apartments
- `/til-leje/huse-villaer/` - rental houses
- `/til-leje/erhverv/` - rental commercial

Full pagination coverage for large categories (apartments, houses) requires either the search API (future work) or city/region sub-page enumeration.

## Category Detection

The `detectCategory()` function in `src/utils/categoryDetector.ts` maps home.dk's Danish property type strings to Landomo categories using priority rules:

1. `isBusinessCase === true` → `commercial`
2. `isPlot === true` → `land`
3. Match against known type sets (see below)
4. Keyword fallback on the type string
5. Default: `house`

| Landomo Category | home.dk Types |
|-----------------|---------------|
| `apartment` | Ejerlejlighed, Andelsbolig, Almenbolig, Lejlighed, Fritidslejlighed, Penthouse |
| `house` | Villa, Villalejlighed, Rækkehus, Liebhaveri, Landejendom, Sommerhus, Fritidshus, Helårshus, Enfamiliehus, Tofamiliehus, Parcel, Byhus, Dobbelthus, Række-/kædehus |
| `land` | Grund, Byggegrund, Erhvervsgrund |
| `commercial` | Erhverv, Butik, Kontor, Lager, Produktion, Værksted, Industri, Hotel, Klinik, Restaurant |

## Field Mapping

### Apartment (`ApartmentPropertyTierI`)

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'apartment'` |
| `price` | `offer.rentalPricePerMonth.amount` (rent) / `offer.cashPrice.amount` (sale) | |
| `currency` | constant | `'DKK'` |
| `transaction_type` | `isRentalCase` / `type` | `'rent'` or `'sale'` |
| `bedrooms` | `stats.rooms - 1` | home.dk rooms count includes living room |
| `bathrooms` | `stats.bathrooms` | |
| `sqm` | `stats.floorArea` | |
| `floor` | `address.floor` (parsed to int) | |
| `rooms` | `stats.rooms` | |
| `has_elevator` | `stats.hasElevator` | defaults to `false` |
| `has_balcony` | `stats.hasBalcony` | defaults to `false` |
| `has_parking` | constant | `false` (not available from SSR) |
| `has_basement` | `stats.basementArea > 0` | |
| `has_terrace` | `stats.hasCourtYard` | |
| `energy_class` | `stats.energyLabel` | |
| `year_built` | `stats.yearBuilt` (first 4 chars) | ISO datetime stripped to year |
| `renovation_year` | `stats.yearRenovated` (first 4 chars) | |
| `deposit` | `offer.rentalSecurityDeposit.amount` | rental only |
| `published_date` | `listing.listingDate` | |
| `status` | `isSold` or `isRented` → `'removed'`, else `'active'` | |
| `portal_id` | `home-dk-{listing.id}` | |
| `source_url` | `https://home.dk/{listing.url}` | |

**`country_specific` fields:** `home_dk_id`, `property_type`, `energy_label`, `shop_number`, `is_under_sale`, `owner_costs_monthly`, `distance_to_school`, `distance_to_transport`, `distance_to_shopping`, `is_student_appropriate`

### House (`HousePropertyTierI`)

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'house'` |
| `bedrooms` | `stats.rooms - 1` | |
| `sqm_living` | `stats.floorArea` | |
| `sqm_plot` | `stats.plotArea` | |
| `stories` | `stats.floors` | |
| `has_garden` | constant | `true` (assumed for Danish houses) |
| `has_garage` | `stats.hasGarage` or `stats.garageArea > 0` | |
| `has_parking` | `has_garage` or `stats.carportArea > 0` | |
| `has_basement` | `stats.basementArea > 0` | |
| `has_terrace` | `stats.hasBalcony` | repurposed for terrace/balcony |

**`country_specific` fields:** `home_dk_id`, `property_type`, `energy_label`, `shop_number`, `is_under_sale`, `owner_costs_monthly`, `total_built_up_area`, `carport_area`, `garage_area`, `has_annex`, `distance_to_school`, `distance_to_transport`, `distance_to_beach`, `distance_to_water`

### Land (`LandPropertyTierI`)

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'land'` |
| `area_plot_sqm` | `stats.plotArea` or `stats.floorArea` | |
| `transaction_type` | constant | `'sale'` (land is never rented on home.dk) |

**`country_specific` fields:** `home_dk_id`, `property_type`, `shop_number`, `is_under_sale`, `is_water_installed`, `is_sewered`, `is_electricity_installed`, `distance_to_school`, `distance_to_shopping`

### Commercial (`CommercialPropertyTierI`)

| TierI Field | Source | Notes |
|-------------|--------|-------|
| `property_category` | constant | `'commercial'` |
| `sqm_total` | `stats.totalCommercialArea` or `stats.floorArea` | |
| `has_elevator` | `stats.hasElevator` | defaults to `false` |
| `has_parking` | constant | `false` |
| `has_bathrooms` | `stats.bathrooms > 0` | |
| `monthly_rent` | `offer.rentalPricePerMonth.amount` | rental only |

**`country_specific` fields:** `home_dk_id`, `property_type`, `energy_label`, `shop_number`, `is_under_sale`, `yearly_rent`, `yearly_rental_revenue`, `rate_of_return`, `total_built_up_area`, `bathrooms`

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8203` | HTTP server port |
| `INGEST_API_URL` | `http://ingest-denmark:3000` | Ingest service URL |
| `INGEST_API_KEY` | `dev_key_dk_1` | Ingest service auth key |
| `INSTANCE_COUNTRY` | `dk` | Country code sent with ingest payloads |
| `INGEST_BATCH_SIZE` | `500` | Properties per ingest batch |
| `DETAIL_CONCURRENCY` | `5` | Simultaneous detail page fetches |
| `REQUEST_DELAY_MS` | `300` | Base delay between requests (ms) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check; returns `{ status, scraper, country, version, timestamp }` |
| `POST` | `/scrape` | Trigger a full scrape run (async, returns 202 immediately) |
| `GET` | `/metrics` | Prometheus metrics (via `setupScraperMetrics`) |

## HTTP Client Behaviour

- **Timeout:** 30 seconds per request
- **Retries:** Up to 3 attempts with linear backoff (1s, 2s, 3s)
- **User-Agent:** Rotated round-robin across 5 desktop browser strings
- **Headers:** Danish-locale `Accept-Language: da-DK,da;q=0.9` to receive localised content
- **Ingest retries:** Up to 3 attempts with exponential backoff (1s, 2s, 4s); retries on 5xx and 429 responses

## Docker

The image uses a multi-stage build with `node:20-alpine`.

- **Build stage:** Compiles `shared-components` then the scraper TypeScript
- **Runtime stage:** Copies compiled output, installs production dependencies only
- **Exposed port:** `8203`
- **Health check:** HTTP GET to `/health` every 30 seconds (3s timeout, 10s start period, 3 retries)

Build context is the monorepo root (required so `shared-components` is accessible):

```bash
docker build -f scrapers/Denmark/home-dk/Dockerfile -t home-dk .
```

## Metrics

The scraper emits standard Landomo Prometheus metrics via `@landomo/core`:

| Metric | Description |
|--------|-------------|
| `scrape_run_active` | 1 while a scrape is in progress |
| `properties_scraped_total` | Counter of successfully transformed properties |
| `scrape_duration_seconds` | Histogram of full scrape run duration |
| `scrape_runs_total` | Counter labelled `success` / `failure` |

## Known Limitations

1. **SSR pagination is page-1 only.** home.dk's Nuxt 3 SSR always renders the first 12 listings of any URL. Listings beyond page 1 within a given category are not reachable via the current approach. Categories with large inventories (apartments, houses) will log a warning and proceed with only the first 12 items from each category sub-page.

2. **Search API is gated.** The native `api.home.dk/search/homedk/cases` endpoint requires request-signing tokens generated by the browser session. Replicating this without a headless browser is not currently feasible.

3. **`has_parking` is always `false` for apartments/commercial.** Parking availability is not exposed in the SSR payload for these categories.

4. **`has_garden` is hardcoded `true` for houses.** The detail page does not include a garden flag. This is a reasonable default for Danish houses but is not accurate for all listings.

5. **Bedrooms derived from rooms.** home.dk counts the living room in its `rooms` figure, so `bedrooms = rooms - 1`. This may be inaccurate for studios or unusual layouts.

## File Structure

```
scrapers/Denmark/home-dk/
├── Dockerfile
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md                          # this file
└── src/
    ├── index.ts                           # Express server, scrape orchestration
    ├── adapters/
    │   └── ingestAdapter.ts               # Batched POST to ingest service
    ├── scrapers/
    │   └── listingsScraper.ts             # SSR fetch, Nuxt payload parser
    ├── transformers/
    │   ├── index.ts                       # Router: detect category → call transformer
    │   ├── apartments/
    │   │   └── apartmentTransformer.ts
    │   ├── houses/
    │   │   └── houseTransformer.ts
    │   ├── land/
    │   │   └── landTransformer.ts
    │   └── commercial/
    │       └── commercialTransformer.ts
    ├── types/
    │   └── homeTypes.ts                   # Raw home.dk types (Summary, Detail, etc.)
    └── utils/
        ├── categoryDetector.ts            # Danish type string → Landomo category
        └── userAgents.ts                  # Round-robin browser UA rotation
```
