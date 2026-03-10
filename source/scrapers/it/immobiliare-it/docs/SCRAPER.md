# Scraper Architecture — immobiliare.it

## Overview

The immobiliare.it scraper uses a **three-phase inline orchestrator** implemented with Playwright for browser automation. Unlike other portal scrapers in this project that use BullMQ for job queuing, all processing happens inline in a single streaming run. This design is required because:

1. Datadome anti-bot requires a persistent, warmed browser profile
2. The scraper runs locally (not on VPS), so queue-based parallelism is impractical
3. Detail fetches must be throttled carefully to avoid triggering rate limits

## Anti-Bot: Datadome

immobiliare.it is protected by **Datadome**, which performs:

- TLS fingerprinting (blocks datacenter IP ranges)
- Browser fingerprint analysis (headless detection)
- Behavioral analysis (mouse movement, timing patterns)
- Cookie-based session tracking

### Bypass Strategy

| Mechanism | Implementation |
|---|---|
| Residential IP | Scraper runs on local machine, not VPS |
| Real Chromium | Playwright with non-headless persistent context |
| Persistent profile | `~/.landomo/immobiliare-profile` — saves Datadome cookies across runs |
| Randomized delays | 1500–3000ms between pages, 800–1500ms between detail fetches |
| Pause on load | 30s pause every 20 pages to simulate human reading |

**First run:** A visible browser window opens. Datadome may display a CAPTCHA challenge that must be solved manually. Once solved, the session cookies are stored in the persistent profile and all future runs proceed automatically.

## Browser Setup

**File:** `src/scrapers/listingsScraper.ts`

```typescript
const browser = await chromium.launchPersistentContext(
  '~/.landomo/immobiliare-profile',
  { headless: false }
);
```

The persistent context (`launchPersistentContext`) is critical — it preserves:
- Datadome session cookies
- Browser localStorage state
- User profile data that helps bypass fingerprinting

SIGTERM and SIGINT handlers are registered to close the browser gracefully on shutdown.

## Three-Phase Orchestrator

**File:** `src/scraper/threePhaseOrchestrator.ts`

### Phase 1 — Search Page Discovery

For each of the 140 active combos (7 category-contract × 20 regions):

1. Construct search URL: `https://www.immobiliare.it/{urlSlug}/{region}/?pag={n}`
2. Navigate with Playwright
3. Extract `__NEXT_DATA__` JSON from the page
4. Parse `nextData.props.pageProps.searchList` (or `.searchData`)
5. Collect `searchList.results[]` as `ImmobiliareResult[]`
6. Continue paginating until no results or end-of-results signal
7. Apply random delay (1500–3000ms) between pages; pause 30s every 20 pages

**Data extracted in Phase 1 (per listing):**
- `realEstate.id` — portal numeric ID
- Price, surface, rooms, location — for checksum computation
- All search result fields (used as fallback if detail fetch fails)

### Phase 2 — Checksum Comparison

After collecting IDs and computing checksums for a batch:

1. Call `POST /api/v1/checksums/compare` on the ingest API
2. Ingest API returns status per listing: `new` | `changed` | `unchanged`
3. `unchanged` listings are skipped entirely — no detail fetch, no ingest
4. `new` and `changed` listings proceed to Phase 3

**Checksum computation** (`src/utils/checksumExtractor.ts`):

```typescript
createImmobiliareChecksum(result: ImmobiliareResult): string
```

Fields included in checksum:

| Field | Source Path |
|---|---|
| price | `properties[0].price.value` |
| title | `realEstate.title` |
| description (first 100 chars) | `properties[0].description` |
| sqm | `properties[0].surface_value` |
| disposition | `properties[0].typologyGA4Translation` |
| contract | `realEstate.contract` |

After successful ingest, checksums are updated via a **fire-and-forget** call to `POST /api/v1/checksums/update`.

### Phase 3 — Detail Fetch, Transform, Ingest

For each new/changed listing:

1. Construct detail URL: `https://www.immobiliare.it/annunci/{id}/`
2. Navigate with Playwright
3. Extract `nextData.props.pageProps.detailData.realEstate`
4. If detail fetch fails (CAPTCHA, timeout, error): fall back to Phase 1 search result data
5. Route to the appropriate category transformer
6. Buffer transformed result
7. When buffer reaches 100 items: POST to ingest API (`POST /bulk-ingest`)
8. Apply random delay (800–1500ms) between detail fetches

