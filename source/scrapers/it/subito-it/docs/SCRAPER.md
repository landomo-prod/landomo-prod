# Subito.it Scraper - How Data is Fetched

## Entry Point

`src/index.ts` starts an Express server on port 8122 (configurable via `PORT`).

On startup:
1. Creates BullMQ detail worker with configurable concurrency (default 5, via `WORKER_CONCURRENCY`)
2. Registers `/health` and `/scrape` endpoints

## Scrape Trigger

`POST /scrape` responds immediately with HTTP 202 and runs scraping asynchronously. It creates a `ScrapeRunTracker` to record the run in the ingest API (best-effort, 5s timeout).

## Three-Phase Orchestrator

File: `src/scraper/threePhaseOrchestrator.ts`

### Combination Matrix

The orchestrator builds a flat list of 80 combinations from:

```
SUBITO_REGIONS × SUBITO_CATEGORY_IDS × SUBITO_CONTRACT_KEYS
= 20 regions × 2 categories × 2 contracts = 80 combinations
```

Combinations are processed with `p-limit(3)` — at most 3 combos run simultaneously.

### Phase 1: Discovery

For each combination, the orchestrator pages through the Hades API until results are exhausted:

1. Calls `listingsScraper.fetchPage(region, category, contract, offset)` for each page
2. Extracts minimal listing data from each `SubitoItem` in the `ads[]` array
3. Continues until a page returns 0 results
4. Waits 300ms between page requests within a combo

**Hades API Endpoint:**
```
GET https://hades.subito.it/v1/search/items
  ?q={keyword}          # 'appartamento' or 'casa villa'
  &c={categoryId}       # 7 (appartamenti) or 4 (case-ville)
  &r={regionId}         # 1-20 (Italian region)
  &t={contractKey}      # 's' (vendita) or 'k' (affitto)
  &lim=35               # page size (fixed)
  &start={offset}       # 0, 35, 70, ... (pagination)
```

**Response shape:**
```json
{
  "count_all": 1250,
  "ads": [ ...SubitoItem[] ]
}
```

> Full `SubitoItem` data (features, geo, images, urls) is present in the Phase 1 response. No separate detail HTTP fetch is needed.

### Phase 2: Checksum Comparison

Checksum comparison is performed per-page (not per-combo) with a semaphore limiting to **2 concurrent checksum API calls**:

1. Extracts checksums from the page's `SubitoMinimalListing[]` via `checksumExtractor.ts`
   - Checksum fields: `price`, `subject` (title), `sqm`, `date` (display_iso8601 or display), `portalId`
2. Sends checksums to ingest API via `ChecksumClient.compareChecksumsInBatches()`
3. Results classify each listing as `new`, `changed`, or `unchanged`
4. `unchanged` listings are skipped; only `new` and `changed` proceed to Phase 3

### Phase 3: Queue Dispatch

New and changed listings are accumulated and dispatched to BullMQ in **50-item batches**:

1. Each listing's full `SubitoItem` data (already fetched in Phase 1) is included in the job payload
2. Jobs are added to the `subito-it-details` queue via `detailQueue.addDetailJobs()`
3. After all pages for a combo are processed, checksums are updated via `checksumClient.updateChecksums()`

### Queue Worker Processing

File: `src/queue/detailQueue.ts`

The BullMQ worker processes jobs from the `subito-it-details` queue:

1. Receives a batch of up to 50 `SubitoMinimalListing` items (with full `item` field attached)
2. Transforms each via `transformers/index.ts` → category-specific transformer
3. Accumulates transformed listings in an in-memory batch (threshold: 100 items)
4. Flushes batch to the ingest API via `POST /bulk-ingest`
5. Periodic flush every 5 seconds for partial batches

**No HTTP fetch occurs in the worker.** All property data comes from the Hades API in Phase 1.

**Worker config:**

| Setting | Value |
|---------|-------|
| Queue name | `subito-it-details` |
| Job batch size | 50 listings per job |
| Ingest batch threshold | 100 items |
| Periodic flush interval | 5 seconds |
| Worker concurrency | 5 (configurable via `WORKER_CONCURRENCY`) |
| Retry attempts | 3 |
| Retry backoff | Exponential, 2s base |
| Remove completed | After 1 hour or 500 jobs |
| Remove failed | After 2 hours or 200 jobs |

## Hades API Client

File: `src/scrapers/listingsScraper.ts`

The `ListingsScraper` class wraps all Hades API interactions:

- Sets `User-Agent` by rotating through 6 user agent strings (from `utils/userAgents.ts`)
- Uses Axios with default timeout
- Parses `response.data.ads` as `SubitoItem[]`
- Returns `{ items: SubitoItem[], totalCount: number }` per page

## Data Source Constraints

