# SReality Scraper - How Data is Fetched

## Entry Point

`src/index.ts` starts an Express server on port 8102 (configurable via `PORT`).

On startup:
1. Creates BullMQ detail worker with configurable concurrency (default 200, via `WORKER_CONCURRENCY`)
2. Sets up Prometheus metrics via `setupScraperMetrics()`
3. Registers `/health`, `/scrape`, and `/metrics` endpoints

## Scrape Trigger

`POST /scrape` responds immediately with HTTP 202 and runs scraping asynchronously. It creates a `ScrapeRunTracker` to record the run in the ingest API.

## Three-Phase Orchestrator

File: `src/scraper/threePhaseOrchestrator.ts`

### Phase 1: Discovery

Iterates over 5 categories x 2 transaction types (10 combinations). For each:

1. Calls `fetchAllListingPages(category, categoryType)` from `fetchData.ts`
2. This paginates the SReality search API in parallel batches of `CONCURRENT_PAGES` (default 20)

**API Endpoint:**
```
GET https://www.sreality.cz/api/cs/v2/estates
  ?page={n}
  &per_page=100
  &category_main_cb={1-5}
  &category_type_cb={1|2}
  &tms={timestamp}
```

**Pagination logic:**
- Fetches pages in parallel batches of 20 (configurable via `CONCURRENT_PAGES`)
- Each page request gets fresh rotated headers (User-Agent, Accept-Language, sec-ch-ua)
- Stops when a page returns fewer than 100 results or is empty
- 500ms pause between parallel batches

### Phase 2: Checksum Comparison

For each category-type batch:

1. Creates checksums from listing data via `batchCreateSRealityChecksums()`
   - Checksum fields: `price`, `title`, `description`, `bedrooms`, `bathrooms`, `sqm`
2. Sends checksums to ingest API via `ChecksumClient.compareChecksumsInBatches()` (batch size 5000)
3. Results classify each listing as `new`, `changed`, or `unchanged`
4. Stores updated checksums via `checksumClient.updateChecksums()`

### Phase 3: Queue Detail Jobs

For each new/changed listing:
1. Creates a `DetailJob` with `hashId`, `category`, and detail API URL
2. Adds jobs to BullMQ queue `sreality-details` via `addDetailJobs()`

### Queue Worker Processing

File: `src/queue/detailQueue.ts`

BullMQ worker processes jobs from `sreality-details` queue:

1. Applies token bucket rate limiting (`srealityRateLimiter.throttle()`)
2. Adds 100-500ms jitter delay
3. Fetches detail via `GET https://www.sreality.cz/api/cs/v2/estates/{hashId}` with rotated headers
4. Skips inactive listings (HTTP 410 or `{"logged_in": false}`)
5. Transforms via `transformSRealityToStandard()`
6. Accumulates in batch (100 items), flushes to ingest API
7. Periodic flush every 5 seconds for partial batches

**Worker config:**
- Concurrency: 350 (configurable)
- Lock duration: 5 minutes (with 2.5 min renewal)
- BullMQ limiter: 20,000 jobs per 60 seconds
- Retry: 3 attempts with exponential backoff (1s base)

## Rate Limiting

File: `src/utils/rateLimiter.ts`

Token bucket algorithm:
- Default: 20,000 requests per 60 seconds (configurable via `RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW_MS`)
- Blocks when limit reached, waits for window to slide
- 100ms buffer added to wait time

## Anti-Bot Measures

### Header Rotation (`src/utils/headers.ts`)
- Rotates User-Agent from pool of 100+ real browser strings (Chrome, Firefox, Safari, Edge across Windows/Mac/Linux)
- Varies Accept-Language between Czech locale combinations
- Adds browser-specific headers (sec-ch-ua for Chrome)
- Randomly includes DNT header (50% chance)
- Sets realistic Sec-Fetch-* headers

### Request Jitter
- Detail fetches: 100-500ms random jitter between requests
- Page fetches: 500ms between parallel batches

## Error Handling

### Fetch Retry (`src/utils/fetchData.ts`)
- 3 retries with exponential backoff (1s, 2s, 4s) plus random jitter (0-1s)
- Max backoff capped at 10 seconds
- No retry on 4xx client errors
- 30 second timeout per request

### Inactive Detection
- HTTP 410 (Gone): Property permanently removed
- `{"logged_in": false}` response: Property no longer accessible
- Both result in listing being skipped (not ingested)

### Queue Resilience
- Failed jobs kept for 2 hours (500 max) for debugging
- Completed jobs kept for 1 hour (1000 max)
- Queue drained at start of each scrape run to clear stale jobs

## ScrapeRunTracker Integration

- `tracker.start()` at scrape begin
- `tracker.complete({ listings_found, listings_new, listings_updated })` on success
- `tracker.fail()` on error
- Prometheus metrics: `scrape_duration`, `properties_scraped`, `scrape_runs`, `scrape_run_active`

## Graceful Shutdown

SIGTERM/SIGINT handlers:
1. Close BullMQ workers
2. Close detail queue
3. Flush remaining batch before worker closes
4. Exit process

## Legacy ListingsScraper

File: `src/scrapers/listingsScraper.ts`

An older 3-phase execution model (not used in current queue-based flow):
- Phase 1: Collect listing IDs via parallel page fetch
- Phase 1.5: Local change detection (in-memory)
- Phase 2: Fetch details for new/changed only (p-limit bounded concurrency, default 200)
- Phase 3: Merge and stream in batches of 25

This is superseded by the `threePhaseOrchestrator.ts` + BullMQ queue approach.
