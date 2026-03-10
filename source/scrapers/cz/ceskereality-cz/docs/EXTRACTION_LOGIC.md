# CeskeReality - Extraction Logic

## Architecture Overview

```
Express Server (index.ts, port 8109)
    |
    POST /scrape
    |
    scrapeListings() [listingsScraper.ts]
    |
    For each CATEGORY (apartment, house, land, commercial):
    |   |
    |   scrapeCategory()
    |   |
    |   Paginate listing pages: scrapeListingPage()
    |   |   - fetch HTML -> Cheerio parse
    |   |   - Collect detail URLs via a[href*="/prodej/"][href$=".html"]
    |   |
    |   For each detail URL: scrapeDetailPage()
    |   |   - fetch HTML -> Cheerio parse
    |   |   - Extract JSON-LD from <script type="application/ld+json">
    |   |   - Extract images from gallery
    |   |   - Extract property details from .i-info table
    |   |   - Extract energy rating
    |   |
    |   Batch send to ingest (50 per batch)
    |
    ScrapeRunTracker: start/complete/fail
```

## Discovery Process

### Entry Point

`POST /scrape` triggers `scrapeListings()` which iterates through 4 hardcoded category URLs:

```typescript
const CATEGORIES = [
  { name: 'apartments', url: 'https://www.ceskereality.cz/prodej/byty/', type: 'apartment' },
  { name: 'houses', url: 'https://www.ceskereality.cz/prodej/rodinne-domy/', type: 'house' },
  { name: 'land', url: 'https://www.ceskereality.cz/prodej/pozemky/', type: 'land' },
  { name: 'commercial', url: 'https://www.ceskereality.cz/prodej/komercni/', type: 'commercial' }
];
```

### Pagination

- **Method**: Query parameter `?strana={page}`
- **Max pages**: Controlled by `MAX_PAGES` env var (default: 5)
- **Stop condition**: No listings found on page, or max pages reached
- **Delay**: `DELAY_MS` (default: 500ms) between page requests

### URL Collection

`scrapeListingPage(url)` fetches listing page HTML and extracts detail URLs:

```typescript
$('a[href*="/prodej/"][href$=".html"]').each((_, el) => {
  const href = $(el).attr('href');
  // Resolve relative URLs to absolute
  const absoluteUrl = href.startsWith('http') ? href : `https://www.ceskereality.cz${href}`;
  listingUrls.add(absoluteUrl); // Set for deduplication
});
```

URLs are further deduplicated across pages with `[...new Set(allListingUrls)]`.

## Detail Extraction

### Method
- **Approach**: Sequential (one detail page at a time within each category)
- **Alternative**: Queue-based parallel via `detailQueue.ts` (BullMQ, 50 concurrency)

### `scrapeDetailPage(url)` extracts three data layers:

**1. JSON-LD (primary)**
```typescript
const jsonLdScript = $('script[type="application/ld+json"]').first();
const jsonLd = JSON.parse(jsonLdScript.html());
```
Listings without JSON-LD are skipped (returns `null`).

**2. Property Details Table**
```typescript
$('.i-info').each((_, el) => {
  const label = $(el).find('.i-info__title').text().trim();
  const value = $(el).find('.i-info__value').text().trim();
  propertyDetails[label] = value;
});
```

**3. Images**
```typescript
$('img[src*="img.ceskereality.cz/foto"]').each((_, el) => {
  const src = $(el).attr('src');
  // Filter out logos/icons/agent photos
  // Strip query params for full resolution
  const fullSizeUrl = src.split('?')[0];
  images.push(fullSizeUrl);
});
```

**4. Energy Rating**
```typescript
const energyRating = $('.s-estate-detail-intro__energy').text().trim();
```

### Output Format

```typescript
interface ScrapedListing {
  url: string;
  jsonLd: any;           // Parsed JSON-LD object
  htmlData?: {
    images?: string[];                    // Full-res image URLs
    propertyDetails?: Record<string, string>; // Czech label -> value
    energyRating?: string;                // Raw energy text
  };
}
```

## Queue-Based Alternative

`src/queue/detailQueue.ts` provides a BullMQ-based parallel processing path:

- **Queue name**: `ceskereality-details`
- **Default concurrency**: 50
- **Rate limit**: 1000 jobs per 60 seconds
- **Retry**: 3 attempts with exponential backoff (1s base)
- **Batch size**: 100 properties per ingest call
- **Periodic flush**: Every 5 seconds
- **Job cleanup**: Completed removed after 1 hour, failed after 2 hours

## Anti-bot Measures

### Portal Protection
- None detected. Plain HTTP fetch works without headers or browser emulation.

### Our Strategy
- Simple delay between requests (`DELAY_MS`, default 500ms)
- Queue-based path adds random 200-500ms delay per detail page
- No user-agent spoofing or cookie handling needed

## Error Handling

### Detail Page Failures
- `scrapeDetailPage` returns `null` on error (logged but not fatal)
- Missing JSON-LD causes skip (warns to console)
- Individual listing errors don't stop the category scrape

### Category Failures
- Errors in `scrapeCategory` are thrown and caught by `scrapeListings`
- `ScrapeRunTracker.fail()` records the error

### Queue Worker Retries
- 3 attempts with exponential backoff
- Failed jobs kept for 2 hours for debugging
- Batch not cleared on ingest failure (retried on next flush)

## Scrape Run Tracking

`ScrapeRunTracker` (best-effort, 5s timeout per call):

1. `start()` - POST to `/api/v1/scrape-runs/start` with portal name `ceskereality-cz`
2. `complete()` - POST to `/api/v1/scrape-runs/{id}/complete`
3. `fail(errorMessage)` - POST to `/api/v1/scrape-runs/{id}/fail`

All tracking calls are non-fatal (caught and warned).
