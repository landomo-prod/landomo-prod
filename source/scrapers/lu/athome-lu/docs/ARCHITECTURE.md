# Architecture

> Technical design and implementation details of the ATHome.lu scraper

## Overview

The ATHome scraper leverages a **public JSON REST API** that requires no authentication. This makes it the fastest and most reliable scraper in the Benelux region. The three-phase checksum architecture processes ~15-20k listings in 5-10 minutes with 90-95% API call savings on repeat runs.

### Key Design Principles

1. **Public API First**: Direct JSON API access -- no browser or HTML parsing needed
2. **Type Safety**: Full TypeScript with strict typing from API response to database
3. **Checksum Optimization**: Only fetch details for new/changed listings
4. **New Build Support**: Project listings with children are expanded to individual units
5. **Resilience**: Retry logic, seenIds deduplication, graceful degradation

## Three-Phase Orchestration

### Phase 1: Listing Discovery (2-3 minutes)

**Purpose**: Collect all listing IDs with summary data via API pagination

**Implementation**: `src/scraper/threePhaseOrchestrator.ts`

**Combinations**: 8 total (4 property types x 2 transaction types)

| Property Type | Transaction | API `propertyType` |
|--------------|-------------|-------------------|
| Apartment | for-sale | `flat` |
| Apartment | for-rent | `flat` |
| House | for-sale | `house` |
| House | for-rent | `house` |
| Land | for-sale | `land` |
| Land | for-rent | `land` |
| Commercial | for-sale | `office` |
| Commercial | for-rent | `office` |

**Concurrency**: pLimit(3) -- 3 category combos fetched simultaneously

**Pagination**:
- Sequential pages per combo: `page=1, 2, 3, ...` with `pageSize=100`
- Termination: empty `data` array, all IDs already seen, or `data.length < pageSize`
- Delay: 200-500ms between pages

**New Build Handling**: Listings with `children[]` are expanded -- each child becomes a separate `DiscoveredListing` with the parent's address/contact but the child's price, bedrooms, surface, and floor.

**Deduplication**: `seenIds` Set per combo prevents duplicate processing.

**Output**: Array of ~15-20k `DiscoveredListing` objects

### Phase 2: Checksum Comparison (10-30 seconds)

**Purpose**: Identify which listings have actually changed

**Implementation**: `src/utils/checksumExtractor.ts`

**Checksum Fields** (change-sensitive):
- `id` -- Listing identifier
- `prices.min`, `prices.max` -- Price changes
- `status` -- Active/inactive transitions
- `surfaces.min` -- Area modifications
- `bedrooms` -- Room count changes
- `description` (first 100 chars) -- Text updates

**Hash**: MD5 of pipe-delimited field values

**Storage**: Checksums sent to ingest API in batches of 5000

**Output**: Classification of each listing as new/changed/unchanged

### Phase 3: Selective Fetching (5-10 minutes)

**Purpose**: Fetch full details only for new/changed properties

**Implementation**: `src/queue/detailQueue.ts`

**Detail Endpoint**: `GET /api-listings/listings/{id}` returns extended data including full description, features, and additional property attributes.

**Worker Processing**:
- 50 concurrent workers (configurable)
- Random delay 100-400ms per job (polite crawling)
- Batch ingestion (100 properties/request)
- Automatic retry with exponential backoff (3 attempts)

**Category Routing**: `transformByCategory()` routes to the correct transformer based on the ATHome `propertyType` parameter:

```
flat    -> transformApartment()
house   -> transformHouse()
land    -> transformLand()
office  -> transformCommercial()
```

## Queue Architecture

### BullMQ Configuration

**Queue**: `athome-details`

**Job Processing Flow**:

```
Job Received
    |
Random Delay (100-400ms)
    |
Fetch Detail (GET /api-listings/listings/{id})
    |
Check Response (null = listing removed)
    |  (exists)
Transform to TierI type
    |
Add to Batch (accumulator)
    |
Flush if Batch Full (100 properties)
    |
Return Success
```

### Batch Accumulation

**Strategy**: Accumulate properties in memory, flush when:
1. Batch reaches 100 properties
2. 5 seconds elapsed since last flush
3. Worker shutdown (graceful)

## Checksum System

**File**: `src/utils/checksumExtractor.ts`

**Lifecycle**:
1. **First Scrape**: No checksums exist -> all listings marked "new"
2. **Second Scrape**: Compare new checksums with stored -> ~90% unchanged
3. **Subsequent Scrapes**: Steady state with ~5% new, ~5% changed, ~90% unchanged

## Error Handling

### Retry Strategy

**Network Errors**: 3 attempts with exponential backoff (1s, 2s, 4s)

**Removed Listings**: 404/410 responses return null, job marked as skipped

**Transform Errors**: Log and continue (don't block entire batch)

### Graceful Degradation

**Phase 1 Failure**: Individual category combo failures are isolated (Promise.allSettled)
**Phase 2 Failure**: Checksum errors logged, scrape continues
**Phase 3 Failure**: Retry failed jobs up to 3 times

### Monitoring

**Scrape Run Tracking**: Start/complete/fail lifecycle via ScrapeRunTracker
**Prometheus Metrics**: Duration, success rate, throughput
**Queue Stats**: Waiting, active, completed, failed jobs (via `/health`)
