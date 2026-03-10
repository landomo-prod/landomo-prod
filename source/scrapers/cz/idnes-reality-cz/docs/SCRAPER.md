# iDNES Reality - Scraper Mechanics

## Three-Phase Architecture

### Phase 1: Discovery (2-5 minutes)
- Fetches all 9 category URLs in parallel via `fetchAllPages()`
- Worker pool with concurrency of 3 for page fetching
- Adaptive delay: backs off on 429/503 responses
- Extracts lightweight listing data from HTML: ID, URL, price, title, area, location
- ~100k listings total across all categories

### Phase 2: Checksum Comparison (10-30 seconds)
- Uses `ChecksumClient` from `@landomo/core`
- Checksum fields: `price`, `title`, `description`, `sqm`, `disposition`, `floor`
- Runs compare + update in parallel for efficiency
- Expected: 90-95% unchanged on stable periods

### Phase 3: Detail Queue (10-20 minutes for ~5-10k changed)
- Only new/changed listings queued to BullMQ `idnes-details`
- Worker rate limiter: max 3 requests per 5 seconds
- Per-job delay: 1500ms + 0-500ms jitter
- Lock duration: 120s (renewed at 60s)
- Job retries: 5 attempts with exponential backoff (10s base)

## Categories

| Name | URL | Type | Property Type |
|------|-----|------|---------------|
| Flats for Sale | `/s/prodej/byty/` | sale | apartment |
| Flats for Rent | `/s/pronajem/byty/` | rent | apartment |
| Houses for Sale | `/s/prodej/domy/` | sale | house |
| Houses for Rent | `/s/pronajem/domy/` | rent | house |
| Land for Sale | `/s/prodej/pozemky/` | sale | land |
| Land for Rent | `/s/pronajem/pozemky/` | rent | land |
| Commercial for Sale | `/s/prodej/komercni-nemovitosti/` | sale | commercial |
| Commercial for Rent | `/s/pronajem/komercni-nemovitosti/` | rent | commercial |
| Recreation for Sale | `/s/prodej/chaty-chalupy/` | sale | recreation |

## Detail Page Extraction

The detail worker (`detailQueue.ts`) fetches each listing URL and extracts:

```
fetchListingDetail(url) → HTML → Cheerio
  ├── title, price, priceText, description
  ├── features (from listing feature badges)
  ├── images (gallery URLs)
  ├── coordinates (from dataLayer: listing_lat, listing_lon)
  ├── area (from dataLayer: listing_area)
  ├── location (city, district, cityArea from dataLayer)
  └── attributes (key-value from detail table)
      ├── vlastnictví → ownership
      ├── stav bytu/budovy/objektu → condition
      ├── vybavení → furnished
      ├── penb → energyRating
      ├── topné těleso/vytápění → heatingType
      ├── konstrukce budovy/typ stavby → constructionType
      └── podlaží → floor (přízemí → 0)
```

Inactive/sold listings are detected and skipped via `_inactive` flag.

## Rate Limiting & Retry

| Scenario | Behavior |
|----------|----------|
| BullMQ rate limiter | Max 3 jobs per 5 seconds |
| Per-job delay | 1500ms + random 0-500ms |
| Adaptive backoff | Increases delay on 429/503, resets on success |
| Job failure | Exponential backoff from 10s, up to 5 attempts |

## Request Headers

Rotating user agents via `getRandomUserAgent()` with Czech locale headers:
- `Accept-Language: cs,cs-CZ;q=0.9,en;q=0.8`
- Randomly selected from pool of Chrome/Firefox/Edge/Safari user agents

## Portal ID Format

```
idnes-{listing_id}
```

Where `listing_id` is extracted from the listing page HTML data.
