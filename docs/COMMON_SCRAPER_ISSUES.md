# Common Scraper Issues

Diagnosed issues and solutions from operating Czech (and wider) scrapers in production. Referenced from CLAUDE.md.

---

## Issue Categories

1. [Browser Automation Issues](#1-browser-automation-issues)
2. [Portal Architecture Changes](#2-portal-architecture-changes)
3. [Compressed / Encoded Data](#3-compressed--encoded-data)
4. [Cloudflare & Bot Protection](#4-cloudflare--bot-protection)
5. [Rate Limiting](#5-rate-limiting)
6. [Authentication & Session Expiry](#6-authentication--session-expiry)
7. [Data Quality Issues](#7-data-quality-issues)
8. [Ingest & Queue Issues](#8-ingest--queue-issues)
9. [Database Issues](#9-database-issues)

---

## 1. Browser Automation Issues

### Frame Detachment Error
**Symptom:** `Error: Execution context was destroyed, most likely because of a navigation.` or `Frame was detached.`

**Cause:** The page navigated away while Puppeteer was trying to interact with a DOM element. Common with SPA portals that do client-side routing.

**Fix:** Use the stealth plugin + wait for network idle before interacting:
```typescript
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
// Use page.waitForSelector before any interaction
await page.waitForSelector('.listing-card', { timeout: 10000 });
```

**Time to fix:** ~30 min
**Rule:** Always test browser scrapers in Docker. Puppeteer behaves differently on macOS (ARM vs Linux x64).

---

### Chromium Crashes in Docker
**Symptom:** `Error: Chrome crashed!` or `Protocol error: Connection closed.`

**Cause:** Missing `--no-sandbox` flag or insufficient shared memory in Docker.

**Fix:**
```typescript
const browser = await puppeteer.launch({
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // Critical in Docker
    '--disable-gpu',
  ],
  headless: true,
});
```

In Docker Compose:
```yaml
shm_size: '2gb'  # or mount /dev/shm
```

---

## 2. Portal Architecture Changes

### Selector No Longer Matches
**Symptom:** Scraper runs but extracts 0 listings. No error thrown.

**Cause:** Portal updated their HTML structure or CSS class names. Common with portals that use generated class names (e.g. `css-abc123`).

**Diagnosis:**
1. Fetch a live listing page and inspect the raw HTML
2. Compare against what the selector targets
3. Check if the portal switched from SSR to client-side rendering

**Fix:** Update selectors. If the portal now renders client-side, switch from HTML scraping to intercepting API requests:
```typescript
// Intercept the JSON API the frontend calls
page.on('response', async response => {
  if (response.url().includes('/api/listings')) {
    const data = await response.json();
    // Process structured data instead of HTML
  }
});
```

**Time to fix:** 1–3 hours

---

### API Endpoint Changed
**Symptom:** 404 or unexpected response structure.

**Diagnosis:** Check network tab in DevTools on the live portal. Find the new endpoint. Check if they switched from REST to GraphQL or vice versa.

**Fix:** Update the endpoint URL and adapt the request/response parsing.

---

### API Now Requires App Version Header
**Symptom:** 400 or 403 with "unsupported client version" message.

**Example:** Reality.cz mobile API required a specific `X-App-Version` header matching the APK version.

**Fix:** Extract the required headers from the APK or mobile app network traffic. Add version header:
```typescript
headers: {
  'X-App-Version': '3.1.4',
  'X-Platform': 'android',
}
```

---

## 3. Compressed / Encoded Data

### LZ-String Compressed Payload
**Symptom:** API response is a string that looks like Base64 but won't decode to JSON.

**Cause:** Some portals compress listing data with LZ-String (used by sreality for large category responses).

**Fix:**
```bash
npm install lz-string
```
```typescript
import LZString from 'lz-string';
const decoded = LZString.decompressFromBase64(response.data);
const listings = JSON.parse(decoded);
```

**Time to fix:** 1 hour (identifying the encoding takes most of the time)

---

### Pako (Zlib) Compressed Response
**Symptom:** Response body is binary/garbled. `Content-Encoding: deflate` in headers but axios doesn't decompress.

**Fix:**
```bash
npm install pako
```
```typescript
import pako from 'pako';
const compressed = Buffer.from(response.data, 'binary');
const decompressed = pako.inflate(compressed, { to: 'string' });
const data = JSON.parse(decompressed);
```

**Prevention:** Always log response content-type and content-encoding on the first fetch when building a new scraper.

---

## 4. Cloudflare & Bot Protection

### Cloudflare Challenge (JS Challenge)
**Symptom:** Scraper receives an HTML page with "Checking your browser before accessing..." or `cf_clearance` cookie requirement.

**Fix:** Use the `cloudflare-bypass` service in the platform:
```typescript
const response = await axios.post('http://cloudflare-bypass:8080/fetch', {
  url: targetUrl,
  headers: { 'User-Agent': getRandomUserAgent() }
});
```

**Time to fix:** ~2 hours (including testing)

**Notes:**
- The bypass service uses a headless browser to solve the challenge and return the cleared cookies
- Don't attempt to solve CF challenges yourself — it changes frequently
- Some portals use Cloudflare Turnstile (v3) which is harder; escalate

---

### TLS Fingerprinting
**Symptom:** Requests fail with connection errors even before a response, or receive immediate 403.

**Cause:** Portal fingerprints the TLS handshake (cipher suites, extension order). Node.js has a distinct fingerprint.

**Fix:** Route requests through the cloudflare-bypass service, which uses a real Chrome browser. Alternatively, use `node-fetch` with specific TLS options or a SOCKS proxy.

---

### IP Rate Limiting / Banning
**Symptom:** 429 or 503 after N requests from the same IP. Clears after 24h.

**Fix:**
1. Add longer delays between requests (see [Rate Limiting](#5-rate-limiting))
2. If IP is banned, rotate to a different deployment IP
3. Consider a rotating proxy pool for high-volume portals

---

## 5. Rate Limiting

### Portal Returns 429
**Symptom:** HTTP 429 `Too Many Requests`, sometimes with `Retry-After` header.

**Immediate fix:**
```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers['retry-after'] || '60', 10);
  await sleep(retryAfter * 1000);
  return fetchWithRetry(url); // retry
}
```

**Structural fix:** Reduce `CONCURRENT_PAGES` and add delays:
```typescript
// Before parallel batches:
const CONCURRENT_PAGES = 5; // reduce from 20
await new Promise(r => setTimeout(r, 1000)); // between batches
```

**Time to fix:** 30 min

---

### Silent Rate Limiting (No 429)
**Symptom:** Requests succeed (200) but return empty results or stale data. Recovers after pausing.

**Cause:** Some portals throttle at the application layer — returning fake empty responses rather than 429.

**Diagnosis:** Compare response `totalCount` against the portal's public listing count. If they diverge, you're being throttled.

**Fix:** Add delays and reduce concurrency until `totalCount` stabilizes.

---

## 6. Authentication & Session Expiry

### Session Expired Mid-Scrape
**Symptom:** First N listings fetch successfully, then suddenly all requests return 401 or redirect to login.

**Cause:** Session cookie expired while the scrape was running. Seen with reality.cz guest sessions.

**Fix:** Re-authenticate on 401 and retry the failed request:
```typescript
async function fetchWithAuth(url: string): Promise<any> {
  let response = await fetch(url, { headers: authHeaders() });
  if (response.status === 401) {
    await refreshSession(); // re-login
    response = await fetch(url, { headers: authHeaders() }); // retry once
  }
  return response.json();
}
```

**Prevention:** Do not cache session tokens to disk. Always obtain a fresh token at scrape start. Sessions typically last 30–60 min; long scrapes will need mid-run refresh logic.

---

### API Key Rejected
**Symptom:** 401 on `POST /bulk-ingest` from the scraper.

**Cause:** Wrong `INGEST_API_KEY` env var, or the key was rotated.

**Diagnosis:** Check `API_KEYS_<COUNTRY>` in the ingest container's environment. The `IngestAdapter` reads `INGEST_API_KEY_<PORTAL>` first, then `INGEST_API_KEY`.

**Fix on VPS:**
```bash
# Keys file location
cat /opt/landomo/scrapers/Czech/docker/secrets/api_keys_czech
# Format: comma-separated, e.g. "dev_key_cz_1,dev_key_cz_2"
```

---

## 7. Data Quality Issues

### 0 Bedrooms on All Apartments
**Symptom:** `apt_bedrooms = 0` for listings that clearly have bedrooms.

**Cause:** Czech disposition parsing failing. The portal likely uses `"3+kk"` format, not an integer.

**Fix:**
```typescript
function parseDisposition(disposition: string): number {
  const match = disposition?.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
```

---

### Area Values Way Too Large
**Symptom:** `sqm = 12000` for a city apartment.

**Cause:** Portal returned area in cm² or the field was a price-per-sqm that got misidentified as total area.

**Diagnosis:** Log raw area field values from 10 real listings. Check units.

**Fix:** Divide by 10000 if in cm². Add a sanity-check guard:
```typescript
const sqm = raw.area;
if (sqm > 10000) console.warn('Suspiciously large area:', sqm, 'for', raw.url);
```

---

### All Amenity Booleans Are `null`
**Symptom:** `has_elevator`, `has_balcony`, etc. are all null despite listings clearly mentioning them.

**Cause 1:** Portal doesn't return structured amenity data — only text.
**Fix:** Add text extraction from title + description (see lesson 5 in BEST_PRACTICES.md).

**Cause 2:** Field name changed in API response.
**Fix:** Log raw response keys and update field mappings.

---

### `property_category` Validation Error
**Symptom:** Ingest API returns 400 with `"Invalid property_category"`.

**Cause:** Transformer returning `"apartments"` (plural) instead of `"apartment"` (singular), or missing the field entirely.

**Fix:** Valid values are: `apartment`, `house`, `land`, `commercial`. Always singular, always lowercase.

---

## 8. Ingest & Queue Issues

### Jobs Not Being Processed
**Symptom:** Ingest API returns 202 but listings never appear in PostgreSQL.

**Diagnosis:**
```bash
# Check worker is running
docker ps | grep worker

# Check queue depth in Redis
redis-cli -h localhost LLEN bull:ingest-property-cz:waiting

# Check for failed jobs
redis-cli -h localhost KEYS 'bull:ingest-property-cz:failed*'
```

**Common causes:**
- Worker container not running (start it: `docker compose up -d cz-worker`)
- Wrong queue name — worker listens to `ingest-property-cz`, scraper posts to `ingest-property` (missing suffix)
- Redis unreachable from worker container

---

### 409 Conflict on Scrape Run Start
**Symptom:** `POST /api/v1/scrape-runs/start` returns 409.

**Cause:** A previous scrape run for this portal is still registered as `running` in the DB. The overlap guard prevents concurrent runs.

**Fix:**
```sql
-- Mark the stuck run as failed
UPDATE scrape_runs
SET status = 'failed', completed_at = NOW(), error_message = 'manually resolved overlap'
WHERE portal = 'sreality' AND status = 'running';
```

Or wait — the orphan reaper automatically marks runs >4 hours old as `failed`.

---

### Batch Size Too Large — Request Timeout
**Symptom:** `POST /bulk-ingest` times out after 60s.

**Fix:** Reduce batch size in the scraper:
```typescript
const BATCH_SIZE = 50; // reduce from 100
// Split and send in chunks
for (let i = 0; i < properties.length; i += BATCH_SIZE) {
  await ingestAdapter.sendProperties(properties.slice(i, i + BATCH_SIZE));
}
```

---

## 9. Database Issues

### Listings Not Appearing in Search
**Symptom:** Listings ingested successfully (confirmed in DB) but not returned by search API.

**Diagnosis 1:** Status is `removed` not `active`. Check:
```sql
SELECT status, count(*) FROM properties_new
WHERE source_platform = 'sreality'
GROUP BY status;
```

**Diagnosis 2:** Missing `property_category` — row went into `properties_other` partition which search ignores.

**Diagnosis 3:** Search query not including this country's DB in federation.

---

### `apt_bedrooms` Column Missing
**Symptom:** `ERROR: column "apt_bedrooms" does not exist`

**Cause:** Migration 013 (category partitioning) not applied to this database.

**Fix:**
```bash
psql -U landomo -d landomo_cz -f ingest-service/migrations/013_category_partitioning.sql
```

---

### Slow Queries
**Symptom:** Search endpoint slow (>500ms) for simple queries.

**Diagnosis:**
```sql
EXPLAIN ANALYZE
SELECT * FROM properties_new WHERE price < 5000000 LIMIT 10;
```

If the plan shows `Seq Scan on properties_new` (full scan), you're missing partition pruning.

**Fix:** Always include `property_category` AND `status = 'active'` in WHERE clause:
```sql
-- ✅ Fast
SELECT * FROM properties_new
WHERE property_category = 'apartment'
  AND status = 'active'
  AND price < 5000000
LIMIT 10;
```

---

## Quick Reference: Symptom → Cause → Fix

| Symptom | Likely Cause | Time to Fix |
|---|---|---|
| `Frame was detached` | Missing stealth plugin | 30 min |
| 0 results, no error | Selector changed | 1–3 hr |
| Binary response body | Compressed data (lz-string/pako) | 1 hr |
| 403 before any response | TLS fingerprinting / Cloudflare | 2 hr |
| 429 after N requests | Rate limit hit | 30 min |
| 401 mid-scrape | Session expired | 1 hr |
| 202 but no DB writes | Worker not running / wrong queue name | 30 min |
| 409 on scrape start | Previous run still `running` | 15 min |
| `apt_bedrooms` missing | Migration 013 not applied | 15 min |
| All booleans null | Portal uses text, not structured fields | 2 hr |
| `invalid property_category` | Transformer missing field or wrong value | 15 min |
| Listings not in search | Status `removed` or wrong partition | 30 min |
