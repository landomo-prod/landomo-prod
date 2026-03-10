# CeskeReality - Scraper Mechanics

## Three-Phase Architecture

### Phase 1: Discovery
- Iterates all 8 category URLs in parallel
- Paginates each category (`?strana=N`), max `MAX_PAGES` pages
- Extracts listing URLs via CSS selectors: `[class*="i-estate"] a[href$=".html"]`, `.s-result-list a[href$=".html"]`
- Deduplicates URLs per category
- Stops pagination after 3 consecutive empty pages
- Delay: 50ms between pages, 2s after empty pages

### Phase 2: Checksum Comparison
- Uses `ChecksumClient` from `@landomo/core`
- Derives portal IDs from URL: `/path/slug.html` → `ceskereality-slug`
- Compares all discovered URLs against stored checksums
- Returns lists of `new`, `changed`, and `unchanged` URLs

### Phase 3: Detail Queue
- Only new/changed URLs are queued to BullMQ `ceskereality-details`
- Worker concurrency: 3 (default)
- Per-job jitter: 50–150ms random delay to avoid thundering herd
- Batch accumulator: collects 100 properties, flushes to ingest API
- Periodic flush: every 5 seconds for timely ingestion
- Job retries: 5 attempts with exponential backoff (10s base)

## Detail Page Extraction

```
fetch(url) → HTML → Cheerio
  ├── JSON-LD (<script type="application/ld+json">)
  │   ├── price, priceCurrency
  │   ├── name, description
  │   ├── address (locality, region, street, postal)
  │   ├── agent (name, telephone)
  │   └── geo (latitude, longitude)
  ├── Images (img[src*="img.ceskereality.cz/foto"])
  │   └── Deduped, full-size URLs (query params stripped)
  ├── Property Details (.i-info elements)
  │   └── Czech label → value pairs (floor, area, construction, etc.)
  ├── Energy Rating (.s-estate-detail-intro__energy)
  └── Coordinates (fallback chain)
      ├── JSON-LD geo field
      ├── data-lat/data-lng attributes
      └── Inline script pattern matching (validated 48.5-51.1°N, 12.0-18.9°E)
```

## Rate Limiting & Retry

| Scenario | Behavior |
|----------|----------|
| HTTP 429 (listing page) | Wait 5s, retry up to 3 times |
| HTTP 429 (detail page) | Wait 2–5s random, retry up to 3 times |
| HTTP 503 (detail page) | Wait 3–8s random, retry up to 3 times |
| BullMQ job failure | Exponential backoff from 10s, up to 5 attempts |

## Request Headers

Rotating user agents via `getRandomUserAgent()` with Czech locale headers:
- `Accept-Language: cs-CZ,cs;q=0.9,en;q=0.8`
- `Accept-Encoding: gzip, deflate, br`
- `Cache-Control: no-cache`

## Ingestion

Two paths exist:
1. **Direct batch** (`ingestAdapter.ts`): Used by `scrapeCategory()` in non-queue mode, sends 50 listings per batch with 3 retries (2s/4s delay), 60s timeout
2. **Queue batch** (`queueIngestAdapter.ts` + `detailQueue.ts`): Queue worker accumulates 100 properties, flushes via axios POST to bulk-ingest

## Portal ID Derivation

```
URL: https://www.ceskereality.cz/prodej/byty/byt-3kk-brno-12345.html
                                                    ^^^^^^^^^^^^^^^^^^^^
Portal ID: ceskereality-byt-3kk-brno-12345
```
