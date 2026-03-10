# Hemnet.se Scraper

Sweden's largest real estate portal. Scrapes all active for-sale listings via the public GraphQL API, covering approximately 50,000 listings across all Swedish housing form types.

## Overview

| Field | Value |
|---|---|
| Portal | hemnet |
| Country | Sweden |
| Country code | se |
| Default port | 8220 |
| API method | GraphQL (public, no auth required) |
| Transaction type | Sale only |
| Currency | SEK |
| Categories | apartment, house, land (commercial as fallback) |

## Architecture

```
GET /scrape (POST)
    └── ListingsScraper.scrapeAll()
            └── for each HousingFormGroup (7 groups)
                    └── scrapeGroup() → paginate with offset/limit
                            └── fetchPage() → POST https://www.hemnet.se/graphql
                                    └── onBatch() → transformHemnetListing()
                                            └── detectCategory() → apartmentTransformer | houseTransformer | landTransformer | commercialTransformer
                                                    └── IngestAdapter.sendProperties() → POST /api/v1/properties/bulk-ingest
```

## API Details

### Endpoint

```
POST https://www.hemnet.se/graphql
```

No authentication is required. The endpoint is public and used by the Hemnet website itself. Fields were discovered via iterative error probing against the live API.

### Pagination Constraints

Hemnet enforces a hard constraint: `offset + limit <= 3000`. This means at most 3,000 listings are accessible per query group per run.

- Page size: 500 listings per request
- Max offset: 3,000 per group
- Groups with more than 3,000 listings (APARTMENTS ~28,000, HOUSES ~11,750) are partially covered per run
- Running daily ensures full coverage over time as new listings cycle into the window

### Housing Form Groups

All seven groups are scraped sequentially:

| Group | Approximate count | Category |
|---|---|---|
| APARTMENTS | ~28,000 | apartment |
| HOUSES | ~11,750 | house |
| ROW_HOUSES | ~3,304 | house |
| PLOTS | ~3,472 | land |
| VACATION_HOMES | ~2,252 | house |
| OTHERS | ~1,064 | house |
| HOMESTEADS | ~781 | house |

## Swedish Housing Form Mapping

Swedish housing forms are mapped to Landomo categories and subtypes as follows:

| Swedish Name | Group | Category | Subtype |
|---|---|---|---|
| Lägenhet | APARTMENTS | apartment | studio (1 room) / standard |
| Villa | HOUSES | house | villa |
| Fritidshus | HOUSES / VACATION_HOMES | house | cottage |
| Vinterbonat fritidshus | HOUSES | house | cottage |
| Gård/skog | HOUSES / HOMESTEADS | house | farmhouse |
| Radhus | ROW_HOUSES | house | townhouse |
| Kedjehus | ROW_HOUSES | house | terraced |
| Parhus | ROW_HOUSES | house | semi_detached |
| Tomt | PLOTS | land | - |
| Övrig | OTHERS | house | villa (default) |

### Bedroom Convention

Swedish listings report `numberOfRooms` which includes the living room. The transformer applies the standard Swedish convention:

```
bedrooms = max(0, numberOfRooms - 1)
```

A 1-room apartment is a studio (0 bedrooms). A 2-room apartment has 1 bedroom.

## Data Fields

### Fields Available from GraphQL

| Hemnet Field | Type | Notes |
|---|---|---|
| id | string | Globally unique listing ID |
| title | string | Full listing title |
| askingPrice.amount | number | Asking price in SEK |
| squareMeterPrice.amount | number | Price per sqm in SEK |
| fee.amount | number | Monthly HOA fee (avgift), apartments only |
| livingArea | number | Habitable area in sqm |
| landArea | number | Plot/lot area in sqm, houses and land |
| numberOfRooms | number | Total rooms including living room |
| locationName | string | "Neighbourhood, Municipality" format |
| streetAddress | string | Street address |
| postCode | string | 5-digit Swedish postal code |
| postalArea | string | Postal area name |
| housingForm.name | string | Swedish housing form name |
| housingForm.groups | string[] | Group membership |
| daysOnHemnet | number | Days since published (ActivePropertyListing only) |
| publishedAt | string | Unix timestamp with decimals (ActivePropertyListing only) |

### Fields NOT Available at List Level

The following boolean amenity fields are not exposed by the Hemnet GraphQL API at the search/list level. They are set to `false` as defaults and would require fetching individual listing detail pages to populate:

- `has_elevator`
- `has_balcony`
- `has_parking`
- `has_basement`
- `has_garage`

Exception: `has_garden` for houses is inferred as `true` when `landArea > 0`.

## Location Parsing

Hemnet `locationName` follows the format `"Neighbourhood, Municipality"`, for example:

- `"Centrum, Karlshamns kommun"` → city: `"Centrum"`, region: `"Karlshamns kommun"`
- `"Visby, Gotlands kommun"` → city: `"Visby"`, region: `"Gotlands kommun"`

The `parseMunicipality()` function splits on the first comma. If no comma is present, both city and region are set to the full string.

## Source URL Construction

Hemnet listing URLs require a full slug (`/bostad/[type]-[rooms]rum-[area]-[municipality]-[street]-[id]`) that is not returned by the GraphQL API. The scraper constructs a simplified URL using only the listing ID:

```
https://www.hemnet.se/bostad/{id}
```

This is not a valid direct link but includes the unique ID for reference. Hemnet does not provide a redirect-friendly short URL format at the search level.

## Country-Specific Fields (Tier II)

All categories store Sweden-specific data in `country_specific`:

| Field | Type | Description |
|---|---|---|
| se_housing_form | string | Swedish housing form name (e.g. "Lägenhet", "Villa") |
| se_sqm_price | number | Price per square metre in SEK |
| se_monthly_fee | number | Monthly HOA fee in SEK (apartments only) |
| se_area | string | Neighbourhood/area name within municipality |
| se_postal_area | string | Postal area name |
| se_days_on_hemnet | number | Days the listing has been active on Hemnet |

