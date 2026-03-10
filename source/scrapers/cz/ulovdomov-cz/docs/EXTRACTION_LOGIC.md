# UlovDomov - Extraction Logic

## Architecture Overview

```
Express Server (index.ts, port 8102)
    |
    POST /scrape
    |
    v
runScraper()
    |
    +-- ListingsScraper.scrapeSales(streamBatch)
    |       |
    |       +-- getCount(filters) -> total
    |       +-- fetchPage(1..N, 100, filters) -> UlovDomovOffer[]
    |       +-- onBatch callback per page
    |
    +-- ListingsScraper.scrapeRentals(streamBatch)
    |       (same flow)
    |
    +-- streamBatch callback:
            transform -> IngestAdapter.sendProperties()
```

## REST API Scraper (`listingsScraper.ts`)

### Discovery Process
1. POST to `/v1/offer/count` with filters to get total count
2. Calculate total pages: `Math.ceil(count / 100)`
3. Iterate pages 1..N, POST to `/v1/offer/find?page=N&perPage=100&sorting=latest`
4. Each page returns up to 100 `UlovDomovOffer` items
5. Streaming: `onBatch` callback fires after each page fetch

### Pagination
- **Method**: Query parameter `page=N&perPage=100`
- **Page size**: 100 (API maximum)
- **Sorting**: `latest` (default)
- **Termination**: When `currentPage > totalPages` or empty items returned

### Rate Limiting
- **Delay**: 500ms between page fetches
- **Timeout**: 30s per request

### Request Configuration
```typescript
axios.create({
  baseURL: 'https://ud.api.ulovdomov.cz/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; ...)'
  }
});
```

## Scrape Orchestration (`index.ts`)

### Flow
1. `POST /scrape` returns 202 immediately
2. `runScraper()` executes asynchronously
3. Creates `ScrapeRunTracker` and calls `tracker.start()`
4. Scrapes sales first, then rentals
5. Each page batch is transformed and streamed to ingest
6. On completion: `tracker.complete()` with stats
7. On failure: `tracker.fail()`

### Streaming Batch Callback
```typescript
const streamBatch = async (batch: UlovDomovOffer[]) => {
  const properties = batch.map(listing => ({
    portalId: listing.id,
    data: transformUlovDomovToStandard(listing),
    rawData: listing
  })).filter(p => p !== null);

  await adapter.sendProperties(properties);
};
```

Failed transformations are logged and filtered out; they do not halt the batch.

### Metrics Tracked
- `scrapeRunActive` gauge (1 during scrape, 0 otherwise)
- `scrapeDuration` histogram (total seconds)
- `propertiesScraped` counter (by portal/category/result)
- `scrapeRuns` counter (by portal/status)

## Error Handling

### API Errors
- Axios throws on non-2xx responses
- `response.data.success === false` also throws
- Individual page failures propagate up and abort the entire scrape

### Transformation Errors
- Caught per-listing in `streamBatch`
- Logged with listing ID
- Listing skipped (returns null, filtered out)
- Does not abort the batch

### Scrape-level Errors
- Caught in `runScraper()`
- `tracker.fail()` called
- Metrics updated with failure status
- Error re-thrown (logged by caller)
