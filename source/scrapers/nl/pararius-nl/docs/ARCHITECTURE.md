# Architecture

> Technical design and implementation details of the Pararius scraper

## Overview

The Pararius scraper implements a **three-phase checksum-optimized architecture** using Cheerio for HTML parsing. Unlike Funda, Pararius is a **rental-only** portal, so all listings have `transaction_type: 'rent'`. The scraper parses server-rendered HTML — there is no `__NEXT_DATA__` or public API.

### Key Design Principles

1. **HTML-Only Parsing:** Pure Cheerio extraction from server-rendered pages
2. **Sequential Discovery:** Pages fetched one at a time to respect rate limits
3. **Conservative Concurrency:** Default 20 workers (vs. 50 for Funda)
4. **Rental Focus:** Only 2 property types (apartment, house)

## Three-Phase Orchestration

### Phase 1: Listing Discovery (5-10 minutes)

**Purpose:** Collect all listing summaries from search pages

**Implementation:** `src/scraper/threePhaseOrchestrator.ts`

The orchestrator iterates sequentially over two property types:
- `appartement` — URL slug: `/huurappartementen/nederland/`
- `huis` — URL slug: `/huurwoningen/nederland/`

For each type, pages are fetched **sequentially** (not in parallel) with 500-1000ms delays.

**Search Page Parsing** (`src/utils/fetchData.ts`):

Listing cards are parsed from:
- `li.search-list__item--listing` or `section.listing-search-item`
- Address: `.listing-search-item__title` or link text
- City: `.listing-search-item__sub-title`
- Price: `.listing-search-item__price`
- Area: `.illustrated-features__description--surface-area`
- Rooms: `.illustrated-features__description--number-of-rooms`

**Pagination:** Next page detected via `a.pagination__link--next` or `a[rel="next"]`.

**Termination:** Stops when no next page, no results, or all results already seen (dedup via `seenIds`).

**Output:** Array of `ParariusSearchResult` objects.

### Phase 2: Checksum Comparison (10-30 seconds)

**Purpose:** Identify changed listings

Checksums compared in batches of 5000 against the ingest API. Same pattern as Funda.

### Phase 3: Selective Fetching (5-10 minutes)

**Purpose:** Fetch detail pages for new/changed properties

Each job in BullMQ:

1. Waits 300-1000ms random delay (higher than Funda due to stricter rate limits)
2. Fetches the detail HTML page
3. Parses features from dt/dd pairs
4. Routes to apartment or house transformer
5. Accumulates in batch (100 properties)
6. Flushes to ingest API

**Detail Page Parsing** (`fetchPropertyDetail`):

| Element | Selector | Data |
|---------|----------|------|
| Address | `h1.listing-detail-summary__title` | Property title |
| City | `.listing-detail-summary__location` | City name |
| Price | `.listing-detail-summary__price` | Monthly rent |
| Description | `.listing-detail-description__content` | Full text |
| Features | `.listing-features__list-item dt` / `dd` | Key-value pairs |
| Images | `img[src*="pararius"]` | Photo URLs |
| Agent | `.agent-summary__title` | Agent name |
| Coordinates | JSON-LD `geo.latitude/longitude` | GPS coordinates |

**Feature Table Parsing:**

The `featureMap` is built from dt/dd pairs, then used to extract:

| Dutch Key | Field |
|-----------|-------|
| `woonoppervlakte` / `oppervlakte` | `livingArea` |
| `perceeloppervlakte` | `plotArea` |
| `kamers` / `aantal kamers` | `rooms` |
| `slaapkamers` | `bedrooms` |
| `badkamers` | `bathrooms` |
| `bouwjaar` | `yearBuilt` |
| `energielabel` | `energyLabel` |
| `postcode` | `postalCode` |
| `borg` / `waarborgsom` | `deposit` |
| `beschikbaar vanaf` | `availableFrom` |
| `interieur` / `gemeubileerd` | `furnished` |

## Queue Architecture

### BullMQ Configuration

**Queue name:** `pararius-details`

**Worker Processing Flow:**

```
Job Received
    |
Random Delay (300-1000ms)
    |
Fetch Detail HTML Page
    |
Parse Features from dt/dd Pairs
    |
Detect Boolean Features (tuin, garage, etc.)
    |
Route to Apartment or House Transformer
    |
Add to Batch Accumulator
    |
Flush if Batch Full (100 properties)
    |
Return Success
```

## Rental-Specific Fields

Since Pararius is rental-only, transformers include rental-specific fields:

| Field | Source | Description |
|-------|--------|-------------|
| `transaction_type` | Always `'rent'` | Hardcoded |
| `deposit` | `borg` / `waarborgsom` | Security deposit in EUR |
| `available_from` | `beschikbaar vanaf` | Availability date |
| `furnished` | `interieur` / `gemeubileerd` | Furnished status |

### Furnished Status Mapping

| Dutch Term | TierI Value |
|------------|-------------|
| gemeubileerd | `furnished` |
| gestoffeerd | `partially_furnished` |
| (other) | `not_furnished` |

## Error Handling

### Retry Strategy

**Network Errors:** 3 attempts with exponential backoff (1s, 2s, 4s + random jitter, max 10s)

**4xx Errors:** Thrown immediately (rate limit or blocked)

**Detail Fetch Failures:** Return null, job marked as skipped

### Graceful Shutdown

SIGTERM/SIGINT handlers close workers and queue, flush remaining batch.
