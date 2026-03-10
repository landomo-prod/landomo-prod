# Scraper Best Practices & Lessons Learned

Hard-won knowledge from building and operating 25 scrapers across 5 countries. Read this before writing a new scraper.

---

## Architecture Principles

### One Container = One Portal
Never combine multiple portals in a single scraper container. Each portal has different:
- Rate limits and anti-scraping behavior
- Deployment cadence (when the portal changes, only that scraper needs updating)
- Failure modes (one portal going down shouldn't affect others)
- Memory and CPU profiles

### 70% Effort Goes on Transformers
The scraper fetch logic is usually straightforward. The real work — and where bugs hide — is in the transformers:
- Czech portals return disposition as strings like `"3+kk"`, `"4+1"` that need parsing
- Area fields come in m², but sometimes hectares or descriptive strings
- Boolean amenities (`lift`, `balcony`) sometimes come as `true/false`, sometimes `"Ano"/"Ne"`, sometimes presence in an array
- Price fields can be monthly rent, total price, price per m², or null

Write thorough transformer tests with real API responses saved as fixtures.

### Always Use `ScrapeRunTracker`
Every scraper must register runs with the ingest API:
```typescript
POST /api/v1/scrape-runs/start   → { scrapeRunId }
POST /api/v1/scrape-runs/complete
POST /api/v1/scrape-runs/fail
```
This feeds the monitoring dashboard, staleness detection, and circuit breaker logic. Use best-effort (5s timeout, don't let failure block the scrape).

### Fail Fast on Non-Retryable Errors
The `IngestAdapter` already handles this, but in your fetch logic too: if a portal returns 403/404/410, stop immediately — don't retry. These are signal errors, not transient failures. Log them prominently so they appear in alerting.

---

## Implementing the Checksum Pattern

This is the single highest-ROI optimization for any scraper. Without it, every run re-ingests 100% of listings even when 80–90% are unchanged. With it, only new/changed listings hit the database.

**Reference implementation:** `scrapers/Czech Republic/bezrealitky/src/scrapers/listingsScraper.ts` (`scrapeWithChecksums()`)

**The pattern:**
```typescript
// 1. Fast scan — fetch only fields needed for checksum
const allListings = await scraper.scrapeAll(); // gets id + hash fields

// 2. Build checksums from stable fields
const checksums = allListings.map(l => ({
  portalId: String(l.id),
  checksum: hash(l.price + l.title + l.surface + l.floor)
}));

// 3. Compare against DB
const checksumClient = new ChecksumClient(ingestApiUrl, ingestApiKey);
const comparison = await checksumClient.compareChecksums(checksums, scrapeRunId);
// Returns: { new: N, changed: M, unchanged: K, results: [...] }

// 4. Filter to only new + changed
const changedIds = new Set(
  comparison.results
    .filter(r => r.status === 'new' || r.status === 'changed')
    .map(r => r.portalId)
);
const toIngest = allListings.filter(l => changedIds.has(String(l.id)));

// 5. Ingest filtered set, then update all checksums
await ingestAdapter.sendProperties(toIngest);
await checksumClient.updateChecksums(checksums, scrapeRunId); // mark all as seen
```

**What fields to checksum:** Use fields that change when a listing meaningfully changes — price, title, area, floor. Do NOT use fields that vary per-request (timestamps, view counts, order fields).

**Checksum mode env var pattern:** Gate it behind `ENABLE_CHECKSUM_MODE=true` so it can be toggled per environment without redeployment. Default to off until validated in staging.

**Expected savings:** 80–90% on mature portals (listings stable week-over-week). Less on new portals still building their inventory.

---

## Rate Limiting & Request Patterns

### Add Delays Between Requests
Minimum 300ms between sequential requests. 500ms between categories. Never fire parallel requests without a limit.

```typescript
// Between pages in the same category
await new Promise(resolve => setTimeout(resolve, 300));

// Between categories
await new Promise(resolve => setTimeout(resolve, 500));
```

### Parallel Requests — Use `Promise.allSettled`, Not `Promise.all`
If any page fetch fails with `Promise.all`, you lose the entire batch. With `Promise.allSettled`, failed pages are logged and skipped; successful pages are processed.

```typescript
const pageResults = await Promise.allSettled(
  offsets.map(offset => fetchPage(offset, limit))
);
// Handle fulfilled and rejected separately
for (const result of pageResults) {
  if (result.status === 'fulfilled') { ... }
  else { console.error('Page failed:', result.reason.message); }
}
```

### Cap Concurrency
20 concurrent requests is a reasonable ceiling for most portals (bezrealitky uses this). More than 50 concurrent requests will get you rate-limited or banned.

### Rotate User Agents
Always rotate from a pool of real browser user agents. Fixed user agents are the first thing portals filter on. Keep a list of 100+ agents in `utils/userAgents.ts`.

### Respect `retry-after` Headers
If a portal returns 429, check `retry-after` header before sleeping. Sleeping a fixed delay often under- or over-waits.

---

## Transformer Patterns

### Czech Disposition Parsing
Czech listings encode room count in disposition strings. Parse them consistently:

```typescript
function parseCzechDisposition(disposition: string): number {
  // "3+kk" → 3 bedrooms (kk = kitchen nook, not full bedroom)
  // "4+1"  → 4 bedrooms (1 = separate kitchen)
  // "1+1"  → 1 bedroom
  // "garsoniera" → studio → 0 bedrooms
  const match = disposition?.match(/^(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10);
}
```

### Boolean Amenities — Normalize Everything to `true|false`
Portals return booleans in wildly different formats. Always normalize:

```typescript
// Czech "Ano"/"Ne" strings
const hasLift = raw.lift === true || raw.lift === 'Ano' || raw.lift === '1';

// Present in an array of feature strings
const hasParking = (raw.features || []).includes('parking');

// Truthy value check
const hasBalcony = Boolean(raw.balcony || raw.balconySurface > 0);
```

Always default to `false`, not `null`, for boolean amenity fields. `null` means unknown; `false` means confirmed absent. Most portals mean "absent" when they omit a field.

### Area Conversions
```typescript
// Always store in m²
// If portal returns hectares: multiply by 10000
// If portal returns ft²: multiply by 0.0929
const sqm = raw.unit === 'ha' ? raw.area * 10000 : raw.area;
```

### Price — Store Raw, Don't Convert Currency
Store the price in the portal's currency. Do not attempt currency conversion in transformers. The `currency` field should reflect what the portal actually shows. Conversion is a search/display concern.

### Never Fabricate Data
If a field is missing, return `null` or the typed default (`false` for booleans, `0` for required numeric fields only if clearly zero). Do not interpolate, estimate, or make up values. A `null` that gets filtered by the search service is better than a wrong value that misleads users.

---

## Testing

### Test in Docker, Not macOS
Puppeteer/Chromium behaves differently on macOS vs Linux. Test browser-based scrapers in Docker from day one.

```bash
docker build -t scraper-test .
docker run --rm --env-file .env.test scraper-test node dist/index.js
```

### Save Real API Responses as Fixtures
Before writing the transformer, save a real API response to `__fixtures__/listing-apartment.json`. Write transformer tests against this fixture. This gives you:
- Reproducible tests that don't hit the live portal
- Regression protection when the portal changes its schema
- Documentation of what the raw data actually looks like

### Validate Transformer Output Against TypeScript Type
Run `npm run type-check` after writing a transformer. The TypeScript compiler will catch missing required fields and wrong types before the scraper ever runs.

### Spot-Check a Few Transformed Listings Manually
Before declaring a transformer done, manually compare 5–10 raw listings against their transformed output. Look for:
- Bedrooms count plausible? (not 0 for a 3+kk)
- Area in m² not hectares?
- Price reasonable for the market?
- Boolean amenities match what the listing says?

---

## Lessons Learned from the Czech Portals

### Lesson 1: Session-Based APIs Need Fresh Auth on Each Run
Reality.cz uses a guest login (`/api/v3/auth/guest`) that returns a session ID (`sid`) cookie. This session expires. The scraper re-authenticates at the start of each run. Do not cache or persist session tokens to disk — always get a fresh one. Stale tokens cause cryptic 401 errors mid-scrape.

### Lesson 2: Two-Phase Pattern Saves Enormous Time — When Done Right
The two-phase pattern (discover IDs → fetch details) is only fast if the detail fetches are parallel. Reality.cz has this pattern but does sequential detail fetches with 500ms delays, making it 2–3 hours for 70k listings. The correct implementation uses a BullMQ queue with controlled concurrency for detail fetches (sreality uses 350 concurrency via BullMQ). Lesson: implement the queue before launching the scraper, not after.

### Lesson 3: GraphQL `hash` Field Is Your Checksum
BezRealitky returns a `hash` field on every listing in the GraphQL response. Use it directly as your checksum — the portal already computes it from the listing's data. Do not re-hash it; just store it. Comparing this field against the DB is O(N) with no extra computation.

### Lesson 4: Streaming Batches Reduces Memory
For large portals (50k+ listings), fetching everything into memory then processing is risky. Use the `onBatch` streaming callback pattern: each page batch of ~1,200 listings is processed and sent to ingest before fetching the next batch. Peak memory stays bounded.

```typescript
await scraper.scrapeAll(async (batch) => {
  const transformed = batch.map(transform);
  await ingestAdapter.sendProperties(transformed);
});
// Instead of:
const all = await scraper.scrapeAll();
const transformed = all.map(transform); // 50k objects in memory
```

### Lesson 5: Slovak Scrapers Need Text Extraction
Reality.sk and TopReality.sk don't return structured amenity data. They only have title and description text. 90% of the amenity fields (`has_elevator`, `has_parking`, etc.) were NULL until we added text extraction:

```typescript
function extractFromText(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some(kw => normalized.includes(kw));
}
const hasLift = extractFromText(raw.title + ' ' + raw.description, ['výtah', 'lift', 'elevator']);
```

Apply this lesson to any portal that lacks structured amenity fields.

### Lesson 6: Per-Country BullMQ Queue Names Are Mandatory
Using a shared queue name `ingest-property` (without country suffix) causes jobs from Czech scrapers to be processed by Slovak workers — which connect to the wrong PostgreSQL database. The fix is simple but the bug is insidious: data looks correct in the Czech DB but is missing; it's silently inserted into the Slovak DB.

**Always include country in queue name:** `ingest-property-${country}`

### Lesson 7: The Ingest API Key Is Per-Portal, Not Per-Country
The API authenticates with a comma-separated list of keys (`API_KEYS_CZ=key1,key2,key3`). Each scraper uses its own key so you can revoke one portal's access without affecting others. The `IngestAdapter` reads `INGEST_API_KEY_<PORTAL>` first, falling back to `INGEST_API_KEY`.

### Lesson 8: `property_category` Is Required in Every Payload
The ingest API rejects any payload without `property_category`. The UPSERT routes to the correct partition based on this field. A common mistake when writing a new transformer is forgetting to include it:

```typescript
// ✅ Required — do not omit
return {
  property_category: 'apartment', // MUST be present
  bedrooms: parsedBedrooms,
  sqm: raw.surface,
  ...
};
```

### Lesson 9: Verify Portal State Before Writing the Transformer
Before assuming a field exists, fetch 20–30 live listings and inspect the raw JSON. Portal APIs change without notice. A field that was always present may have moved, been renamed, or been split into sub-fields. Build the transformer against observed data, not documentation.

### Lesson 10: BezRealitky `ENABLE_CHECKSUM_MODE` Pattern Is Reusable
The BezRealitky checksum mode is gated behind an env var so it can be rolled out gradually. When implementing checksum mode in a new scraper:
1. Add `ENABLE_CHECKSUM_MODE=false` default
2. Test in staging with real data — verify savings % and correctness
3. Enable in production only after 2–3 successful staging runs
4. Monitor `unchanged` count in the first few production runs — if it's 0%, the checksum logic is wrong

### Lesson 11: Docker Network Names Are `{compose-project}_{network-name}`
The VPS Docker Compose uses `cz-network` as the network name. Docker names it `docker_cz-network` (prefixing the project name). If you manually connect containers (`docker network connect`), use the full Docker name. Containers communicate by service name within the same network — no port mapping needed internally.

### Lesson 12: Never Use `Promise.all` for Portal Requests
`Promise.all` fails fast — one failed page request kills the entire batch. This is catastrophic for 20+ parallel page fetches. Always use `Promise.allSettled` and handle partial failures gracefully. A scrape that captures 19/20 pages is far better than one that throws.

---

## Checklist for New Scrapers

Before declaring a scraper production-ready:

- [ ] Transformer returns `property_category` on every object
- [ ] All required category fields populated (see CLAUDE.md category table)
- [ ] `source_url` is unique per listing (used as UPSERT key)
- [ ] `source_platform` matches the portal name
- [ ] `status: 'active'` set on all fresh listings
- [ ] Boolean amenity fields are `true|false`, not `null`/truthy strings
- [ ] Area fields in m² (not hectares, not ft²)
- [ ] Price in local currency, `currency` field set
- [ ] `ScrapeRunTracker` integrated (start/complete/fail calls)
- [ ] User agent rotation in place
- [ ] Rate limiting: delays between requests
- [ ] `Promise.allSettled` used for parallel fetches
- [ ] Retry logic in `IngestAdapter` (already built-in, just use it)
- [ ] Type-check passes: `npm run type-check`
- [ ] Transformer tested against real fixtures
- [ ] Manual spot-check of 5–10 transformed listings
- [ ] Tested in Docker (not macOS)
- [ ] Docker service added to `docker-compose.yml`
- [ ] Scheduler entry added with staggered cron
- [ ] `ENABLE_CHECKSUM_MODE` env var added (default false, enable after validation)
