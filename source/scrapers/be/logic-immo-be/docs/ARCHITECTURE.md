# Architecture

> Technical design and implementation details of the Logic-Immo BE scraper

## Overview

The Logic-Immo scraper uses Cheerio-based HTML parsing with a three-phase checksum-optimized architecture. It processes ~25,000-40,000 listings across 7 search path combinations.

## Three-Phase Orchestration

```
Phase 1: Discovery          Phase 2: Checksums         Phase 3: Detail Fetch
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ 7 search paths  │        │                 │        │ BullMQ Queue    │
│ (via p-limit 3) │───────>│ Compare with    │───────>│ ┌─────────────┐ │
│                 │        │ ingest API      │        │ │ Worker x50  │ │
│ Cheerio parsing │        │ 5000/batch      │        │ │ Detail HTML │ │
│ per page        │        │                 │        │ │ Transform   │ │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

### Phase 1: Listing Discovery

**Implementation**: `src/utils/fetchData.ts:fetchAllListingPages()`

- 7 search path combinations run through p-limit(3)
- Each path paginates sequentially (`?page=N`)
- 200-500ms delay between pages
- Max 200 pages per path (safety limit)
- Global `seenIds` Set for cross-path deduplication

**HTML parsing** (`parseListingsFromHTML`):

1. **Next.js data**: `$('script#__NEXT_DATA__')` -> `props.pageProps.listings`
2. **JSON-LD**: `$('script[type="application/ld+json"]')` -> `ItemList.itemListElement`
3. **HTML cards**: `$('[data-listing-id], .property-card, .listing-item, .result-item')`
   - Price from `.price` or `[class*="price"]`
   - Surface from `[class*="surface"]` or `[class*="area"]`
   - Rooms from `[class*="room"]`
   - Bedrooms from `[class*="bedroom"]`
   - City from `[class*="location"]` or `[class*="city"]`

### Phase 2: Checksum Comparison

- All listings from Phase 1 compared in batches of 5000
- Unlike immoweb/zimmo, logic-immo runs Phase 2 after ALL categories are fetched (not per-category)

### Phase 3: Selective Fetching

**Detail page fetch** (`fetchListingDetail`):
- URL: `logic-immo.be/fr/detail/{id}` or full URL from listing data
- Same three-strategy extraction as search pages
- HTML fallback extracts `h1` title and price from `[class*="price"]`

## Detail Fetch Architecture

Unlike immoweb/zimmo where listing data may be attached to the job, Logic-Immo always fetches the detail page to get full property data. The `DetailJob` interface uses `listingId` and `url` fields (not `listingData`).

## Error Handling

- Individual search paths fail independently (Promise.allSettled)
- 429 rate limiting: respects Retry-After header, retries same page
- Other errors: logs and stops pagination for that path
- Detail fetch failures: returns null (job marked as failed)
