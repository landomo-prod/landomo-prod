# Reality.cz Scraper - How Data is Fetched

## Entry Point

`src/index.ts` starts an Express server on the configured port (default 8102 via `PORT`).

On startup:
1. Creates BullMQ detail worker via `createDetailWorker()`
2. Sets up Prometheus metrics via `setupScraperMetrics()`
3. Registers `/health`, `/scrape`, and `/metrics` endpoints

## Authentication (`src/utils/realityAuth.ts`)

Uses a reverse-engineered mobile API authentication flow:

1. **Guest Login:** POST to `https://api.reality.cz/moje-reality/prihlasit2/` with form data `mrregemail=&mrregh=&fcm_id=&os=6`
2. **Headers:** `User-Agent: Android Mobile Client 3.1.4b47`, `Authorization: Token 5c858f9578fc6f0a12ec9f367b1807b3`
3. **Session:** Extracts `sid` cookie from `Set-Cookie` response header
4. **Subsequent requests:** Include `Cookie: sid={sessionId}` header
5. **Session renewal:** If server issues new `sid` cookie, automatically updates
6. **Session lifetime:** ~1 year (refreshed well before 2-year expiry)

The `RealityAuth` class is a singleton that manages session lifecycle.

## Scrape Trigger

`POST /scrape` responds immediately with HTTP 202 and runs scraping asynchronously.

## Three-Phase Orchestrator

File: `src/scraper/threePhaseOrchestrator.ts`

### Phase 1: Discovery

Iterates over 2 offer types x 4 property types (8 combinations). For each:

1. Calls `scraper.fetchAllSearchResults(offerType, propertyType, region, take)`
2. Paginates sequentially through the search API

**API Endpoint:**
```
GET https://api.reality.cz/{offerType}/{propertyType}/{region}/?skip={n}&take=100
```

Where:
- `offerType`: `prodej` or `pronajem`
- `propertyType`: `byty`, `domy`, `pozemky`, or `komercni`
- `region`: `Ceska-republika` (default, whole country)
- Pagination: `skip` increments by response count, `take=100` per page

**Pagination logic:**
- Sequential (not parallel) to avoid overwhelming the API
- 500ms delay between pages (`RATE_LIMIT_MS`)
- Stops when `skip >= totalCount` or page returns fewer than `take` items
- Deduplication: if same ID appears across categories, last writer wins

### Phase 2: Checksum Comparison

1. Creates checksums from search result data via `batchCreateListItemChecksums()`
   - Checksum fields from search results: `price`, `type` (encodes disposition+sqm), `place`
   - This avoids needing detail pages for checksum comparison
2. Sends checksums to ingest API via `ChecksumClient.compareChecksumsInBatches()` (batch size 5000)
3. Stores updated checksums via `checksumClient.updateChecksums()`

### Phase 3: Queue Detail Jobs

For each new/changed listing:
1. Creates a `DetailJob` with `id` and `transactionType`
2. Adds jobs to BullMQ queue `reality-details` via `addDetailJobs()`

### Queue Worker Processing

File: `src/queue/detailQueue.ts`

BullMQ worker processes jobs from `reality-details` queue:

1. Applies fixed delay + jitter (1500ms base + 0-500ms random via `DETAIL_RATE_LIMIT_MS`)
2. Fetches detail via `GET https://api.reality.cz/{id}/` with session cookie
3. Skips listings with error responses (`detail.err`)
4. Converts API response to `RealityListing` via `apiDetailToListing()`
5. Transforms via `transformRealityToStandard()`
6. Accumulates in batch (50 items), flushes to ingest API
7. Periodic flush every 10 seconds for partial batches

**Worker config:**

| Setting | Value |
|---------|-------|
| Concurrency | 3 (configurable via `WORKER_CONCURRENCY`) |
| Rate limiter | Max 3 requests per 5 seconds |
| Lock duration | 120 seconds |
| Lock renew | 60 seconds |
| Retry | 5 attempts with exponential backoff (10s base) |

## API Detail Response Conversion

File: `src/types/realityTypes.ts` -> `apiDetailToListing()`

Converts `RealityApiDetailResponse` to the internal `RealityListing` format:

| API Field | RealityListing Field | Conversion |
|-----------|---------------------|------------|
| `detail.id` | `id` | Direct |
| `detail.title` or `detail.type` | `title` | Title fallback to type (title often empty) |
| `detail.type` | `api_type` | Direct (e.g., `"byt 2+1, 62 m2, panel, osobni"`) |
| `detail.place` | `place` | Direct |
| `detail.description` | `description` | Direct |
| `detail.price.sale.price` or `detail.price.rent.price` | `price` | Based on transaction type |
| `detail.price.sale.unit` | `currency` | `Kc`/`Kc` -> `CZK` |
| `detail.location.gps` | `gps` | `{lat, lng}` |
| `detail.information[]` | `information` | Direct array of `{key, value}` |
| `detail.photos[]` | `images` | Prefixed with `https://api.reality.cz` |
| `detail.contact` | `contact` | Direct |
| `detail.created_at` | `created_at` | Direct |
| `detail.id` | `url` | `https://reality.cz/{id}/` |

## Error Handling

- Search errors: Warning logged, category skipped, continues with next
- Detail fetch errors: Warning logged, listing skipped
- Batch flush errors: Error logged, batch retained for next flush attempt
- Worker job failures: 5 retries with exponential backoff (10s, 20s, 40s, 80s, 160s)

## ScrapeRunTracker Integration

- `tracker.start()` at scrape begin
- `tracker.complete({ listings_found, listings_new, listings_updated })` on success
- `tracker.fail()` on error
- Prometheus metrics: `scrape_duration`, `properties_scraped`, `scrape_runs`, `scrape_run_active`

## Graceful Shutdown

SIGTERM/SIGINT handlers exit immediately (no graceful worker drain). Worker `closing` event triggers batch flush.
