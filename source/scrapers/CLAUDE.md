# Scraper Guidelines

Each scraper lives at `source/scrapers/{cc}/{portal-tld}/` (e.g. `cz/sreality-cz`). One scraper = one portal = one Docker container.

## Success Criteria

A scraper is considered complete and correct when:

1. **All listings are ingested** — the total count in the DB matches what the portal publicly shows. No estates are silently dropped, skipped, or lost due to pagination bugs, transform errors, or queue crashes.
2. **Correct categories** — every listing lands in the right partition (`apartment`, `house`, `land`, `commercial`). Misrouted listings are invisible to category-filtered searches.
3. **All available fields filled** — every field that the portal provides must be mapped. If the portal shows a value (floor, energy rating, disposition, balcony area), it must reach the DB. Fields genuinely not provided by the portal are `null` — not defaulted to `0` or `false`.
4. **Detail page always fetched** — listing index/search pages are always incomplete. They typically provide only title, price, and thumbnail. Full data (description, all amenities, coordinates, floor, energy class, etc.) only exists on the detail page. **Always fetch the detail page for every new or changed listing, no exceptions.**

---

## Starting a New Scraper — Research First

Before writing any code, spend time understanding how the portal works. A few hours of research here saves days of reverse-engineering broken scrapers later.

### 1. Search GitHub for existing scrapers

Someone has almost certainly scraped the portal before. Search GitHub for:

```
"{portal-name}" scraper
"{portal-name}" site:github.com playwright
"{portal-name}" API scraping
"{domain.tld}" real estate scraper
```

Look for: API endpoints already discovered, pagination patterns, authentication flows, anti-bot bypass strategies, field mappings. Even an old or broken scraper gives you a huge head start on understanding the data model.

### 2. Investigate the portal with Playwright

Open the portal in a browser with Playwright (or DevTools) and systematically look for the best data source. Priority order — stop at the first that works:

**A. Backend API calls (best — structured JSON)**
Open DevTools → Network tab → filter by XHR/Fetch → browse listings and detail pages. Look for:
- Search/listing endpoints returning JSON arrays of properties
- Detail endpoints returning a full property object
- GraphQL endpoints (`/graphql`, `/api/graphql`)

Note the request headers, query parameters, pagination scheme, and whether auth tokens are needed.

```bash
# Use Playwright to capture all network requests automatically
npx playwright codegen --save-har=portal.har https://portal.example.com
# Then inspect portal.har for API calls
```

**B. `__NEXT_DATA__` (Next.js apps)**
Many modern portals are built with Next.js and embed the full page data in a `<script id="__NEXT_DATA__">` JSON blob. This is clean structured data without needing to parse HTML:

```typescript
const nextData = await page.evaluate(() => {
  const el = document.getElementById('__NEXT_DATA__');
  return el ? JSON.parse(el.textContent!) : null;
});
// nextData.props.pageProps contains the listing data
```

**C. JSON-LD (`application/ld+json`)**
Many portals embed structured data for SEO. Check for `<script type="application/ld+json">` blocks containing `RealEstateListing` or `Product` schemas — coordinates, price, and description are often here even when not in the main API response.

```typescript
const jsonLd = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map(el => JSON.parse(el.textContent!));
});
```

**D. Embedded JS variables**
Some portals assign data to global JS variables:
```typescript
const data = await page.evaluate(() => (window as any).APP_DATA || (window as any).__INITIAL_STATE__);
```

**E. HTML parsing (last resort)**
Only fall back to Cheerio/HTML parsing when none of the above work. HTML scrapers are brittle — any CSS class rename or DOM restructure breaks them.

### 3. Map out the full data model before coding

Before opening your editor, document:
- What endpoint gives you the listing index (IDs, basic data, checksum candidates)
- What endpoint gives you the full detail (all fields)
- Pagination scheme (offset/limit, cursor, page number)
- Available categories and how they're expressed
- Any auth tokens, cookies, or headers required
- Rate limits (explicit in response headers, or empirical from testing)

