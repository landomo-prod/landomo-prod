# BezRealitky Scraper - How It Works

## Entry Point

`src/index.ts` starts an Express server on port 8102. A `POST /scrape` request triggers `runScraper()` asynchronously (returns 202 immediately).

## Data Fetching: GraphQL All-In-One Pattern

BezRealitky exposes a public GraphQL API at `https://api.bezrealitky.cz/graphql/`. The `ListAdverts` query returns **full listing data** in the discovery response -- there is no separate detail fetch phase.

### GraphQL Query

The `LISTINGS_QUERY` (`listingsScraper.ts:18-164`) requests all fields in a single query:

- Identification: `id`, `externalId`, `hash`, `uri`, `code`
- Status: `active`, `reserved`, `highlighted`, `isNew`, `archived`
- Content: `title`, `description`, `titleEnglish`, `descriptionEnglish`
- Classification: `estateType`, `offerType`, `disposition`, `landType`, `houseType`
- Dimensions: `surface`, `surfaceLand`, `balconySurface`, `loggiaSurface`, `terraceSurface`, `cellarSurface`
- Financial: `price`, `deposit`, `charges`, `serviceCharges`, `utilityCharges`, `fee`, `currency`, `originalPrice`
- Location: `gps { lat, lng }`, `address`, `street`, `houseNumber`, `city`, `cityDistrict`, `zip`, `region { id, name, uri }`
- Building: `condition`, `ownership`, `equipped`, `construction`, `floor`, `totalFloors`, `age`, `reconstruction`, `penb`, `heating`
- Amenities: `parking`, `garage`, `lift`, `balcony`, `terrace`, `cellar`, `loggia`, `frontGarden`, `newBuilding`, `petFriendly`, `barrierFree`
- Media: `publicImages { id, url, order, main }`, `tour360`
- Rental: `availableFrom`, `minRentDays`, `maxRentDays`, `shortTerm`
- Analytics: `visitCount`, `conversationCount`

Variables:
```json
{
  "offerType": ["PRODEJ"],
  "estateType": ["BYT"],
  "order": "TIMEORDER_DESC",
  "limit": 60,
  "offset": 0,
  "locale": "CS"
}
```

### Parallel Page Fetching

The `ListingsScraper` class processes all 14 category combinations sequentially (2 offer types x 7 estate types). Within each category, pages are fetched in parallel:

1. **Items per page:** 60
2. **Concurrent pages:** 20 (fetched via `Promise.allSettled`)
3. **Per-batch:** Up to 1,200 listings (20 pages x 60 items)
4. **Inter-batch pause:** 500ms between parallel batches
5. **Inter-category pause:** 500ms between categories

Flow per category:
```
Calculate 20 offsets → Promise.allSettled(fetchPage x 20) → collect results →
  stream batch if onBatch callback provided → check if totalCount reached →
  next batch or next category
```

### Streaming Mode (Legacy)

When `ENABLE_CHECKSUM_MODE` is not set:

1. `ListingsScraper.scrapeAll(streamBatch)` is called with a callback
2. The callback transforms each batch and sends to ingest API immediately
3. Batches are sent as they arrive from parallel page fetches
4. No checksum comparison -- all listings are ingested every run

### Checksum Mode

When `ENABLE_CHECKSUM_MODE=true`:

1. **Fetch all listings** -- `scraper.scrapeAll()` (no streaming callback)
2. **Generate checksums** -- `batchCreateBezrealitkyChecksums(allListings)` hashes key fields (price, title, description, sqm, disposition, floor)
3. **Compare against DB** -- `checksumClient.compareChecksums(checksums)` sends to ingest API's `/api/v1/checksums/compare`
4. **Filter** -- Only listings with status `new` or `changed` are kept
5. **Update checksums** -- `checksumClient.updateChecksums(checksums)` stores all current checksums
6. **Ingest** -- Only filtered listings are transformed and sent

Typical savings: 80-90% reduction in ingestion volume on stable periods.

### Checksum Fields

Fields used to generate content hash (`checksumExtractor.ts`):

| Field | Source |
|---|---|
| `price` | `listing.price` |
| `title` | `listing.title` |
| `description` | `listing.description` |
| `sqm` | `listing.surface` |
| `disposition` | `listing.disposition` |
| `floor` | `listing.floor` |

## Rate Limiting and Error Handling

- **User agent rotation:** 5 browser user agents rotated randomly per request (`userAgents.ts`)
- **Request timeout:** 30 seconds per GraphQL request
- **Failed pages:** Logged but do not abort the scrape (uses `Promise.allSettled`)
- **Streaming batch errors:** Caught and logged, scrape continues

## Ingest Adapter

`IngestAdapter` (`adapters/ingestAdapter.ts`) sends batches to `POST /api/v1/properties/bulk-ingest`:

- **Retry logic:** Up to 3 retries with exponential backoff
- **Backoff formula:** `initialDelay * 2^attempt + random(0-1s)`, capped at 30s
- **Retryable errors:** Network errors, 5xx server errors, 429 rate limit
- **Non-retryable:** 4xx client errors (except 429)
- **Timeout:** 60 seconds per request (configurable via `INGEST_TIMEOUT`)

## ScrapeRunTracker Integration

- `tracker.start()` -- Called at scrape start, returns `runId`
- `tracker.complete({ listings_found, listings_new, listings_updated })` -- Called on success
- `tracker.fail()` -- Called on error

Prometheus metrics are also recorded:
- `scrape_duration` (histogram)
- `properties_scraped` (counter)
- `scrape_runs` (counter by status)
- `scrape_run_active` (gauge)

## Category Detection

`categoryDetector.ts` maps `estateType` enum values directly:

| estateType | Category |
|---|---|
| `BYT` | `apartment` |
| `DUM` | `house` |
| `POZEMEK` | `land` |
| `GARAZ` | `commercial` |
| `KANCELAR` | `commercial` |
| `NEBYTOVY_PROSTOR` | `commercial` |
| `REKREACNI_OBJEKT` | `recreational` (routes to house transformer) |
| Unknown | `apartment` (fallback) |

100% accuracy -- no heuristics needed since GraphQL provides explicit enum values.
