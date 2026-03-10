# iDNES Reality - Extraction Logic

## Architecture Overview

```
Express Server (index.ts :8102)
    |
    POST /scrape
    |
    +-- Checksum Mode? ──Yes──> scrapeWithChecksums()
    |                              |-> scrapeAll() (all categories)
    |                              |-> batchCreateIdnesChecksums()
    |                              |-> ChecksumClient.compareChecksums()
    |                              |-> Filter to new/changed only
    |                              \-> ChecksumClient.updateChecksums()
    |
    +-- Legacy Mode ───────> ListingsScraper.scrapeAll(streamBatch)
                                |-> Per-category scraping
                                |-> transformIdnesToStandard() per listing
                                |-> IngestAdapter.sendProperties() per batch
```

## Discovery Process

### Entry Point
`POST /scrape` triggers `runScraper()` which delegates to `ListingsScraper.scrapeAll()`.

### Category Iteration
The scraper iterates over 8 hardcoded categories defined in `CATEGORIES`:

```typescript
const CATEGORIES = [
  { name: 'Flats for Sale',      url: '.../s/prodej/byty/',     type: 'sale', propertyType: 'apartment' },
  { name: 'Flats for Rent',      url: '.../s/pronajem/byty/',   type: 'rent', propertyType: 'apartment' },
  { name: 'Houses for Sale',     url: '.../s/prodej/domy/',     type: 'sale', propertyType: 'house' },
  { name: 'Houses for Rent',     url: '.../s/pronajem/domy/',   type: 'rent', propertyType: 'house' },
  { name: 'Land for Sale',       url: '.../s/prodej/pozemky/',  type: 'sale', propertyType: 'land' },
  { name: 'Commercial for Sale', url: '.../s/prodej/komercni/', type: 'sale', propertyType: 'commercial' },
  { name: 'Commercial for Rent', url: '.../s/pronajem/komercni/', type: 'rent', propertyType: 'commercial' },
  { name: 'Recreation for Sale', url: '.../s/prodej/rekreacni/', type: 'sale', propertyType: 'recreation' },
];
```

Each category's `transactionType` and `propertyType` are stamped onto every listing after extraction.

### Pagination
1. Fetch first page HTML
2. Parse listings from HTML using Cheerio
3. Look for next page link: `a.next`, `a[rel="next"]`, `.pagination__next`, `[aria-label*="next"]`
4. If found, fetch next page with `RATE_LIMIT_DELAY` ms delay
5. Stop when: no next link, empty page, or `MAX_PAGES_PER_CATEGORY` reached

### Listing Extraction from HTML
Multiple CSS selectors tried in order for listing items:
1. `.c-products__item`
2. `.estate-item`
3. `[data-dot="hp_product"]`
4. `.property-item`

First matching selector is used for all items on that page.

## Detail Page Enrichment

### When Enabled
Controlled by `FETCH_DETAILS` env var (default: `true`). When enabled, each listing URL is fetched individually after list-page discovery.

### What It Adds
- Full description text
- Feature/amenity list
- Image gallery URLs
- Coordinates (from scripts, data attributes, or meta tags)
- Property attributes (floor, ownership, condition, furnished, energy, heating, construction)

### Rate Limiting
- 500-1000ms random delay between detail page fetches (`500 + Math.random() * 500`)
- Progress logged every 10 listings

### Attribute Parsing
Detail page attributes (`_attributes`) are parsed by `parseDetailAttributes()` in `ListingsScraper`:
- Normalizes Czech attribute keys (podlazi/patro -> floor, vlastnictvi -> ownership, etc.)
- Handles multiple label variants for the same field
- Floor parsing handles "prizemni" (ground = 0) and "N. podlazi/patro" patterns

## Streaming vs Batch

### Streaming Mode (Legacy)
- Each category is scraped, then immediately sent to ingest via `onBatch` callback
- `transformIdnesToStandard()` runs inline before sending
- Failed transforms are filtered out (null check)

### Checksum Mode
- All categories scraped first into memory
- Checksums generated for all listings
- Compared against database via `ChecksumClient`
- Only new/changed listings filtered for ingestion
- Checksums updated after comparison

## Error Handling

### Per-Listing
- Detail page fetch failures: listing kept with list-page data only (warn logged)
- Transform failures: listing skipped, error logged with listing ID

### Per-Category
- Category-level errors caught and logged, scraper continues to next category

### Per-Batch (Streaming)
- Batch send failures logged but don't stop scraping

## Performance

### No Headless Browser
Uses native `fetch` + Cheerio instead of Puppeteer/Playwright, making it lightweight and fast.

### Request Headers
```
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...Chrome/120.0.0.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: cs,en;q=0.5
```
