# UlovDomov Scraper - How It Works

## Entry Point

`src/index.ts` starts an Express server on port 8102. A `POST /scrape` request triggers `runScraper()` asynchronously (returns 202 immediately). The scraper always runs in three-phase checksum mode.

## Three-Phase Architecture

The orchestrator in `scraper/threePhaseOrchestrator.ts` runs three sequential phases:

### Phase 1: Collect All Listings

Fetches all listings from the REST API. The API returns full data -- no separate detail fetch needed.

1. Iterates through offer types: `sale`, `rent`, `coliving`
2. For each offer type, calls `scraper.scrapeByType(offerType)`
3. De-duplicates by `offer.id` using a Map
4. Collects all unique offers

### Phase 2: Checksum Comparison

Compares content hashes against the ingest API's checksum store:

1. Generates checksums via `batchCreateUlovDomovChecksums(allOffers)`
2. Compares in batches of 5,000 via `checksumClient.compareChecksumsInBatches()`
3. Identifies `new`, `changed`, and `unchanged` listings
4. Updates all checksums in the database via `checksumClient.updateChecksums()`
5. Reports savings percentage

### Phase 3: Transform + Ingest

Processes only new/changed listings:

1. Filters offers to those with `new` or `changed` checksum status
2. Transforms each via `transformUlovDomovToStandard(offer)`
3. Batches of 50 sent to ingest API via `adapter.sendProperties()`
4. Failed transforms are logged and skipped

## REST API Client (`listingsScraper.ts`)

### Base URL

`https://ud.api.ulovdomov.cz/v1`

### Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/offer/count` | `POST` | Get total count for an offer type |
| `/offer/find?page=N&perPage=N&sorting=latest` | `POST` | Fetch a page of offers |

### Request Body

All requests include Czech Republic bounding box:

```json
{
  "offerType": "sale",
  "bounds": {
    "northEast": { "lat": 51.06, "lng": 18.87 },
    "southWest": { "lat": 48.55, "lng": 12.09 }
  }
}
```

Key API notes:
- `offerType` must be lowercase: `"rent"`, `"sale"`, `"coliving"`
- Body must be flat (no `"filters"` wrapper)
- `"bounds"` covering CZ is required
- Response: `data.offers[]` (not `data.items[]`)
- Pagination info: `extraData.total` / `extraData.totalPages`

### Pagination

- **Items per page:** 100
- **Sequential:** One page at a time (no parallel fetching)
- **Inter-page delay:** 300ms
- **Sorting:** `latest` (newest first)
- **Request timeout:** 30,000ms

Flow:
```
getCount(offerType) → calculate totalPages →
  loop: fetchPage(page, 100, offerType) → collect offers → 300ms delay → next page
```

### Offer Type Processing

Offer types are processed sequentially: `sale` -> `rent` -> `coliving`. For each:

1. `getCount()` returns total listings for the type
2. Pages fetched sequentially until all collected
3. Results deduplicated by ID in the orchestrator's Map

## Rate Limiting and Error Handling

- **Request timeout:** 30 seconds
- **Inter-page delay:** 300ms between pages
- **Failed offer types:** Logged but do not abort the entire scrape
- **Streaming batch errors:** Caught and logged, scrape continues

## Ingest Adapter

`IngestAdapter` (`adapters/ingestAdapter.ts`) sends batches to `POST /api/v1/properties/bulk-ingest`:

- **No retry logic** (simpler than BezRealitky's adapter)
- **Timeout:** 30 seconds per request
- **Batch size:** 50 properties per request (set in orchestrator)
- **Payload:** `{ portal, country: 'cz', properties: [...], scrape_run_id }`

## ScrapeRunTracker Integration

- `tracker.start()` -- Called at scrape start, returns `runId`
- `tracker.complete({ listings_found, listings_new, listings_updated })` -- Maps from phase stats
- `tracker.fail()` -- Called on error

Prometheus metrics recorded:
- `scrape_duration` (histogram, total of all 3 phases)
- `properties_scraped` (counter, phase 3 sent count)
- `scrape_runs` (counter by status)
- `scrape_run_active` (gauge)

## Checksum Fields

Fields used to generate content hash (`utils/checksumExtractor.ts`):

| Field | Source | Notes |
|---|---|---|
| `price` | `offer.rentalPrice?.value` | Used for both rent and sale |
| `title` | `offer.title` | |
| `description` | `village + villagePart` joined | Location-based, not actual description |
| `sqm` | `offer.area` | |
| `disposition` | `offer.disposition` | camelCase format |
| `floor` | `offer.floorLevel` | |

## Phase Stats

The orchestrator returns `PhaseStats` with timing and counts for each phase:

```typescript
{
  phase1: { totalListings: number; durationMs: number };
  phase2: { total; new; changed; unchanged; savingsPercent; durationMs };
  phase3: { queued; sent; durationMs };
}
```

Summary is printed via `printThreePhaseSummary()` as structured JSON log.
