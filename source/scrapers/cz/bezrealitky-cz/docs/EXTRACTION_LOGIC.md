# BezRealitky - Extraction Logic

## Architecture Overview

```
Entry Point (index.ts)
    ↓
Discovery (listingsScraper.ts) → GraphQL API
    ↓
Checksum Generation (checksumExtractor.ts)
    ↓
Checksum Comparison (ChecksumClient)
    ↓
Transform New/Changed (transformers/)
    ↓
Batch Ingest (ingestAdapter.ts)
```

## Discovery Process

### Entry Point
```typescript
// src/index.ts
async function runScraper() {
  if (ENABLE_CHECKSUM_MODE) {
    // Checksum-optimized mode
    const result = await scrapeWithChecksums(apiUrl, apiKey, runId);
    listings = result.listings;
    stats = result.stats;
  } else {
    // Streaming mode (legacy)
    const scraper = new ListingsScraper();
    listings = await scraper.scrapeAll(streamBatch);
  }
}
```

### How It Works

**Checksum Mode**:
1. Fetch all listings via paginated GraphQL queries
2. Extract checksum fields (price, title, sqm, etc.)
3. Send checksums to ingest API for comparison
4. Get back list of new/changed listings
5. Transform only those listings
6. Batch ingest (100/request)

**Streaming Mode**:
1. Fetch listings in batches (100/query)
2. Transform batch immediately
3. Stream to ingest API
4. Continue until all listings fetched

### Pagination

**Method**: GraphQL offset-based pagination

```typescript
// src/scrapers/listingsScraper.ts
export class ListingsScraper {
  async scrapeAll(onBatch?: BatchCallback): Promise<BezRealitkyListingItem[]> {
    const limit = 100;
    let offset = 0;
    let allListings: BezRealitkyListingItem[] = [];

    while (true) {
      const response = await this.fetchBatch(limit, offset);
      const listings = response.data.listAdverts.list;
      
      if (listings.length === 0) break;
      
      allListings.push(...listings);
      
      if (onBatch) await onBatch(listings);
      
      offset += limit;
      
      // Brief delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return allListings;
  }
}
```

## GraphQL Fetching

### Query Construction

```typescript
const LISTINGS_QUERY = `query ListAdverts(
  $offerType: [OfferType],
  $estateType: [EstateType],
  $order: ResultOrder,
  $limit: Int,
  $offset: Int,
  $locale: Locale!
) {
  listAdverts(
    offerType: $offerType
    estateType: $estateType
    order: $order
    limit: $limit
    offset: $offset
    locale: $locale
  ) {
    totalCount
    list {
      # ~80 fields (see PORTAL_DATA_FORMAT.md)
    }
  }
}`;
```

### Variables

```typescript
const variables = {
  offerType: ['PRODEJ', 'PRONAJEM'], // Both sale and rent
  estateType: null, // All types
  order: 'timeOrder_desc', // Newest first
  limit: 100,
  offset: 0,
  locale: 'cs'
};
```

### HTTP Request

```typescript
async fetchBatch(limit: number, offset: number): Promise<BezRealitkyListResponse> {
  const response = await axios.post(
    BEZREALITKY_API_BASE,
    {
      query: LISTINGS_QUERY,
      variables: { limit, offset, locale: 'cs' }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getRandomUserAgent()
      }
    }
  );

  return response.data;
}
```

## Checksum Generation

### Extraction Logic

```typescript
// src/utils/checksumExtractor.ts
export function extractBezrealitkyChecksumFields(
  listing: BezRealitkyListingItem
): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    sqm: listing.surface ?? null,
    disposition: listing.disposition ?? null,
    floor: listing.floor ?? null,
  };
}
```

### Why These Fields?
- **price**: Most common change (price adjustments)
- **title**: Owner may update listing name
- **description**: Rare, but possible
- **sqm**: Corrections to area
- **disposition**: Changes in room layout
- **floor**: Corrections to floor number

### Fields NOT Included
- Images (change frequently, not significant)
- Visit count, conversation count (metadata)
- Timestamps (always changing)
- Agent info (not property-related)

## Checksum Comparison

### API Call

```typescript
// src/scrapers/listingsScraper.ts
const checksums = batchCreateBezrealitkyChecksums(allListings);

const checksumClient = new ChecksumClient(apiUrl, apiKey);
const comparison = await checksumClient.compareChecksums(checksums, runId);

console.log(`New: ${comparison.new}`);
console.log(`Changed: ${comparison.changed}`);
console.log(`Unchanged: ${comparison.unchanged}`);
console.log(`Savings: ${Math.round((comparison.unchanged / comparison.total) * 100)}%`);
```

### Comparison Result

```typescript
interface ChecksumBatchResponse {
  total: number;
  new: number;
  changed: number;
  unchanged: number;
  results: Array<{
    portalId: string;
    status: 'new' | 'changed' | 'unchanged';
  }>;
}
```

## Anti-bot Handling

### Portal Protection
- Rate limiting (not strictly enforced)
- User-Agent checking (basic)
- No CAPTCHA
- No IP blocking

### Our Strategy

```typescript
// src/utils/userAgents.ts
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...'
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
```

### Rate Limiting

```typescript
// 200ms delay between batches
await new Promise(resolve => setTimeout(resolve, 200));
```

## Error Handling

### GraphQL Errors

```typescript
try {
  const response = await axios.post(BEZREALITKY_API_BASE, { query, variables });
  if (response.data.errors) {
    log.error({ errors: response.data.errors }, 'GraphQL errors');
  }
  return response.data;
} catch (error) {
  log.error({ err: error }, 'Failed to fetch batch');
  throw error;
}
```

### Failed Listings

```typescript
const properties = batch.map(listing => {
  try {
    const transformedData = transformBezRealitkyToStandard(listing);
    return { portalId: listing.id, data: transformedData, rawData: listing };
  } catch (error: any) {
    log.error({ listingId: listing.id, err: error }, 'Error transforming listing');
    return null;
  }
}).filter(p => p !== null);
```

### Retry Logic

No automatic retry for GraphQL - if a batch fails, the entire scrape fails.
This is acceptable because:
1. GraphQL API is very reliable (99%+ uptime)
2. Failed scrapes re-run every 6 hours
3. Checksum mode allows quick recovery

## Performance

### Typical Runtime

**Checksum Mode** (15,000 listings):
- **Discovery**: 1-2 minutes (150 batches × 200ms delay)
- **Checksum Generation**: 5 seconds
- **Checksum Comparison**: 10 seconds (API call)
- **Transform New/Changed**: 30 seconds (2,000 listings)
- **Batch Ingest**: 30 seconds (20 batches × 100 listings)
- **Total**: ~3-4 minutes

**Streaming Mode** (15,000 listings):
- **Fetch + Transform + Ingest**: 4-5 minutes (interleaved)
- **Total**: ~4-5 minutes

### Optimizations

1. **Batch Fetching**: 100 listings/query
2. **Parallel Processing**: Transform batches concurrently
3. **Batch Ingestion**: 100 properties/request
4. **Checksum Comparison**: Skip 85-90% of listings
5. **GraphQL Field Selection**: Only request needed fields

### Memory Usage

- **Peak**: ~200MB (all listings in memory)
- **Streaming**: ~50MB (only current batch)

### Network Usage

- **Discovery**: ~15MB (15,000 × 1KB/listing)
- **Checksum Comparison**: ~500KB (checksums)
- **Ingestion**: ~10MB (2,000 × 5KB/property)
- **Total**: ~25MB per scrape