A 20-minute Playwright session answering these questions prevents architectural mistakes that require a full rewrite later.

---

## Structure

```
{portal}/
├── src/
│   ├── index.ts                      # Express server + scrape trigger endpoint
│   ├── scraper/
│   │   ├── threePhaseOrchestrator.ts # Orchestrates phases 1-3
│   │   ├── listingsScraper.ts        # Phase 1: discovery (IDs / checksums)
│   │   └── detailScraper.ts          # Phase 3: full detail fetch
│   ├── transformers/
│   │   └── *Transformer.ts           # Raw portal data → TierI type
│   ├── adapters/
│   │   └── ingestAdapter.ts          # POST to ingest API
│   ├── queue/
│   │   └── detailQueue.ts            # BullMQ queue for detail jobs
│   └── utils/
├── Dockerfile
└── package.json
```

---

## Scraping Approach

### Preferred: Three-Phase Checksum Scraping

The standard pattern. Reduces detail fetches by 80-95% on stable days while still always fetching the full detail page for anything new or changed.

```
Phase 1 — Discovery
  Fetch all listing index/search pages
  Extract only: listing ID + lightweight checksum (price, title hash, modified date)
  Goal: enumerate the full active set as fast as possible

Phase 2 — Change Detection
  POST /checksums/compare to ingest API with all IDs + checksums
  Returns: { new: [...], changed: [...], unchanged: [...] }
  Unchanged listings are skipped entirely — no detail fetch needed

Phase 3 — Detail Fetch (always, for new + changed)
  Queue new + changed IDs into BullMQ detailQueue
  Workers fetch the full detail page/API response for each
  Transform full data → POST /bulk-ingest
```

**Why always fetch the detail page:** Index pages are a navigation aid, not a data source. They reliably provide ID, price, and thumbnail. Everything else — description, coordinates, floor, area breakdown, energy class, amenities — is only on the detail page. Never ingest from the index page alone.

**Parallelising Phase 1 across categories:**
Most portals split listings by category (apartments, houses, land, commercial) and/or region. Run these concurrently — each feeds into the same shared detail queue, which Phase 3 workers drain continuously.

```
Phase 1 — apartments ████████████
Phase 1 — houses     ██████████████
Phase 1 — land       ██████                 → shared detailQueue → Phase 3 workers
Phase 1 — commercial █████████

Total time ≈ slowest category, not sum of all
```

```typescript
// All categories run concurrently, all feeding the same queue
await Promise.all(
  CATEGORIES.map(category => discoverCategory(category, detailQueue))
);
await waitForQueueDrain();
```

Start with 2-3 concurrent categories and increase based on observed portal tolerance. Some rate-limited portals require `CATEGORY_CONCURRENCY=1`.

### Fallback: Two-Phase (no checksums)

Use only when the index response already contains the full listing data (e.g. some GraphQL APIs return everything in one response). Still fetch the detail page if any field is missing.

```
Phase 1 — Fetch all pages with full data (verify completeness first)
Phase 2 — Transform + bulk ingest
```

Add checksums in a follow-up — even two-phase scrapers benefit from skipping unchanged listings on repeat runs.

### Avoid: Single-Phase Sequential

Never fetch detail pages one-by-one in a loop without a queue. Always use BullMQ with concurrency control for detail fetches.

---

## Live Detection (Pipelined Phases)

The naive three-phase approach has a latency problem: listings discovered early in Phase 1 wait until the entire crawl finishes before Phase 3 begins. On a 50k-listing portal that's 10-20 minutes of unnecessary delay.

**Fix: pipeline Phase 1 directly into Phase 3.** As soon as a page is fetched and checksums compared, immediately queue new/changed IDs — don't accumulate.

