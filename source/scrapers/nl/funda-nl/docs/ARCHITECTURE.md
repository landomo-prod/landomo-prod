# Architecture

> Technical design and implementation details of the Funda scraper

## Overview

The Funda scraper implements a **three-phase checksum-optimized architecture** that parses HTML pages using Cheerio. Unlike API-based scrapers, Funda requires web scraping because there is no public API. The scraper extracts structured data from Next.js `__NEXT_DATA__` script tags with fallback to HTML element parsing.

**Critical constraint:** Funda deploys aggressive bot detection (captcha walls). This scraper works for development/testing but production use requires stealth measures (residential proxies, Puppeteer stealth).

### Key Design Principles

1. **Dual Extraction:** `__NEXT_DATA__` JSON extraction with HTML fallback
2. **Dutch Locale Mimicry:** Headers use `nl-NL` locale and Dutch browser fingerprints
3. **Conservative Rate Limiting:** Low concurrency and delays to avoid captcha triggers
4. **Checksum Optimization:** Skip unchanged listings on repeat runs

## Three-Phase Orchestration

### Phase 1: Listing Discovery (5-10 minutes)

**Purpose:** Collect all listing summaries from search pages

**Implementation:** `src/scraper/threePhaseOrchestrator.ts`

The orchestrator fetches two transaction types in parallel (limited to 2 concurrent):
- `koop` (sale) — typically 40-60k listings
- `huur` (rent) — typically 20-30k listings

For each transaction type, search pages are fetched with `CONCURRENT_PAGES` (default: 5) parallel requests.

**Search Page Parsing** (`src/utils/fetchData.ts`):

1. **Primary:** Extract from `<script id="__NEXT_DATA__">` — parses `props.pageProps.searchResult.resultList`
2. **Fallback:** Parse HTML listing cards using `[data-test-id="search-result-item"]` selectors
3. **Pagination:** Total pages from `__NEXT_DATA__` or last pagination link

**Deduplication:** `seenIds` Set prevents duplicate listings across pages.

**Output:** Array of `FundaSearchResult` objects with ID, address, price, area, rooms, type.

### Phase 2: Checksum Comparison (10-30 seconds)

**Purpose:** Identify which listings have changed since last scrape

**Checksum Fields** (change-sensitive):
- `price` (KoopPrijs or HuurPrijs)
- `title` (Adres)
- `description` (Omschrijving)
- `bedrooms` (AantalSlaapkamers)
- `bathrooms` (AantalBadkamers)
- `sqm` (WoonOppervlakte)

Checksums are compared in batches of 5000 against the ingest API.

### Phase 3: Selective Fetching (10-20 minutes)

**Purpose:** Fetch full detail pages only for new/changed properties

New/changed listings are queued as BullMQ jobs. Each job:

1. Waits 200-800ms random delay (anti-detection)
2. Fetches the detail HTML page
3. Extracts data from `__NEXT_DATA__` or HTML elements
4. Determines property type via `mapFundaType()`
5. Routes to category-specific transformer
6. Accumulates in batch (100 properties)
7. Flushes batch to ingest API

**Detail Page Extraction** (`fetchPropertyDetail`):

| Source Priority | Method |
|----------------|--------|
| 1. `__NEXT_DATA__` | `props.pageProps.listing` JSON |
| 2. JSON-LD | `<script type="application/ld+json">` |
| 3. HTML elements | `[data-test-id="*"]` selectors |
| 4. Feature list | `[data-test-id="kenmerken-table"]` dt/dd pairs |

## Queue Architecture

### BullMQ Configuration

**Queue name:** `funda-details`

**Worker Processing Flow:**

```
Job Received
    |
Random Delay (200-800ms)
    |
Fetch Detail HTML Page
    |
Extract from __NEXT_DATA__ or HTML
    |
Determine Property Type (mapFundaType)
    |
Route to Category Transformer
    |
Add to Batch Accumulator
    |
Flush if Batch Full (100 properties)
    |
Return Success
```

### Batch Accumulation

Properties accumulate in memory, flushed when:
1. Batch reaches 100 properties
2. 5 seconds elapsed since last flush
3. Worker shutdown (graceful)

## Category Detection

**File:** `src/utils/fetchData.ts` and `src/queue/detailQueue.ts`

Detection uses Dutch property type strings from the portal:

| Dutch Term | Category |
|------------|----------|
| appartement, flat, bovenwoning, benedenwoning, maisonnette, penthouse, portiek | `apartment` |
| woonhuis, villa, herenhuis, grachtenpand, landhuis, bungalow, twee-onder-een-kap, hoekwoning, tussenwoning, geschakelde, vrijstaand | `house` |
| bouwgrond, perceel, grond | `land` |
| bedrijfspand, kantoor, winkel, horeca, praktijk | `commercial` |

**Default:** `apartment` when type is unrecognized.

## Feature Detection

Boolean features are detected from the detail page feature list and `__NEXT_DATA__`:

| Dutch Feature | TierI Field |
|---------------|-------------|
| tuin | `has_garden` |
| garage | `has_garage` |
| kelder, berging | `has_basement` |
| balkon | `has_balcony` |
| lift | `has_elevator` |
| parkeer, parking | `has_parking` |

## Error Handling

### Retry Strategy

**Network Errors:** 3 attempts with exponential backoff (1s, 2s, 4s + random jitter, max 10s)

**4xx Errors:** Thrown immediately (no retry) — indicates captcha or invalid URL

**Detail Fetch Failures:** Return null, job marked as skipped

**Transform Errors:** Logged and thrown, BullMQ retries the job

### Graceful Shutdown

SIGTERM/SIGINT handlers close workers and queue, flush remaining batch.