## Portal Metadata (Tier III)

Stored in `portal_metadata` for all categories:

| Field | Type | Description |
|---|---|---|
| hemnet_id | string | Original Hemnet listing ID |
| housing_form_groups | string[] | Raw group membership from API |

## Portal ID Format

```
hemnet-{listing.id}
```

Example: `hemnet-19965432`

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| PORT | 8220 | HTTP server port |
| INGEST_API_URL | http://ingest-sweden:3000 | Ingest service URL |
| INGEST_API_KEY | dev_key_se_1 | Bearer token for ingest API |
| INGEST_CHUNK_SIZE | 500 | Properties per bulk-ingest call |
| REQUEST_DELAY_MS | 300 | Delay between paginated requests (ms) |
| MAX_RETRIES | 3 | Ingest retry attempts |
| INITIAL_RETRY_DELAY | 1000 | Base retry backoff (ms) |
| INGEST_TIMEOUT | 60000 | Ingest HTTP timeout (ms) |

### Ingest API Key Resolution

The adapter resolves the API key in this order:

1. `INGEST_API_KEY_HEMNET` (portal-specific)
2. `INGEST_API_KEY` (generic)
3. Hardcoded default `dev_key_se_1`

## HTTP Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check, returns `{ status: "healthy", scraper: "hemnet", ... }` |
| POST | /scrape | Trigger a scrape run (returns 202 immediately, runs async) |
| GET | /metrics | Prometheus metrics (via `setupScraperMetrics`) |

## Rate Limiting and Request Behaviour

- Random user agent is selected per request from a pool of 5 browser strings
- `REQUEST_DELAY_MS` (default 300ms) is applied between pages within a group
- Inter-group delay is `REQUEST_DELAY_MS * 2` (default 600ms)
- Individual requests time out after 30 seconds
- GraphQL errors in the response body cause the page fetch to throw (not silently ignored)
- Group-level errors are caught and logged; the scraper continues with remaining groups

## Ingest Retry Behaviour

The `IngestAdapter` retries on network errors, 5xx responses, and 429 rate-limit responses using exponential backoff with jitter:

```
delay = min(initialRetryDelay * 2^attempt + random(0..1000ms), 30000ms)
```

4xx errors (other than 429) are not retried and cause the batch to fail immediately.

## Docker

The scraper is built as a two-stage Docker image:

```
Stage 1 (builder): node:20-alpine
  - Builds shared-components
  - Builds scraper TypeScript

Stage 2 (runtime): node:20-alpine
  - Production dependencies only
  - Exposes port 8220
  - HEALTHCHECK: GET /health every 30s
```

Build context must be the repository root (not the scraper directory) because `shared-components` is a sibling package.

## File Structure

```
scrapers/Sweden/hemnet-se/
├── Dockerfile
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md
└── src/
    ├── index.ts                          # Express server, scrape orchestration
    ├── adapters/
    │   └── ingestAdapter.ts              # HTTP client for bulk-ingest API
    ├── scrapers/
    │   └── listingsScraper.ts            # GraphQL pagination, group iteration
    ├── transformers/
    │   ├── index.ts                      # Category routing (detectCategory → transformer)
    │   ├── shared.ts                     # parseMunicipality, buildSourceUrl, parsePublishedDate
    │   ├── apartments/
    │   │   └── apartmentTransformer.ts   # HemnetListing → ApartmentPropertyTierI
    │   ├── houses/
    │   │   └── houseTransformer.ts       # HemnetListing → HousePropertyTierI
    │   ├── land/
    │   │   └── landTransformer.ts        # HemnetListing → LandPropertyTierI
    │   └── commercial/
    │       └── commercialTransformer.ts  # HemnetListing → CommercialPropertyTierI
    ├── types/
    │   └── hemnetTypes.ts                # GraphQL response types, HousingFormGroup enum
    └── utils/
        ├── categoryDetector.ts           # Group-based category detection
        └── userAgents.ts                 # Browser user agent pool
```

## Known Limitations

1. **3,000-record window**: Hemnet caps offset+limit at 3,000 per search query. For APARTMENTS (~28,000 listings), only the most recently published ~3,000 are fetched per run. Daily scheduling is required for full coverage.

2. **No amenity booleans**: Elevator, balcony, parking, basement, and garage data are not available from the search-level GraphQL response. Fetching individual listing pages would be needed to populate these fields.

3. **No geographic coordinates**: Latitude/longitude are not returned in the search response. The scraper does not attempt detail-page fetches to obtain coordinates.

4. **Source URL approximation**: The constructed URL `https://www.hemnet.se/bostad/{id}` does not resolve directly. Full URLs require a slug that is not part of the search response.

5. **Sale only**: Hemnet primarily lists properties for sale. Rental listings (hyresratt) are handled by a separate Hemnet product and are not covered by this scraper.

## Triggering a Scrape

```bash
# Trigger via HTTP
curl -X POST http://localhost:8220/scrape

# Check health
curl http://localhost:8220/health

# Via Docker
docker exec landomo-se-scraper-hemnet curl -X POST http://localhost:8220/scrape
```

## Metrics

The scraper emits Prometheus metrics via `@landomo/core`'s `setupScraperMetrics`:

- `scrape_run_active{portal="hemnet"}` - 1 while a run is in progress
- `scrape_duration_seconds{portal="hemnet", category="all"}` - duration of completed runs
- `properties_scraped_total{portal="hemnet", category="all", result="success|failure"}` - cumulative count
- `scrape_runs_total{portal="hemnet", status="success|failure"}` - run outcomes