```
Naive (slow):
  Phase 1 ████████████████████ done → Phase 3 ████████████ done
  First listing ingested after: full Phase 1 duration

Pipelined (fast):
  Phase 1 page 1 → compare → enqueue ↘
  Phase 1 page 2 → compare → enqueue → Phase 3 workers ████████████
  Phase 1 page 3 → compare → enqueue ↗
  First listing ingested after: ~one page fetch + checksum compare (seconds)
```

```typescript
async function runThreePhaseScrape() {
  // Phase 3 workers start immediately — queue is empty but ready
  const workers = createDetailWorkers(WORKER_CONCURRENCY);

  // Phase 1 + 2 page by page, feeding Phase 3 as they go
  for await (const page of discoverPages()) {
    const checksums = extractChecksums(page.listings);
    const { new: newIds, changed } = await compareChecksums(checksums);

    // Enqueue immediately — don't wait for full discovery
    await detailQueue.addBulk([...newIds, ...changed].map(id => ({ data: { id } })));
  }

  await waitForQueueDrain();
}
```

**Key principle:** Phase 3 workers must be running before Phase 1 starts. The queue is the buffer, not an accumulation step.

---

## Transformer Requirements

Every scraper must export a transformer that converts raw detail page data to a TierI type. The transformer always receives data from the **detail page**, not the index.

```typescript
import { ApartmentPropertyTierI } from '@landomo/core';

export function transformApartment(raw: RawDetailListing): ApartmentPropertyTierI {
  return {
    // REQUIRED — determines DB partition
    property_category: 'apartment',

    // Identity
    source_url: raw.url,
    source_platform: 'sreality-cz',
    portal_id: String(raw.id),
    status: 'active',

    // Core fields — null if not provided, never 0 or false as default
    price: raw.price ?? null,
    currency: 'CZK',
    title: raw.name,
    description: raw.description ?? null,
    latitude: raw.gps?.lat ?? null,
    longitude: raw.gps?.lng ?? null,

    // Category-specific (apartment) — map everything the portal provides
    bedrooms: raw.rooms ?? null,
    sqm: raw.area ?? null,
    has_elevator: raw.elevator ?? null,   // null = unknown, false = confirmed no
    has_balcony: raw.balcony ?? null,
    has_parking: raw.parking ?? null,
    has_basement: raw.basement ?? null,

    // Tier II — country-specific fields in JSONB (don't throw data away)
    country_specific: {
      disposition: raw.disposition,        // e.g. "3+1"
      ownership: raw.ownership_type,
      energy_class: raw.energy_class,
      floor: raw.floor ?? null,
    },

    // Tier III — portal metadata
    portal_metadata: {
      raw_category_id: raw.category,
      portal_internal_id: raw.hash_id,
    },
  };
}
```

**Rules:**
- `property_category` is mandatory — ingest API rejects without it
- `portal_id` must be a stable unique string identifier from the portal
- `source_platform` = portal folder name (e.g. `sreality-cz`)
- Use `null` for fields the portal doesn't provide — never `0`, `''`, or `false` as a stand-in for missing data
- `has_*` boolean fields: `null` = unknown, `true` = confirmed yes, `false` = confirmed no
- Map every field the portal provides — if it's on the detail page, it belongs in the transformer
- Put portal-specific fields with no TierI equivalent in `country_specific` or `portal_metadata` — don't discard them

**Category required fields:**

| Category | Required fields |
|----------|----------------|
| `apartment` | `bedrooms`, `sqm`, `has_elevator`, `has_balcony`, `has_parking`, `has_basement` |
| `house` | `bedrooms`, `sqm_living`, `sqm_plot`, `has_garden`, `has_garage`, `has_parking`, `has_basement` |
| `land` | `area_plot_sqm` |
| `commercial` | `sqm_total`, `has_elevator`, `has_parking` |

**Coordinate extraction — multi-strategy (for HTML scrapers):**
Many portals don't include coordinates in a clean JSON field. Try in order:
1. JSON-LD geo block (`<script type="application/ld+json">`)
2. Data attributes on map element (`data-lat`, `data-lng`)
3. Google Maps iframe `src` query parameter
4. Inline JavaScript variable in `<script>` tags

