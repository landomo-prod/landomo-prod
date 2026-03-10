# Architecture

> Technical design and implementation details of the SReality scraper

## Table of Contents

- [Overview](#overview)
- [Three-Phase Orchestration](#three-phase-orchestration)
- [Queue Architecture](#queue-architecture)
- [Category Detection](#category-detection)
- [Transformation Pipeline](#transformation-pipeline)
- [Checksum System](#checksum-system)
- [Data Model](#data-model)

## Overview

The SReality scraper implements a **three-phase checksum-optimized architecture** that minimizes API calls while maintaining data freshness. The system processes ~100,000 listings in 10-15 minutes with 90-95% API call savings.

### Key Design Principles

1. **Separation of Concerns**: Discovery, comparison, and fetching are independent phases
2. **Type Safety**: Full TypeScript with strict typing from API to database
3. **Scalability**: Queue-based architecture supports horizontal scaling
4. **Efficiency**: Checksum-based change detection avoids redundant fetches
5. **Resilience**: Retry logic, error handling, and graceful degradation

## Three-Phase Orchestration

### Phase 1: Listing Discovery (2-3 minutes)

**Purpose**: Collect all listing IDs with minimal data transfer

**Implementation**: `src/scraper/threePhaseOrchestrator.ts:60-84`

```typescript
// Parallel page fetching (20 pages/batch)
for (const category of CATEGORIES) {
  for (const categoryType of CATEGORY_TYPES) {
    const listings = await fetchAllListingPages(category, categoryType);
    allListings.push(...listings);
  }
}
```

**Optimizations**:
- **Concurrent Pages**: Fetch 20 pages simultaneously per category
- **Header Rotation**: Generate fresh User-Agent per request (anti-bot)
- **Minimal Data**: Only extract listing ID, price, title, category
- **Early Exit**: Stop when empty page encountered

**Output**: Array of ~100,000 lightweight listing objects

### Phase 2: Checksum Comparison (10-30 seconds)

**Purpose**: Identify which listings have actually changed

**Implementation**: `src/scraper/threePhaseOrchestrator.ts:106-145`

```typescript
// Generate checksums from lightweight data
const checksums = batchCreateSRealityChecksums(allListings);

// Compare with stored checksums
const comparison = await checksumClient.compareChecksums(checksums, scrapeRunId);

// Results: new, changed, unchanged
stats.phase2.new = comparison.new;           // ~5%
stats.phase2.changed = comparison.changed;   // ~5%
stats.phase2.unchanged = comparison.unchanged; // ~90%
```

**Checksum Fields** (change-sensitive only):
- `price` - Most common change trigger
- `title` - Property name updates
- `description` - Rare but significant
- `bedrooms` / `bathrooms` - Size changes
- `sqm` - Area modifications

**Storage**: New checksums stored in `listing_checksums` table for next run

**Output**: Classification of each listing (new/changed/unchanged)

### Phase 3: Selective Fetching (5-10 minutes)

**Purpose**: Fetch full details only for new/changed properties

**Implementation**: `src/scraper/threePhaseOrchestrator.ts:150-172`

```typescript
// Filter to only new/changed listings
const toFetch = comparison.results
  .filter((r) => r.status !== 'unchanged')
  .map((r) => r.portalId);

// Queue detail fetch jobs
const jobs = allListings
  .filter((listing) => toFetchSet.has(listing.hash_id.toString()))
  .map((listing) => ({
    hashId: listing.hash_id,
    category: listing.seo?.category_main_cb ?? 1,
    url: `https://www.sreality.cz/api/cs/v2/estates/${listing.hash_id}`,
  }));

await addDetailJobs(jobs); // ~5-10k jobs instead of 100k
```

**Worker Processing**:
- 200 concurrent workers (configurable)
- Rate limiting (20k jobs/60s)
- Batch ingestion (100 properties/request)
- Automatic retry with exponential backoff

## Queue Architecture

### BullMQ Configuration

**File**: `src/queue/detailQueue.ts`

```typescript
export const detailQueue = new Queue('sreality-details', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 500, age: 7200 },
  },
});
```

### Worker Pool

**Concurrency**: 200 workers (default)

**Job Processing Flow**:

```
Job Received
    ↓
Apply Rate Limiting (srealityRateLimiter)
    ↓
Add Random Jitter (5-15ms)
    ↓
Fetch Detail Page (with rotating headers)
    ↓
Check if Inactive (HTTP 410 or logged_in=false)
    ↓ (active)
Transform to StandardProperty
    ↓
Add to Batch (accumulator)
    ↓
Flush if Batch Full (100 properties)
    ↓
Return Success
```

### Batch Accumulation

**Strategy**: Accumulate properties in memory, flush when:
1. Batch reaches 100 properties
2. 5 seconds elapsed since last flush
3. Worker shutdown (graceful)

**Benefits**:
- Reduces HTTP requests to ingest service (100x reduction)
- Improves database performance (bulk UPSERT)
- Lower network overhead

## Category Detection

**File**: `src/utils/categoryDetection.ts`

### Detection Strategy

**Primary**: API category field (`seo.category_main_cb`)

```typescript
if (categoryId === 1) return 'apartment';  // Byty
if (categoryId === 2) return 'house';      // Domy
if (categoryId === 3) return 'land';       // Pozemky
if (categoryId === 4) return 'commercial'; // Komerční
if (categoryId === 5) return 'other';      // Ostatní
```

**Fallback**: Title keyword matching

```typescript
// Land keywords
if (titleStr.includes('pozemek') || titleStr.includes('parcela'))
  return 'land';

// House keywords
if (titleStr.includes('dům') || /\brd\b/.test(titleStr))
  return 'house';

// Apartment keywords
if (titleStr.includes('byt') || /\d\+(?:kk|1)/.test(titleStr))
  return 'apartment';
```

**Error Handling**: Throws descriptive error if unable to detect

## Transformation Pipeline

### Category Router

**File**: `src/transformers/srealityTransformer.ts`

```typescript
export function transformSRealityToStandard(listing: SRealityListing) {
  const category = detectCategoryFromSreality(listing);

  switch (category) {
    case 'apartment': return transformApartment(listing);
    case 'house': return transformHouse(listing);
    case 'land': return transformLand(listing);
    case 'commercial': return transformCommercial(listing);
    case 'other': return transformOther(listing);
  }
}
```

### Apartment Transformer Example

**File**: `src/transformers/apartments/apartmentTransformer.ts`

**Three-Tier Data Model**:

```typescript
return {
  // === Tier I: Core Universal Fields ===
  property_category: 'apartment',
  bedrooms: bedroomsFromDisposition(disposition),
  sqm: parser.getAreaOr(FIELD_NAMES.LIVING_AREA, ...),
  has_elevator: ensureBoolean(parser.getBoolean(FIELD_NAMES.ELEVATOR)),
  has_balcony: ensureBoolean(parser.getBoolean(FIELD_NAMES.BALCONY)),
  has_parking: ensureBoolean(parser.getBoolean(FIELD_NAMES.PARKING)),
  has_basement: ensureBoolean(parser.getBoolean(FIELD_NAMES.BASEMENT)),

  // === Tier II: Country-Specific (Czech) ===
  country_specific: {
    czech: {
      disposition: normalizeDisposition(disposition),    // "2+kk", "3+1"
      ownership: normalizeOwnership(ownershipRaw),       // "personal", "cooperative"
      condition: normalizeCondition(conditionRaw),       // "new", "good", etc.
      heating_type: normalizeHeatingType(heating_type),  // "gas", "electric"
      energy_rating: normalizeEnergyRating(energy_class) // "A", "B", "C"
    }
  },

  // === Tier III: Portal Metadata (SReality) ===
  portal_metadata: {
    sreality: {
      hash_id: hashId,
      category_main_cb: listing.seo?.category_main_cb,
      labels: listing.labels,
      is_auction: listing.is_auction,
      has_floor_plan: listing.has_floor_plan === 1,
      has_video: listing.has_video === 1,
      virtual_tour_url: virtualTourUrl
    }
  }
};
```

### Type-Safe Field Parser

**File**: `src/utils/itemsParser.ts`

**Single-Pass Parsing**:

```typescript
export class SRealityItemsParser {
  private fieldMap: Map<string, SRealityItemField>;

  constructor(items: SRealityItemField[]) {
    // O(n) initialization - build lookup map
    this.fieldMap = new Map(items.map(item => [item.name, item]));
  }

  // O(1) lookups
  getString(fieldName: FieldName): string | undefined
  getBoolean(fieldName: FieldName): boolean | undefined
  getArea(fieldName: FieldName): number | undefined
  getAreaOr(...fieldNames: FieldName[]): number | undefined
}
```

**Benefits**:
- Single O(n) pass through items array
- O(1) field lookups
- Type-safe field names (compile-time checks)
- Consistent error handling

## Checksum System

### Purpose

Avoid re-fetching property details when nothing meaningful changed. A listing's images, agent contact info, or view count might change daily, but these don't warrant a full detail fetch. Only changes to price, size, or description trigger re-fetching.

### Implementation

**File**: `src/utils/checksumExtractor.ts`

```typescript
export function extractSRealityChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price_czk?.value_raw ?? null,
    title: listing.name ?? null,
    description: listing.text?.value ?? null,
    bedrooms: extractBedroomsFromItems(listing.items),
    bathrooms: extractBathroomsFromItems(listing.items),
    sqm: extractSqmFromItems(listing.items),
  };
}
```

**Hash Generation**: SHA-256 of JSON-serialized fields

**Storage**: `listing_checksums` table (portal + portal_id + content_hash)

**Lifecycle**:
1. **First Scrape**: No checksums exist → all listings marked "new"
2. **Second Scrape**: Compare new checksums with stored → 90% unchanged
3. **Subsequent Scrapes**: Steady state with ~5% new, ~5% changed, ~90% unchanged

## Data Model

### Three-Tier Architecture

**Tier I**: Category-specific database partitions
- `properties_apartment` (60k rows)
- `properties_house` (25k rows)
- `properties_land` (8k rows)
- `properties_commercial` (6k rows)
- `properties_other` (1.2k rows)

**Tier II**: Country-specific JSONB column (`country_specific`)
- Czech-specific fields: disposition, ownership, energy_rating
- Normalized to canonical values for search

**Tier III**: Portal metadata JSONB column (`portal_metadata`)
- SReality-specific fields: hash_id, labels, flags
- Raw data preserved for debugging

### Benefits

1. **Partition Pruning**: Queries filter by `property_category` → 80% faster
2. **Type Safety**: Category-specific TypeScript types enforce required fields
3. **Storage Efficiency**: 40-60% reduction vs. denormalized schema
4. **Search Performance**: 42 indexes per partition vs. 42 total
5. **Flexibility**: Easy to add country/portal-specific fields

## Error Handling

### Retry Strategy

**Network Errors**: 3 attempts with exponential backoff (1s, 2s, 4s)

**Rate Limiting**: 20k jobs/60s with automatic throttling

**Inactive Listings**: Detect and skip (HTTP 410, logged_in=false)

**Transform Errors**: Log and continue (don't block entire batch)

### Graceful Degradation

**Phase 1 Failure**: Abort scrape, log error
**Phase 2 Failure**: Fall back to fetching all listings (no checksum optimization)
**Phase 3 Failure**: Retry failed jobs up to 3 times

### Monitoring

**Scrape Run Tracking**: Start/complete/fail lifecycle
**Prometheus Metrics**: Duration, success rate, throughput
**Queue Stats**: Waiting, active, completed, failed jobs

## Performance Tuning

### Memory Management

**Worker Memory**: ~4GB total for 200 workers
**Batch Size**: 100 properties (balance throughput vs. timeout)
**Job Cleanup**: Remove completed jobs after 1 hour

### Network Optimization

**Header Rotation**: Unique User-Agent per request
**Connection Pooling**: Reuse HTTP connections
**Rate Limiting**: Respect API limits (20k/min)

### Database Optimization

**Bulk UPSERT**: 100 properties per transaction
**Connection Pooling**: Reuse database connections
**Indexed Fields**: price, sqm, bedrooms, status, category

## Future Improvements

1. **Incremental Discovery**: Skip pages with no recent changes
2. **Smart Scheduling**: Prioritize high-value categories (apartments/houses)
3. **Distributed Workers**: Scale across multiple machines
4. **CDN Caching**: Cache listing pages (1-hour TTL)
5. **Real-time Updates**: WebSocket connection for instant changes
