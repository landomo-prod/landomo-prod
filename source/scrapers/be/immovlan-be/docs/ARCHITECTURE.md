# Architecture

> Technical design and implementation details of the Immovlan scraper

## Overview

The Immovlan scraper implements a **three-phase checksum-optimized architecture** using HTML parsing. It processes ~30,000-50,000 listings across 8 category-transaction combinations with French-language URL paths.

## Three-Phase Orchestration

```
Phase 1: Discovery          Phase 2: Checksums         Phase 3: Detail Fetch
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ apartment/sale  │───┐    │                 │        │ BullMQ Queue    │
│ apartment/rent  │───┤    │ Compare with    │        │ ┌─────────────┐ │
│ house/sale      │───┤    │ ingest API      │───────>│ │ Worker x30  │ │
│ house/rent      │───┼───>│                 │        │ │ Fetch detail │ │
│ land/sale       │───┤    │ new/changed     │        │ │ Transform   │ │
│ land/rent       │───┤    │ only queued     │        │ │ Batch ingest│ │
│ commercial/sale │───┤    │                 │        │ └─────────────┘ │
│ commercial/rent │───┘    └─────────────────┘        └─────────────────┘
└─────────────────┘
   p-limit(3)                  5000/batch                  30 concurrent
```

### Phase 1: Listing Discovery

**URL pattern**: `immovlan.be/fr/biens-immobiliers/{a-vendre|a-louer}/{category}?page={N}`

**Data extraction strategies** (in priority order):
1. `__NEXT_DATA__` from `<script id="__NEXT_DATA__">` -- extracts `props.pageProps.results.items`
2. JSON-LD `<script type="application/ld+json">` with `itemListElement`
3. HTML fallback: `data-property-id` attribute on listing cards

**Pagination terminates when:**
- Results per page < 20
- All returned IDs already seen
- Empty page returned

### Phase 2: Checksum Comparison

- Batches of 5000 compared against ingest API
- New checksums stored for next run

### Phase 3: Selective Fetching

- Detail pages at `immovlan.be/en/property/{id}`
- Extracts `__NEXT_DATA__`, `__INITIAL_DATA__`, or JSON-LD
- 30 concurrent workers with random jitter
- Batch ingestion: 50 properties per request

## Error Handling

- Individual category combos fail independently (Promise.allSettled)
- 3 retry attempts with exponential backoff
- Rate limiting (429) respects Retry-After header
- Inactive listings (404/410) marked and skipped
