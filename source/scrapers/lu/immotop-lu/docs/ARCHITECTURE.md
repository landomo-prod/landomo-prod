# Architecture

> Technical design and implementation details of the Immotop.lu scraper

## Overview

The Immotop scraper targets a Next.js-based portal. Data extraction uses a dual strategy: `__NEXT_DATA__` JSON parsing (preferred) with cheerio HTML fallback. Lower concurrency (20 workers) and longer delays (300-800ms) maintain polite crawling behavior for HTML-based scraping.

## Three-Phase Orchestration

### Phase 1: Listing Discovery (3-5 minutes)

**Purpose**: Collect all listing IDs from search result pages

**Implementation**: `src/scraper/threePhaseOrchestrator.ts`

**Search Configurations**: 7 total

| Category | Transaction | URL Path |
|----------|-------------|----------|
| apartment | buy | `/en/search/buy/apartment` |
| apartment | rent | `/en/search/rent/apartment` |
| house | buy | `/en/search/buy/house` |
| house | rent | `/en/search/rent/house` |
| land | buy | `/en/search/buy/land` |
| commercial | buy | `/en/search/buy/office` |
| commercial | rent | `/en/search/rent/office` |

**Concurrency**: pLimit(3) -- 3 categories fetched simultaneously

**Pagination**: URL parameter `?page=N`, sequential within each combo

**Data Extraction Strategy**:

1. **Primary**: Parse `<script id="__NEXT_DATA__">` JSON from HTML
   - Extract `props.pageProps.listings` or `props.pageProps.results` or `props.pageProps.items`
   - Rich structured data: id, title, price, coordinates, surface, bedrooms, agency

2. **Fallback**: Cheerio HTML parsing of listing cards
   - Selectors: `[data-testid="property-card"]`, `.property-card`, `.listing-card`, `article.property`
   - Extract: title, price, city, surface, bedrooms, images from card elements

**Termination**: Empty page, all IDs already seen (seenIds), or HTTP 404

**Delay**: 500-1000ms between pages

### Phase 2: Checksum Comparison (10-30 seconds)

**Purpose**: Identify changed listings

**Checksum Fields**:
- `id` -- Listing identifier
- `price` -- Price changes
- `surface` -- Area modifications
- `bedrooms` -- Room count
- `title` (first 100 chars) -- Text updates

**Hash**: MD5 of pipe-delimited field values

### Phase 3: Selective Fetching (5-15 minutes)

**Purpose**: Fetch full detail pages for new/changed listings

**Detail Extraction**: `fetchListingDetail(url)` in `src/utils/fetchData.ts`

1. **Primary**: `__NEXT_DATA__` on detail page
   - `props.pageProps.property` or `props.pageProps.listing`
   - Full description, features/amenities, all property details

2. **Fallback**: Cheerio HTML parsing
   - Title from `<h1>`
   - Price from `.price` or `[data-testid="price"]`
   - Description from `.description`
   - Features from `.feature`, `.amenity` elements
   - Structured data from `<dt>/<dd>` or `<th>/<td>` pairs using keyword matching

**Feature Detection** (from detail page features list):
- `elevator|lift|ascenseur` -> `hasElevator`
- `balcon` -> `hasBalcony`
- `parking|garage` -> `hasParking`
- `basement|cave|cellar` -> `hasBasement`
- `garden|jardin` -> `hasGarden`
- `garage` -> `hasGarage`
- `terrace|terrasse` -> `hasTerrace`

**Worker Processing**:
- 20 concurrent workers (configurable)
- Random delay 300-800ms per job
- Batch ingestion (100 properties/request)
- 3 retry attempts with exponential backoff

## Queue Architecture

**Queue**: `immotop-details`

**Job Data**: Includes `url` field (unlike ATHome which uses listing ID), since Immotop requires the full URL for detail page fetching.

**Job Processing Flow**:

```
Job Received (with URL)
    |
Random Delay (300-800ms)
    |
Fetch Detail Page HTML
    |
Try __NEXT_DATA__ Extraction
    |  (fallback)
Cheerio HTML Parsing
    |
Set category + transactionType from job
    |
Transform to TierI type
    |
Add to Batch
    |
Flush if Batch Full (100)
```

## Error Handling

**HTTP 404**: Treated as end of pagination (discovery) or removed listing (detail)
**HTTP 410**: Listing removed, job skipped
**Parse Failures**: Cheerio fallback if `__NEXT_DATA__` parsing fails
**Transform Errors**: Logged and skipped, don't block batch
