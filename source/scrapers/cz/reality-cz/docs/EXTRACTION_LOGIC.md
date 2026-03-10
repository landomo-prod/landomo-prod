# Reality.cz - Extraction Logic

## Architecture Overview

```
Express Server (index.ts, port 8102)
    |
    POST /scrape
    |
    v
RealityApiScraper.scrapeAll()
    |
    +--> scrapeSales() -+-> scrape('prodej', 'byty')
    |                   +-> scrape('prodej', 'domy')
    |                   +-> scrape('prodej', 'pozemky')
    |                   +-> scrape('prodej', 'komercni')
    |
    +--> scrapeRentals() -> scrape('pronajem', 'byty') ... (same 4 types)
    |
    v
Per scrape() call:
    fetchAllSearchResults() --> paginate search API
    |
    v
    fetchDetail() per listing --> 500ms delay between each
    |
    v
    apiDetailToListing() --> normalize to RealityListing
    |
    v
    onBatch callback (every 50) --> transform + send to ingest API
```

## Discovery Process

### Entry Point
The scraper runs as an Express server. A `POST /scrape` triggers `runScraper()` which:
1. Creates a `ScrapeRunTracker` and starts a run
2. Instantiates `RealityApiScraper` and `IngestAdapter`
3. Calls `scraper.scrapeAll(onBatch)` with a streaming batch callback
4. The callback transforms each batch and sends to the ingest API immediately

### Search Iteration
The scraper iterates over 8 combinations:
- 2 offer types: `prodej` (sale), `pronajem` (rent)
- 4 property types: `byty`, `domy`, `pozemky`, `komercni`

Each combination is scraped sequentially.

### Pagination
- **Method**: `skip`/`take` query parameters
- **Page Size**: 100 items per request
- **Logic**: Increment `skip` by the number of items received until `skip >= count` or an empty page is returned
- **Termination**: Empty `advertisements` array, `skip >= totalCount`, or fewer items than `take`

```typescript
// From realityApiScraper.ts
while (skip < totalCount) {
  const path = `/${offerType}/${propertyType}/${loc}/?skip=${skip}&take=${take}`;
  const response = await this.auth.request(path);
  totalCount = response.count;
  allItems.push(...response.advertisements);
  skip += response.advertisements.length;
  if (response.advertisements.length < take) break;
  await sleep(500);
}
```

## Detail Extraction

### Method
- **Approach**: Sequential (one at a time with 500ms delay)
- **Concurrency**: 1 simultaneous request
- **Endpoint**: `GET /{advertisement_id}/`

### Flow
For each listing ID from the search results:
1. Call `fetchDetail(id)` which hits `GET /{id}/`
2. Check for errors (`detail.err`)
3. Convert via `apiDetailToListing(detail, transactionType)` to `RealityListing`
4. Accumulate in batch; when batch reaches 50, fire `onBatch` callback
5. Wait 500ms before next detail fetch

### Batch Streaming
Rather than fetching all details then sending, the scraper streams batches:
```typescript
const BATCH_SIZE = 50;
let currentBatch: RealityListing[] = [];

for (const item of listItems) {
  const detail = await this.fetchDetail(item.id);
  const listing = apiDetailToListing(detail, transactionType);
  currentBatch.push(listing);

  if (currentBatch.length >= BATCH_SIZE && onBatch) {
    await onBatch(currentBatch);
    currentBatch = [];
  }
  await sleep(500);
}
// Send remaining
if (currentBatch.length > 0 && onBatch) {
  await onBatch(currentBatch);
}
```

## Authentication

### Mobile API Auth
The scraper uses the Reality.cz mobile app API (reverse-engineered from APK v3.1.4):
- **Static Auth Header**: `Authorization: Token 5c858f9578fc6f0a12ec9f367b1807b3`
- **User-Agent**: `Android Mobile Client 3.1.4b47`
- **Session**: Guest login returns `sid` cookie via `Set-Cookie` header
- **Session Lifetime**: ~2 years; refreshed proactively at 1 year
- **Session Refresh**: Automatic if server issues new `Set-Cookie`

```typescript
// Guest login - no real credentials needed
const response = await this.client.post(
  '/moje-reality/prihlasit2/',
  'mrregemail=&mrregh=&fcm_id=&os=6',
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
);
const sid = extractSessionId(response); // from Set-Cookie header
```

### Rate Limiting
- **Delay**: 500ms between detail requests
- **Delay**: 500ms between search pagination requests
- **No retry logic**: Failed detail fetches are logged and skipped

## Error Handling

### Failed Detail Fetches
- Wrapped in try/catch per listing
- Logged via `console.warn` and skipped
- Does not abort the overall scrape

### Failed Transformations
- Each listing transformation is wrapped in try/catch in the `onBatch` callback
- Failed transforms return `null` and are filtered out
- Does not block other listings in the batch

### Failed Ingestion
- If `adapter.sendProperties()` fails, the error is logged
- The scrape continues with the next batch

### Scrape Run Tracking
- `ScrapeRunTracker.start()` called at beginning
- `ScrapeRunTracker.complete()` called with stats on success
- `ScrapeRunTracker.fail()` called on unrecoverable error

## Performance

### Typical Runtime
- **Per search page**: ~500ms + response time
- **Per detail fetch**: ~500ms delay + response time
- **Full scrape estimate**: For N total listings, approximately N * 0.5s + search pagination time

### Optimizations
- Streaming batches (send every 50 instead of waiting for all)
- No browser needed (pure HTTP API calls)
- Session reuse across all requests (singleton auth instance)
- Checksum mode available (currently disabled with streaming) to skip unchanged listings
