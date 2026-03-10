# Configuration — immobiliare.it

## Environment Variables

**File:** `src/index.ts` (loaded at startup)

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `8111` | No | Express server listen port |
| `INGEST_API_URL` | `http://46.225.167.44:3007` | No | Remote ingest API base URL (VPS) |
| `INGEST_API_KEY_IMMOBILIARE_IT` | `italy_63anzfHjb1E18vbuQt8lWx8w` | Yes | Primary API authentication key |
| `INGEST_API_KEY` | `italy_63anzfHjb1E18vbuQt8lWx8w` | No | Fallback API key (used if primary not set) |

### Key Lookup Order

The ingest adapter resolves the API key with the following priority:

1. `process.env.INGEST_API_KEY_IMMOBILIARE_IT`
2. `process.env.INGEST_API_KEY`
3. Hardcoded default: `italy_63anzfHjb1E18vbuQt8lWx8w`

## API Endpoints

**Base URL:** `http://localhost:8111`

| Method | Path | Status Codes | Description |
|---|---|---|---|
| `GET` | `/health` | 200 | Returns server status and run statistics |
| `POST` | `/scrape` | 202, 409 | Triggers async scrape run |

### `GET /health`

Returns current server state.

```json
{
  "status": "ok",
  "scrapeRunning": false,
  "lastRunStats": {
    "startedAt": "2026-02-24T08:00:00.000Z",
    "completedAt": "2026-02-24T11:32:14.000Z",
    "totalDiscovered": 284310,
    "totalNew": 1842,
    "totalChanged": 7231,
    "totalSkipped": 275237,
    "totalIngested": 9073,
    "errors": 14
  }
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `string` | Always `"ok"` if server is running |
| `scrapeRunning` | `boolean` | `true` while a scrape is active |
| `lastRunStats` | `object` | Statistics from the most recently completed run |
| `lastRunStats.totalDiscovered` | `number` | Total listings found across all combos |
| `lastRunStats.totalNew` | `number` | Listings identified as new by checksum compare |
| `lastRunStats.totalChanged` | `number` | Listings identified as changed by checksum compare |
| `lastRunStats.totalSkipped` | `number` | Unchanged listings skipped (no ingest) |
| `lastRunStats.totalIngested` | `number` | Listings successfully POSTed to ingest API |
| `lastRunStats.errors` | `number` | Detail fetch or transform failures |

### `POST /scrape`

Triggers a scrape run asynchronously.

**Response 202** (scrape started):
```json
{ "message": "Scrape started" }
```

**Response 409** (already running):
```json
{ "error": "Scrape already running" }
```

The scrape runs in the background. Poll `/health` to monitor progress.

## Ingest API Endpoints Used

The scraper communicates with the remote ingest API at `INGEST_API_URL`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/bulk-ingest` | Ingest batches of transformed listings (100 per call) |
| `POST` | `/api/v1/checksums/compare` | Compare listing checksums; get `new`/`changed`/`unchanged` status |
| `POST` | `/api/v1/checksums/update` | Mark checksums as current after ingest (fire-and-forget) |

All requests include:
```
Authorization: Bearer {INGEST_API_KEY_IMMOBILIARE_IT}
Content-Type: application/json
```

## Browser Profile

| Setting | Value |
|---|---|
| Engine | Chromium (via Playwright) |
| Profile path | `~/.landomo/immobiliare-profile` |
| Headless | `false` (visible window required for Datadome bypass) |
| Profile persistence | Cookies, localStorage, and session data persist across runs |

The profile directory is created automatically on first launch. Do not delete it between runs — doing so discards Datadome session cookies and requires CAPTCHA re-verification.

## Category and Region Configuration

**File:** `src/types/immobiliareTypes.ts`

### `REGIONS[]`

The 20 regions are defined as a static array:

```typescript
export const REGIONS = [
  'lazio', 'lombardia', 'campania', 'piemonte', 'emilia-romagna',
  'toscana', 'sicilia', 'veneto', 'liguria', 'puglia',
  'sardegna', 'calabria', 'marche', 'abruzzo', 'trentino-alto-adige',
  'friuli-venezia-giulia', 'umbria', 'basilicata', 'molise', 'valle-d-aosta'
];
```

### `CATEGORY_ID_MAP`

Maps URL slugs to category and contract metadata:

```typescript
export const CATEGORY_ID_MAP = {
  'vendita-appartamenti': { category: 'apartment', contract: 'sale' },
  'affitto-appartamenti': { category: 'apartment', contract: 'rent' },
  'vendita-case':         { category: 'house',     contract: 'sale' },
  'affitto-case':         { category: 'house',     contract: 'rent' },
  'vendita-terreni':      { category: 'land',      contract: 'sale' },
  'vendita-uffici':       { category: 'commercial', contract: 'sale' },
  'affitto-uffici':       { category: 'commercial', contract: 'rent' },
  // land-rent intentionally omitted
};
```

## Rate Limiting Configuration

These values are hardcoded in `src/scrapers/listingsScraper.ts`:

| Parameter | Value | Description |
|---|---|---|
| Page delay | 1500–3000ms | Random delay between search page fetches |
| Pagination pause interval | Every 20 pages | Pause triggered to simulate human reading behavior |
| Pagination pause duration | 30s | Duration of each periodic pause |
| Detail fetch delay | 800–1500ms | Random delay between individual detail page fetches |
| Ingest batch size | 100 | Number of listings per POST to `/bulk-ingest` |

## Deployment Notes

| Concern | Detail |
|---|---|
| Deployment target | Local machine (laptop/desktop with residential IP) |
| VPS role | Ingest API target only; not used for scraping |
| Datadome restriction | Datacenter IPs are hard-blocked by Datadome TLS fingerprinting |
| CAPTCHA handling | Manual solve on first run; automatic on subsequent runs via profile cookies |
| Docker | Not recommended for this scraper — persistent profile and headless=false require a desktop environment |
| Process management | Use `npm start` directly or a local process manager (e.g. `pm2`) |

## Running with pm2 (Recommended for Local)

```bash
# Install pm2 globally
npm install -g pm2

# Start scraper
pm2 start npm --name immobiliare-it -- start

# Enable auto-restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs immobiliare-it

# Trigger scrape via cron (example: daily at 3 AM)
pm2 cron "0 3 * * *" "curl -X POST http://localhost:8111/scrape"
```
