# EDC.dk Scraper

Scraper for [edc.dk](https://www.edc.dk), one of Denmark's largest real estate portals operated by the EDC Group. Covers residential sale, residential rental, and commercial property listings across Denmark.

## Portal Overview

| Field | Value |
|-------|-------|
| Portal | EDC.dk |
| Country | Denmark |
| Currency | DKK |
| Language | Danish |
| Portal ID prefix | `edc-` |
| Source platform | `edc-dk` |
| Default port | `8202` |
| Anti-bot protection | None detected (no Cloudflare, Akamai, WAF) |

## Architecture

```
index.ts (Express)
  └── EdcListingsScraper.scrapeAll()
        ├── scrapeDivision('private')   → sale listings
        ├── scrapeDivision('Rent')      → rental listings
        └── scrapeDivision('erhverv')   → commercial listings
              └── onBatch() → transformListing() → IngestAdapter.sendBatch()
```

The scraper uses a **streaming batch pattern**: raw API pages are transformed and flushed to the ingest API in configurable batch sizes (default 500) without accumulating all listings in memory.

## Data Source

### API Endpoint

```
GET https://www.edc.dk/api/v1/cases/quick-search
  ?page={page}
  &pageSize=100
```

The division (listing type) is selected via the `x-division` request header.

### Divisions

| Division Header | Label | Description | Approx. Volume |
|-----------------|-------|-------------|----------------|
| `private` | `sale-private` | Residential properties for sale | ~40,000 |
| `Rent` | `rent-private` | Residential rental properties | ~14,000 |
| `erhverv` | `sale-commercial` | Commercial properties | varies |

### API Limitations

The EDC API hard-caps results at **10,000 per division** (100 pages x 100 results). For the `private` division with ~40,000 listings, this means approximately 75% of the catalogue is not accessible through the current implementation. Full coverage would require price-band or zip-code sharding as a workaround.

## File Structure

```
scrapers/Denmark/edc-dk/
├── Dockerfile
├── antibot_detection.json          # Anti-bot status snapshot
├── src/
│   ├── index.ts                    # Express server, run orchestration
│   ├── adapters/
│   │   └── ingestAdapter.ts        # POST to bulk-ingest API
│   ├── scrapers/
│   │   └── listingsScraper.ts      # HTTP pagination, retry logic
│   ├── transformers/
│   │   ├── index.ts                # Category dispatcher
│   │   ├── apartments/
│   │   │   └── apartmentTransformer.ts
│   │   ├── houses/
│   │   │   └── houseTransformer.ts
│   │   ├── land/
│   │   │   └── landTransformer.ts
│   │   └── commercial/
│   │       └── commercialTransformer.ts
│   ├── types/
│   │   └── edcTypes.ts             # Raw API types, division types, category map
│   └── utils/
│       ├── categoryDetector.ts     # estateTypeName → category logic
│       └── userAgents.ts           # Rotating browser user agents
└── docs/
    └── README.md
```

## Category Detection

Category is resolved from the `estateTypeName` field (a Danish property type name) via `categoryDetector.ts`. The lookup uses `ESTATE_TYPE_CATEGORY_MAP` defined in `edcTypes.ts`.

### Estate Type Mapping

| Danish Name | Category |
|-------------|----------|
| Ejerlejlighed | apartment |
| Andelsbolig | apartment |
| Lejlighed | apartment |
| Villalejlighed | apartment |
| Villa | house |
| Rækkehus | house |
| Liebhaveri | house |
| Landejendom | house |
| Sommerhus | house |
| Helårsgrund | land |
| Grund | land |
| Sommerhusgrund | land |
| Erhverv | commercial |
| Butik | commercial |
| Kontor | commercial |
| Lager/Produktion | commercial |
| Hotel/Restaurant | commercial |

### Detection Strategy (priority order)

1. Exact match on `estateTypeName` against the map
2. Partial/substring match for combined types such as `Rækkehus/Villa`
3. `caseTypeGroup === 'Business'` fallback → `commercial`
4. `caseClassification === 'Rent'` fallback → `apartment`
5. Default → `apartment`

## Transformers

All transformers follow the same pattern:

- `portal_id` is set to `edc-{caseNumber}` (globally unique within EDC)
- `source_platform` is always `edc-dk`
- `status` is always `active` (EDC only returns active listings from this API)
- `source_url` is built from `urlPath` when present, otherwise constructed from `caseNumber`
- `published_date` is extracted from `statusChangeDate` (ISO date portion only)
- Amenity flags (`has_elevator`, `has_balcony`, etc.) are conservatively set to `false` because the search endpoint does not return them

### Apartment (`ApartmentPropertyTierI`)

| Field | Source |
|-------|--------|
| `bedrooms` | `rooms.value - 1` (rooms includes living room), min 0 |
| `sqm` | `livingArea.value` |
| `rooms` | `rooms.value` (floored) |
| `price` | `rent.value` (rental) or `price.value` (sale) |
| `transaction_type` | `rent` or `sale` based on `caseClassification` |
| `has_elevator` | `false` (not in API) |
| `has_balcony` | `false` (not in API) |
| `has_parking` | `false` (not in API) |
| `has_basement` | `false` (not in API) |

### House (`HousePropertyTierI`)

| Field | Source |
|-------|--------|
| `bedrooms` | `rooms.value - 1`, min 0 |
| `sqm_living` | `livingArea.value` |
| `sqm_plot` | `areaLand.value` |
| `has_garden` | `true` when `areaLand.value > 0` |
| `has_garage` | `false` (not in API) |
| `has_parking` | `false` (not in API) |
| `has_basement` | `false` (not in API) |
| `property_subtype` | `cottage` for Sommerhus, `farmhouse` for Landejendom |

### Land (`LandPropertyTierI`)

| Field | Source |
|-------|--------|
| `area_plot_sqm` | `areaLand.value`, fallback `livingArea.value` |
| `transaction_type` | always `sale` |

### Commercial (`CommercialPropertyTierI`)

| Field | Source |
|-------|--------|
| `sqm_total` | `livingArea.value`, fallback `areaFloor.value` |
| `price` | `rent.value` or `rentYear.value` (rental), `price.value` (sale) |
| `has_elevator` | `false` (not in API) |
| `has_parking` | `false` (not in API) |
| `has_bathrooms` | `false` (not in API) |
| `return_percentage` | `businessReturnPercentage.value` (investment properties) |

### Country-Specific Fields (JSONB `country_specific`)

All categories store the following in `country_specific`:

| Field | Description |
|-------|-------------|
| `case_number` | EDC case number |
| `case_guid` | EDC case UUID |
| `estate_type_name` | Danish property type name |
| `case_status` | API status string (`New`, `ChangedPrice`, etc.) |
| `agency_guid` | Listing agency UUID |
| `is_advertised` | Whether listing is currently advertised |
| `is_new_case` | New listing flag |
| `has_new_price` | Price change flag |
| `is_project` | Part of a development project (apartments/houses) |
| `monthly_rent` | Monthly rent in DKK (rental listings) |
| `annual_rent` | Annual rent in DKK (commercial rental only) |
| `return_percentage` | Investment return % (commercial only) |

### Portal Metadata (JSONB `portal_metadata`)

Stored under key `edc` for all categories:

```json
{
  "edc": {
    "id": 12345,
    "case_guid": "...",
    "case_number": "12345",
    "estate_type": "<GUID>",
    "estate_type_name": "Ejerlejlighed",
    "agency_guid": "...",
    "case_classification": "Sale",
    "source": "EDC",
    "status_change_date": "2026-01-15T00:00:00"
  }
}
```

## Scraper Behaviour

### Pagination

- Page size: 100 listings per request
- Max pages: 100 per division (capped to `data.totalPages` from first response)
- Between pages: `PAGE_DELAY_MS` (default 300ms) + up to 200ms random jitter
- Stop conditions: empty `items` array, null response, or max pages reached

### Retry Logic

Each page fetch retries up to 3 times:

| HTTP Status | Behaviour |
|-------------|-----------|
| 404 / 400 | Return null immediately (no retry) |
| 429 / 503 | Exponential backoff: `min(2000 * 2^attempt, 60000)` ms |
| Other errors | Linear backoff: `1000 * attempt` ms |
| All retries exhausted | Return null, increment error count |

### Ingest Retry Logic

The `IngestAdapter` retries failed batch sends up to 3 times with exponential backoff (`1s, 2s, 4s`). Non-retryable errors (4xx except 429) are thrown immediately.

### Request Headers

Each request rotates a random browser user agent from a pool of 6 agents (Chrome, Firefox, Safari, Edge). The `x-division` header selects the listing type. Language preference is set to Danish (`da-DK`).

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `8202` | HTTP server port |
| `BATCH_SIZE` | `500` | Listings per ingest batch |
| `PAGE_DELAY_MS` | `300` | Delay between page requests (ms) |
| `INGEST_API_URL` | `http://ingest-denmark:3000` | Ingest service base URL |
| `INGEST_API_KEY` | `dev_key_dk_1` | Bearer token for ingest API |
| `INSTANCE_COUNTRY` | `dk` | Country code passed to ingest |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check, returns status + version |
| `POST` | `/scrape` | Start a scrape run (async, returns 202) |

### Trigger a scrape

```bash
curl -X POST http://localhost:8202/scrape
```

### Health check

```bash
curl http://localhost:8202/health
```

## Docker

The scraper uses a multi-stage build. `shared-components` is built first and copied into the final image.

```bash
# Build from the repository root
docker build -f scrapers/Denmark/edc-dk/Dockerfile -t edc-dk-scraper .

# Run locally
docker run -p 8202:8202 \
  -e INGEST_API_URL=http://host.docker.internal:3000 \
  -e INGEST_API_KEY=dev_key_dk_1 \
  edc-dk-scraper
```

The container exposes port `8202` and runs a health check every 30 seconds against `/health`.

## Metrics

The scraper integrates with `@landomo/core` metrics:

- `scrape_run_active{portal="edc-dk"}` - 1 while a run is in progress
- `scrape_duration_seconds{portal="edc-dk", category="all"}` - total run duration
- `properties_scraped_total{portal="edc-dk", category="all", result="success"}` - inserted + updated count
- `scrape_runs_total{portal="edc-dk", status="success|failure"}` - run outcome counter

Scrape run tracking is performed via `ScrapeRunTracker` (5s timeout, best-effort, non-fatal).

## Known Limitations

1. **10,000 listing cap per division**: The EDC API does not allow retrieval beyond page 100. With ~40k residential sale listings, roughly 30k are not reachable without additional filtering (e.g. by price band or zip code).
2. **Amenity flags unavailable**: The quick-search endpoint does not return `has_elevator`, `has_balcony`, `has_parking`, `has_basement`, etc. These are all set to `false`. A detail-fetch phase would be needed to populate them.
3. **Single-phase (no detail fetch)**: All data comes from the search endpoint. No per-listing detail page is fetched, which limits the richness of the data compared to portals that have a two-phase scraper.
4. **Rooms vs. bedrooms**: The API returns total room count (including living room). Bedrooms are estimated as `rooms - 1`, which may be off for unusual layouts.