| Constraint | Details |
|------------|---------|
| Hades API blocked from VPS | Datacenter IPs are rejected — must run from residential IP |
| HTML detail pages blocked | Subito blocks scraping of detail HTML from all IP types |
| No separate detail fetch | Phase 1 Hades response already contains full listing data |
| Page size fixed | `lim=35` (Hades ignores larger values) |

## Checksum Logic

File: `src/utils/checksumExtractor.ts`

Checksums are created from `SubitoMinimalListing` fields:

| Checksum Field | Source | Notes |
|----------------|--------|-------|
| `portalId` | `extractIdFromUrn(item.urn)` | Last segment of URN after colon |
| `price` | `listing.price` | Numeric, nullable |
| `title` | `listing.subject` | Listing title, nullable |
| `sqm` | `listing.sqm` | Area in sqm, nullable |
| `date` | `listing.date` | `display_iso8601` preferred, fallback `display` |

The combined hash of these fields determines whether a listing has changed since the last scrape run.

## Region and Category Constants

File: `src/types/subitoTypes.ts`

### SUBITO_REGIONS

| Region Slug | Region ID |
|-------------|-----------|
| lazio | 11 |
| lombardia | 4 |
| campania | 15 |
| piemonte | 12 |
| emilia-romagna | 8 |
| toscana | 9 |
| sicilia | 19 |
| veneto | 5 |
| liguria | 7 |
| puglia | 16 |
| sardegna | 20 |
| calabria | 18 |
| marche | 10 |
| abruzzo | 13 |
| trentino-alto-adige | 2 |
| friuli-venezia-giulia | 6 |
| umbria | 14 |
| basilicata | 17 |
| molise | 3 |
| valle-d-aosta | 1 |

### SUBITO_CATEGORY_IDS

| Category | ID | Keyword (`q` param) |
|----------|----|---------------------|
| appartamenti | 7 | `appartamento` |
| case-ville | 4 | `casa villa` |

### SUBITO_CONTRACT_KEYS

| Contract | Key (`t` param) | Transaction Type |
|----------|-----------------|-----------------|
| vendita | `s` | sale |
| affitto | `k` | rent |

## SubitoItem Data Structure

Full type definition in `src/types/subitoTypes.ts`:

```typescript
interface SubitoItem {
  urn: string;           // "id:ad:608241847:list:636897239"
  subject: string;       // listing title
  type: string;
  category?: {
    id?: string;
    name?: string;
  };
  features: Array<{
    label: string;       // Italian label e.g. "Prezzo", "Superficie"
    uri: string;         // e.g. "/price", "/size", "/rooms", "/floor"
    values: Array<{
      key: string;
      value: string;
    }>;
  }>;
  geo?: {
    city?: { short_name?: string; value?: string; id?: string };
    town?: { short_name?: string; value?: string };
    region?: { short_name?: string; value?: string };
    coordinates?: { latitude?: number; longitude?: number };
  };
  dates?: {
    display?: string;
    display_iso8601?: string;
  };
  advertiser?: {
    name?: string;
    phone?: string;
  };
  images?: Array<{
    scale?: Array<{ uri?: string; size?: string }>;
    cdn_base_url?: string;
  }>;
  urls?: {
    default?: string;
  };
}
```

### Key Feature URIs

| URI | Field | Example raw value |
|-----|-------|-------------------|
| `/price` | price | `"28000 €"` |
| `/size` | sqm | `"74 mq"` |
| `/rooms` | locali (rooms) | `"3 locali"` |
| `/floor` | floor | `"3° piano"` |
| `/bathrooms` | bathrooms | `"1 bagno"` |
| `/condition` | condition | `"Buone condizioni"` |
| `/heating` | heating_type | `"Autonomo"` |

## Error Handling

### Fetch Errors
- Axios errors during Hades API calls are caught per-page
- Failed pages are logged and skipped; the combination continues with remaining pages
- No retry at the page level (BullMQ handles job-level retries)

### Queue Resilience
- Failed jobs kept for 2 hours (200 max) for debugging
- Completed jobs kept for 1 hour (500 max)
- Exponential backoff: 2s base, 3 attempts

### Ingest Failures
- Batch flush failures are logged with the number of listings lost
- Worker does not retry failed ingest batches (relies on BullMQ job retry)

## ScrapeRunTracker Integration

- `tracker.start()` at scrape begin (best-effort, 5s timeout)
- `tracker.complete({ listings_found, listings_new, listings_updated })` on success
- `tracker.fail(error)` on unhandled error

## Detail Scraper (Not Used)

File: `src/scrapers/detailScraper.ts`

An HTML-based detail scraper exists as a fallback but is **not used in the current flow**. Subito blocks HTML detail page scraping from all IP types (residential and datacenter). All property data is retrieved from the Hades API in Phase 1.
