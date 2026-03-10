# Realingo - Extraction Logic

## Architecture Overview

```
Entry Point (index.ts)
    |
    +--> POST /scrape triggers runScraper()
    |
    v
ListingsScraper (listingsScraper.ts)
    |
    +--> scrapeSales(onBatch)    -- purpose: SELL
    +--> scrapeRentals(onBatch)  -- purpose: RENT
    |
    v
scrapeAll(variables, onBatch)
    |
    +--> fetchOffers() per page (GraphQL POST)
    +--> onBatch() streams each page to IngestAdapter
    |
    v
Raw RealingoOffer[] output
```

## Discovery Process

### Entry Point
The scraper is triggered via `POST /scrape`. It returns 202 immediately and runs in the background.

### How It Works
1. Sales are scraped first with `purpose: SELL`
2. Rentals are scraped second with `purpose: RENT`
3. Each uses the `scrapeAll()` method which paginates through all results
4. In streaming mode (default), each page of results is transformed and sent to the ingest API immediately via `onBatch` callback

### Pagination
- **Method**: GraphQL `first`/`skip` variables
- **Page Size**: 100 items per request
- **Logic**: First request gets `total` count. Loop increments `skip` by items received until all fetched.
- **Termination**: Stops when `allListings.length >= total` or empty page returned

```typescript
// From listingsScraper.ts
const first = 100;
let skip = 0;
const firstPage = await this.fetchOffers(variables, first, skip);
total = firstPage.total;

while (allListings.length < total) {
  skip = allListings.length;
  const page = await this.fetchOffers(variables, first, skip);
  // ...
}
```

## Detail Extraction

There is **no separate detail extraction step**. All data comes from the `searchOffer` GraphQL query at list level. The API does not expose a detail endpoint that provides additional fields.

## Streaming Mode

In streaming mode (default, `ENABLE_CHECKSUM_MODE !== 'true'`):

1. Each page of results is passed to `onBatch` callback
2. The callback transforms listings and sends them to ingest API
3. This allows ingestion to proceed while scraping continues
4. The `purpose` field is force-set on each batch (`SELL` or `RENT`) as a fallback

```typescript
// From index.ts
const streamBatch = async (batch: RealingoOffer[]) => {
  const properties = batch.map((listing) => ({
    portalId: listing.id,
    data: transformRealingoToStandard(listing),
    rawData: listing
  })).filter(p => p !== null);
  await adapter.sendProperties(properties);
};
```

## Checksum Mode

When `ENABLE_CHECKSUM_MODE=true`:

1. All listings are scraped first (no streaming)
2. Checksums are computed for each listing using `checksumExtractor.ts`
3. Checksums are compared against database in batches of 1000 via `ChecksumClient`
4. Only new/changed listings are sent for ingestion
5. Updated checksums are stored in database

This reduces ingestion load when most listings are unchanged.

## Anti-bot Measures

### Portal Protection
- None detected. The GraphQL API is publicly accessible without authentication.

### Our Strategy
- Standard User-Agent header
- 500ms delay between pagination requests

### Rate Limiting
- **Delay**: 500ms between page requests
- **Batch Size**: 100 items per GraphQL request
- **Checksum Batch Delay**: 100ms between checksum comparison batches

## Error Handling

### Retry Logic
- No built-in retry on individual page failures
- GraphQL errors are logged with full error response
- Failed transformation of individual listings logs error and skips the listing

### Failed Listings
- Transform errors: logged via `createLogger`, listing skipped, others continue
- Batch stream errors: logged, continue with next batch
- Full scrape failure: `tracker.fail()` called, error re-thrown

### ScrapeRunTracker
- `tracker.start()` at beginning
- `tracker.complete({...})` on success with stats
- `tracker.fail()` on error
- Best-effort, 5s timeout

## Performance

### Typical Runtime
- Depends on total listing count and API response times
- 500ms delay per page, 100 items/page
- For 5000 listings: ~25 pages, ~12.5s of delays + network time

### Optimizations
- Streaming mode: ingestion happens in parallel with scraping
- Checksum mode: skip unchanged listings entirely
- No browser/Puppeteer overhead -- pure HTTP/GraphQL
