# Architecture

> Technical design and implementation details of the Immoweb scraper

## Overview

The Immoweb scraper implements a **three-phase checksum-optimized architecture** that minimizes API calls while maintaining data freshness. The system processes ~150,000 listings across 8 category-transaction combinations.

## Three-Phase Orchestration

```
Phase 1: Discovery          Phase 2: Checksums         Phase 3: Detail Fetch
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ APARTMENT/SALE  │───┐    │                 │        │ BullMQ Queue    │
│ APARTMENT/RENT  │───┤    │ Compare with    │        │ ┌─────────────┐ │
│ HOUSE/SALE      │───┤    │ ingest API      │───────>│ │ Worker x50  │ │
│ HOUSE/RENT      │───┼───>│                 │        │ │ Fetch detail │ │
│ LAND/SALE       │───┤    │ new: ~5%        │        │ │ Transform   │ │
│ LAND/RENT       │───┤    │ changed: ~5%    │        │ │ Batch ingest│ │
│ OFFICE/SALE     │───┤    │ unchanged: ~90% │        │ └─────────────┘ │
│ OFFICE/RENT     │───┘    └─────────────────┘        └─────────────────┘
└─────────────────┘
   p-limit(3)                  5000/batch                  50 concurrent
   5 pages/batch                                           300-800ms delay
```

### Phase 1: Listing Discovery (5-10 minutes)

**Purpose**: Collect all listing IDs with minimal data transfer

**Implementation**: `src/scraper/threePhaseOrchestrator.ts`

- 4 categories x 2 transaction types = 8 combinations
- p-limit(3) concurrency for category combos
- 5 concurrent pages per batch within each combo
- Dual-strategy fetching: JSON API then HTML fallback
- Deduplication via `seenIds` Set
- Early exit when page returns < 30 results or all IDs already seen

**Search strategies** (in order):
1. JSON API: `search.immoweb.be/en/search/classifieds?categories[]={CAT}&transactionTypes[]={TYPE}`
2. HTML with `<iw-search :results="">` attribute extraction
3. HTML with `<script>` tag JSON scanning

### Phase 2: Checksum Comparison (10-30 seconds)

**Purpose**: Identify which listings have actually changed

- Generates SHA-256 checksums from listing price, title, surface, bedrooms
- Compares in batches of 5000 against ingest API `listing_checksums` table
- Stores new checksums for next run
- Results: new (~5%), changed (~5%), unchanged (~90%)

### Phase 3: Selective Fetching (5-20 minutes)

**Purpose**: Fetch full details only for new/changed properties

- Filters to only new/changed listings from Phase 2
- Creates BullMQ jobs with listing data attached
- 50 concurrent workers with 300-800ms random jitter
- Detail fetch extracts `window.classified` JSON from HTML
- Fallback to JSON-LD `<script type="application/ld+json">`
- Batch ingestion: 50 properties per ingest API call
- Periodic flush every 5 seconds

## Queue Architecture

### BullMQ Configuration

**File**: `src/queue/detailQueue.ts`

**Queue**: `immoweb-details`

**Job Processing Flow**:
```
Job Received
    |
Add Random Delay (300-800ms)
    |
Check if listing data has description
    |--- Yes: Use attached data
    |--- No: Fetch detail page
              |
              Extract window.classified JSON
              |
              Fallback: JSON-LD
    |
Transform to TierI type
    |
Add to Batch (accumulator)
    |
Flush if Batch Full (50 properties)
    |
Return Success
```

### Batch Accumulation

**Strategy**: Accumulate properties in memory, flush when:
1. Batch reaches 50 properties
2. 5 seconds elapsed since last flush
3. Worker shutdown (graceful)

## Category Detection

Category is determined by the search URL parameters (APARTMENT, HOUSE, LAND, OFFICE). The `transformListing` function routes to the correct transformer:

| Input Category | Transformer |
|---------------|-------------|
| `APARTMENT`, `FLAT` | `transformApartment()` |
| `HOUSE` | `transformHouse()` |
| `LAND` | `transformLand()` |
| `OFFICE`, `COMMERCIAL`, `INDUSTRY` | `transformCommercial()` |

## Error Handling

### Retry Strategy

- **Network Errors**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **Rate Limiting (429)**: Respects `Retry-After` header
- **Cloudflare (403)**: Logs warning, returns empty results
- **Inactive Listings (404/410)**: Marks as inactive, skips

### Graceful Degradation

- **Phase 1 Failure**: Individual category combos fail independently (Promise.allSettled)
- **Phase 2 Failure**: Falls back to fetching all listings
- **Phase 3 Failure**: Retry failed jobs up to 3 times
