# Architecture

> Technical design and implementation details of the Zimmo scraper

## Overview

The Zimmo scraper implements a **three-phase checksum-optimized architecture** using HTML parsing with Next.js data extraction. It processes ~40,000-60,000 listings across 8 category-transaction combinations.

## Three-Phase Orchestration

```
Phase 1: Discovery          Phase 2: Checksums         Phase 3: Detail Fetch
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ apartment/sale  │───┐    │                 │        │ BullMQ Queue    │
│ apartment/rent  │───┤    │ Compare with    │        │ ┌─────────────┐ │
│ house/sale      │───┤    │ ingest API      │───────>│ │ Worker x30  │ │
│ house/rent      │───┼───>│                 │        │ │ Fetch detail │ │
│ land/sale       │───┤    │ new: ~5%        │        │ │ Transform   │ │
│ land/rent       │───┤    │ changed: ~5%    │        │ │ Batch ingest│ │
│ commercial/sale │───┤    │ unchanged: ~90% │        │ └─────────────┘ │
│ commercial/rent │───┘    └─────────────────┘        └─────────────────┘
└─────────────────┘
   p-limit(3)                  5000/batch                  30 concurrent
   3 pages/batch                                           500-1500ms delay
```

### Phase 1: Listing Discovery (5-10 minutes)

**Implementation**: `src/scraper/threePhaseOrchestrator.ts`

- 4 categories x 2 transaction types = 8 combinations
- p-limit(3) concurrency for category combos
- 3 concurrent pages per batch
- Dutch URL slugs: `zimmo.be/nl/{te-koop|te-huur}/{category}/?pagina={N}`
- 500-1500ms delay between page fetches
- 1500ms delay between page batches

**Data extraction strategies** (in priority order):
1. `__NEXT_DATA__` JSON from `<script id="__NEXT_DATA__">` tag
2. JSON-LD `<script type="application/ld+json">` structured data
3. HTML card parsing via `data-property-id` attributes

**Pagination terminates when:**
- Page returns empty results
- All returned IDs already seen (deduplication)
- Results per page < 24

### Phase 2: Checksum Comparison (10-30 seconds)

- Batches of 5000 checksums compared against ingest API
- Checksums stored after comparison for next run

### Phase 3: Selective Fetching (5-15 minutes)

- Detail fetch from `zimmo.be/en/property/{id}`
- Extracts `__NEXT_DATA__` or `__INITIAL_STATE__` or JSON-LD
- 30 concurrent workers, 500-1500ms jitter
- Batch ingestion: 50 properties per request

## Queue Architecture

**Queue**: `zimmo-details`

**Job Processing Flow**:
```
Job Received
    |
Add Random Delay (500-1500ms)
    |
Check if listing has description
    |--- Yes: Use attached data
    |--- No: Fetch detail page (HTML)
              |
              Extract __NEXT_DATA__ JSON
              |
              Fallback: __INITIAL_STATE__
              |
              Fallback: JSON-LD
    |
Transform to TierI type
    |
Add to Batch (accumulator)
    |
Flush if Batch Full (50 properties)
```

## Error Handling

- Individual category combos fail independently (Promise.allSettled)
- 3 retry attempts with exponential backoff
- Rate limiting (429) respects Retry-After header
- Inactive listings (404/410) marked and skipped