Always validate coordinates are within the expected country bounding box before ingesting.

**Category detection (for unsorted portals like bazos):**
When a portal doesn't classify listings by category, detect from title + description using keyword matching. Log the detected category and confidence. Route to the appropriate transformer. If confidence is low, default to the most likely category for that portal (usually `apartment`) and log a warning — don't silently drop the listing.

---

## Anti-Bot & Rate Limiting

**Start simple:**
- Add `User-Agent`, `Accept-Language`, `Referer` headers matching a real browser
- 200-500ms delay between index page fetches
- Queue concurrency controls detail fetch rate automatically

**If blocked:**
1. `curl-impersonate` — mimics real browser TLS fingerprint, works against most WAFs
2. CycleTLS — second option (some portals reject its fingerprint)
3. Puppeteer + stealth plugin — last resort, slow and memory-heavy

Never use bare `node-fetch` or `axios` against Cloudflare-protected portals.

**Rate limit signals:**
- HTTP 429 → exponential backoff, min 30s, randomize (5-15s jitter)
- HTTP 403 on previously working URL → rotate user agent, increase delay
- Results unexpectedly empty → silent block, add stealth headers, reduce concurrency

**Concurrency guidelines:**
- Index page fetching: 5-20 concurrent
- Detail page fetching: 50-200 concurrent (`WORKER_CONCURRENCY` env var)
- Per category/region combo: 1-3 for sensitive portals, start at 1

---

## Pagination

Use all three termination conditions — relying on any single one will eventually fail:

```typescript
const seenIds = new Set<string>();

for (let page = 1; page <= MAX_PAGES; page++) {
  const listings = await fetchPage(page);
  if (listings.length === 0) break;                              // empty page

  const newListings = listings.filter(l => !seenIds.has(l.id));
  if (newListings.length === 0) break;                          // portal cycling

  newListings.forEach(l => seenIds.add(l.id));
  // feed to queue immediately (pipelined)
  await detailQueue.addBulk(newListings.map(l => ({ data: { id: l.id } })));
}
```

Some portals (notably Slovak ones) never return an empty page — they cycle back to featured listings when results are exhausted. The `seenIds` check is the only reliable termination in these cases.

---

## Error Handling & Resilience

**Transform errors:** Catch per-listing, log with the portal ID, and continue. Never let one bad listing abort the batch. Track the error count — if >30% of a batch fails, abort and alert (circuit breaker).

**Detail fetch failures:** Retry up to 3 times with backoff. After 3 failures, log and skip — do not let failed jobs block the queue indefinitely.

**Queue monitoring:** Poll queue stats until fully drained. Don't return from the scrape run until `waiting + active === 0`. Workers can crash silently — the poll loop will surface stuck queues.

**Checksum updates:** Save checksums to the DB before enqueuing detail jobs, not after. If the worker crashes mid-run, the next run will re-detect those listings as "changed" and re-fetch — acceptable. If checksums are saved after, a crash means they're never saved and the portal gets hammered every run.

**Graceful shutdown:** Handle `SIGTERM` — drain the detail queue, close workers, log final stats, then exit. This is critical in Docker where containers are stopped between deploys.

---

## Ingest API

```typescript
// POST /bulk-ingest
await fetch(`${INGEST_API_URL}/bulk-ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': INGEST_API_KEY },
  body: JSON.stringify({ portal: 'sreality-cz', country: 'cz', data: listings }),
});

// Checksum compare (batch in groups of 1000-5000 to avoid DB deadlock)
const { new: newIds, changed, unchanged } = await compareChecksums(portalId, checksums);

// Scrape run tracking (best-effort, 5s timeout — never block scraping on this)
const tracker = new ScrapeRunTracker('sreality-cz');
const runId = await tracker.start();
await tracker.complete({ listings_found, listings_new, listings_updated });
```

Batch checksum comparisons in groups of 1000-5000. Sending 80 concurrent category batches will cause `40P01` deadlock on the `listing_checksums` index — sort by `portal_id` and add retry logic with 50-150ms backoff.

---

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
ENV NODE_ENV=production
EXPOSE 8xxx
CMD ["node", "dist/index.js"]
```

