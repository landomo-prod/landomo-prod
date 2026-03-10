# Architecture

> Technical design and implementation details of the Realo BE scraper

## Overview

The Realo scraper uses Cheerio-based HTML parsing with Apollo GraphQL state extraction as a unique feature. It processes ~15,000-25,000 listings across 7 search path combinations.

## Three-Phase Orchestration

```
Phase 1: Discovery          Phase 2: Checksums         Phase 3: Detail Fetch
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ 7 search paths  │        │                 │        │ BullMQ Queue    │
│ (via p-limit 3) │───────>│ Compare with    │───────>│ ┌─────────────┐ │
│                 │        │ ingest API      │        │ │ Worker x50  │ │
│ Apollo/Next.js  │        │ 5000/batch      │        │ │ Detail HTML │ │
│ + HTML fallback │        │                 │        │ │ Transform   │ │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

### Phase 1: Listing Discovery

**URL pattern**: `realo.be/nl/{te-koop|te-huur}/{category}?page={N}`

**Data extraction strategies** (`parseListingsFromHTML`):

1. **Next.js data**: `$('script#__NEXT_DATA__')` -> `props.pageProps.listings`
2. **Apollo GraphQL state**: `__APOLLO_STATE__` or `window.__DATA__` in `<script>` tags
   - Scans all `<script>` elements for these patterns
   - Extracts properties from Apollo cache keys starting with `Property:` or `Listing:`
3. **JSON-LD**: `$('script[type="application/ld+json"]')` -> `ItemList.itemListElement`
4. **HTML cards**: `$('[data-property-id], .property-card, .listing-card, .search-result')`
   - Dutch-aware selectors: `[class*="slaapkamer"]` for bedrooms, `[class*="gemeente"]` for city

### Apollo State Extraction

Unique to Realo. The `extractPropertiesFromApolloState` function iterates over all keys in the Apollo cache:

```typescript
for (const key of Object.keys(state)) {
  if (key.startsWith('Property:') || key.startsWith('Listing:')) {
    // Extract property data from cache entry
  }
}
```

This handles Realo's GraphQL-based frontend where property data is stored in Apollo Client cache.

### Phase 2 & 3

Same pattern as Logic-Immo: all listings compared at once after Phase 1, then new/changed queued for detail fetch.

**Detail page extraction** also checks Apollo state in addition to Next.js and JSON-LD.

## Error Handling

- Individual search paths fail independently (Promise.allSettled)
- 429 rate limiting with Retry-After respect
- 200 page safety limit per path
- Detail fetch failures return null