**Batch size:** 100 listings per POST to ingest API.

## URL Patterns

### Search Pages

```
https://www.immobiliare.it/{urlSlug}/{region}/?pag={n}
```

| Variable | Examples |
|---|---|
| urlSlug | `vendita-appartamenti`, `affitto-case`, `vendita-terreni`, `vendita-uffici` |
| region | `lazio`, `lombardia`, `campania`, `veneto`, ... (20 total) |
| pag | 1, 2, 3, ... (increments until empty results) |

### Detail Pages

```
https://www.immobiliare.it/annunci/{id}/
```

The `id` is the numeric `realEstate.id` from the search result. The canonical SEO URL is also available as `seo.url` (e.g. `/annunci/123/`) and is prefixed with `https://www.immobiliare.it` to form `source_url`.

## Data Extraction

### Search Page

```javascript
// Injected into page as window.__NEXT_DATA__
const nextData = JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
const results = nextData.props.pageProps.searchList?.results
             ?? nextData.props.pageProps.searchData?.results;
```

### Detail Page

```javascript
const nextData = JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
const realEstate = nextData.props.pageProps.detailData.realEstate;
```

## Regions (20)

| Region | URL slug |
|---|---|
| Lazio | `lazio` |
| Lombardia | `lombardia` |
| Campania | `campania` |
| Piemonte | `piemonte` |
| Emilia-Romagna | `emilia-romagna` |
| Toscana | `toscana` |
| Sicilia | `sicilia` |
| Veneto | `veneto` |
| Liguria | `liguria` |
| Puglia | `puglia` |
| Sardegna | `sardegna` |
| Calabria | `calabria` |
| Marche | `marche` |
| Abruzzo | `abruzzo` |
| Trentino-Alto Adige | `trentino-alto-adige` |
| Friuli-Venezia Giulia | `friuli-venezia-giulia` |
| Umbria | `umbria` |
| Basilicata | `basilicata` |
| Molise | `molise` |
| Valle d'Aosta | `valle-d-aosta` |

## Category-Contract Combos

| # | Category | Contract | URL Slug | Active |
|---|---|---|---|---|
| 1 | apartment | sale | `vendita-appartamenti` | Yes |
| 2 | apartment | rent | `affitto-appartamenti` | Yes |
| 3 | house | sale | `vendita-case` | Yes |
| 4 | house | rent | `affitto-case` | Yes |
| 5 | land | sale | `vendita-terreni` | Yes |
| 6 | commercial | sale | `vendita-uffici` | Yes |
| 7 | commercial | rent | `affitto-uffici` | Yes |
| 8 | land | rent | *(skipped)* | No — extremely rare in Italy |

**7 combos × 20 regions = 140 total scrape runs per full cycle.**

## Rate Limiting

| Trigger | Behavior |
|---|---|
| Between search pages | 1500–3000ms random delay |
| Every 20 search pages | Additional 30s pause |
| Between detail fetches | 800–1500ms random delay |
| CAPTCHA encountered | Fallback to search result data; continue |

## Express Server

**File:** `src/index.ts`

```
Port: 8111
```

| Endpoint | Method | Behavior |
|---|---|---|
| `/health` | GET | Returns status, `scrapeRunning` flag, `lastRunStats` |
| `/scrape` | POST | Triggers async scrape; returns 202 if started, 409 if already running |

The scrape runs asynchronously. The `/health` endpoint reflects current run state and statistics from the most recently completed run.

## Ingest Adapter

**File:** `src/adapters/ingestAdapter.ts`

Posts transformed batches to the remote ingest API:

```
POST http://46.225.167.44:3007/bulk-ingest
Authorization: Bearer {INGEST_API_KEY_IMMOBILIARE_IT}
Content-Type: application/json
```

Checksum updates are sent fire-and-forget (non-blocking):

```
POST http://46.225.167.44:3007/api/v1/checksums/update
```

## Graceful Shutdown

SIGTERM and SIGINT signals trigger:
1. Completion of the current detail fetch (if in progress)
2. Flush of any buffered listings to ingest API
3. Graceful browser context close via Playwright

This prevents profile corruption of `~/.landomo/immobiliare-profile`.