- One container per portal
- Port assigned per portal, defined in docker-compose, driven by `PORT` env var
- Required env vars: `INGEST_API_URL`, `INGEST_API_KEY`, `PORT`, `WORKER_CONCURRENCY`
- Always test in Docker — Puppeteer and curl-impersonate behave differently on macOS (ARM vs Linux x64)

---

## Testing

### Correctness

Before declaring a scraper done, verify against the success criteria:

1. Run a full scrape and compare the ingested count against the listing count visible on the portal's website
2. Spot-check 5-10 individual listings — open the portal URL and verify the DB record has all the fields the portal shows
3. Check category distribution looks plausible (mostly apartments for urban portals)
4. Verify coordinates: query for listings with `latitude IS NULL` — should be <5% for portals that show maps
5. Run a second scrape immediately after — unchanged listings should produce 0 new ingest calls (checksum deduplication working)

### Finding the Concurrency Sweet Spot

Every portal has a different tolerance for concurrent requests. Too low and the scrape takes hours unnecessarily. Too high and you get blocked, rate-limited, or start seeing garbage responses. The goal is to find the highest stable concurrency that the portal tolerates without errors.

**Process — tune each dimension independently:**

**1. Detail fetch concurrency (`WORKER_CONCURRENCY`)**

Start low and increase until you see errors or degradation:

```
10 workers  → observe: errors? response times? portal blocks?
25 workers  → same checks
50 workers  → same checks
100 workers → same checks
200 workers → same checks
```

At each level, watch:
- HTTP error rate (429s, 403s, 503s) — should be <1%
- Response times — if median detail fetch time doubles, you're hitting the portal's limit
- Memory usage — 200 workers with large HTML responses can OOM a container
- Total run duration — plot duration vs concurrency; the curve flattens at the sweet spot

Good starting points: `50` for most portals, `10-20` for rate-sensitive ones, `200` for portals with robust APIs (sreality).

**2. Category concurrency (`CATEGORY_CONCURRENCY`)**

How many categories/regions crawl in Phase 1 simultaneously:

```
1 category at a time   → baseline, safest
2-3 categories         → usually fine for most portals
5+ categories          → only for API-based portals with high limits
```

Watch for: Phase 1 pages returning empty or truncated results, which is a sign the portal is silently throttling rather than returning 429.

**3. Inter-request delays**

For HTML scrapers that are rate-sensitive, add delays between requests and tune them down:

```
Start: 1000ms between index pages, 200ms between detail fetches
Reduce: halve each delay and observe error rate
Stop: when error rate starts climbing above 1%
```

**Signs you've exceeded the limit:**
- Sudden spike in empty responses (portal returns HTML but no listings)
- HTTP 429 or 503 responses
- Responses contain CAPTCHA or "too many requests" HTML
- Response times climb sharply (portal is throttling per-connection)
- Previously working requests start returning 403

**Signs you're well under the limit (safely increase):**
- Error rate is 0% sustained over 5+ minutes
- Response times are stable and low
- Detail fetch queue is draining fast with workers sitting idle waiting for more jobs

**Rule of thumb:** once you find the maximum stable concurrency, run at ~70-80% of that to leave headroom for portal load spikes and other scrapers running concurrently on the same server.

**Document the result** in the scraper's `src/index.ts` or a `TUNING.md` alongside the Dockerfile:

```
Portal: sreality-cz
WORKER_CONCURRENCY sweet spot: 200 (API-based, high tolerance)
CATEGORY_CONCURRENCY: 3 (category + offer type = ~10 combos, 3 concurrent safe)
Index page delay: none needed (API pagination)
Detail fetch delay: none needed (queue concurrency handles it)
Tested: 2026-02-24, full run duration ~25 min for ~70k listings
```
