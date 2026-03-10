# LuxuryEstate Scraper - How Data is Fetched

## Entry Point

`src/index.ts` starts an Express server on port 8123 (configurable via `PORT`).

On startup:
1. Creates a BullMQ detail worker with configurable concurrency (default 2, via `WORKER_CONCURRENCY`)
2. Registers `/health` and `/scrape` endpoints

## Scrape Trigger

`POST /scrape` responds immediately with HTTP 202 and runs the full three-phase orchestration asynchronously. A `ScrapeRunTracker` records the run start, completion, and statistics in the ingest API.

---

## Three-Phase Orchestrator

File: `src/scraper/threePhaseOrchestrator.ts`

The orchestrator iterates over all 5 search configurations sequentially. For each configuration, it executes the three phases in order before moving to the next.

### Phase 1: Discovery (HTML Page Fetch)

File: `src/scrapers/listingsScraper.ts` — `ListingsScraper` class

**Pagination logic:**
- Starts at page 1 with no query parameter (e.g., `/apartments-italy`)
- Subsequent pages use `?pag=N` (e.g., `/apartments-italy?pag=2`)
- Maximum 50 pages per configuration
- 600ms delay between pages

**Primary extraction — `tracking-hydration` JSON blob:**

Each search result page embeds a `<script type="application/json" id="tracking-hydration">` element containing a JSON structure with a `properties` array. The scraper parses this blob to extract minimal listing data without relying on fragile CSS selectors.

```json
{
  "properties": [
    {
      "id": 131940796,
      "url": "/p131940796-luxury-apartment-rome",
      "title": "Luxury apartment in Rome",
      "price": { "raw": 2500000, "amount": "€ 2,500,000" },
      "geoInfo": { "city": "Rome", "region": "Lazio" },
      "transaction": "sale",
      "type": "apartment",
      "picture": "//cdn.luxuryestate.com/img/...",
      "bedrooms": 3
    }
  ]
}
```

**Fallback extraction — anchor tag parsing:**

When the `tracking-hydration` blob is absent or malformed, Cheerio parses all anchor tags and matches `href` values against the pattern `/p(\d+)[-/]/` to collect listing IDs and URLs.

**Minimal listing fields extracted in Phase 1:**

| Field | Source | Notes |
|-------|--------|-------|
| `id` | `properties[].id` | Numeric portal ID |
| `url` | `properties[].url` | Relative path, used as source_url |
| `title` | `properties[].title` | Used in checksum |
| `price` | `properties[].price.raw` | Used in checksum |
| `city` | `properties[].geoInfo.city` | Used in checksum |
| `categoryHint` | `properties[].type` | `'apartment'` or `'villa'`/`'house'` |

**Portal ID construction:**

The numeric ID from the URL is extracted via `/p(\d+)[-/]/` and prefixed to form `portalId = 'luxuryestate-it-{id}'`.

### Phase 2: Checksum Comparison

For each page of results (up to 50 listings per page), the orchestrator:

1. Constructs a checksum map from the minimal listing fields:
   - Checksum fields: `price`, `title`, `city`, `categoryHint`
2. Sends the checksum batch to the ingest API endpoint `POST /api/v1/checksums/compare`
3. A **semaphore limits Phase 2 to 2 concurrent checksum calls** to avoid overloading the ingest API
4. Results classify each listing as `new`, `changed`, or `unchanged`
5. `unchanged` listings are skipped entirely — no detail fetch is performed
6. Updated checksums are written back via `POST /api/v1/checksums/update`

### Phase 3: Detail Queue

For each listing classified as `new` or `changed`:
1. A `DetailJob` is created with the listing URL and category hint
2. Jobs are added to the BullMQ queue `luxuryestate-it-details` in batches of 50

---

## Detail Fetching

File: `src/scrapers/detailScraper.ts` — `DetailScraper` class

**Request:**
- Fetches the full listing page at `https://www.luxuryestate.com{url}` using Axios
- User-agent rotated per request from `src/utils/userAgents.ts`
- 500ms delay between requests within the worker

**Schema.org JSON-LD extraction (`@graph` pattern):**

LuxuryEstate detail pages embed structured data in a `<script type="application/ld+json">` tag using the `@graph` wrapper pattern:

```json
{
  "@graph": [
    {
      "@type": "RealEstateListing",
      "url": "https://www.luxuryestate.com/p131940796-...",
      "offers": {
        "price": 2500000,
        "priceCurrency": "EUR"
      },
      "mainEntity": {
        "@type": "Apartment",
        "name": "Luxury apartment in Rome",
        "description": "...",
        "floorSize": { "value": 150, "unitCode": "MTK" },
        "numberOfRooms": 4,
        "numberOfBedrooms": 3,
        "numberOfBathroomsTotal": 2,
        "address": {
          "addressLocality": "Rome",
          "addressRegion": "Lazio",
          "postalCode": "00186"
        },
        "geo": { "latitude": 41.9, "longitude": 12.5 },
        "amenityFeature": [
          { "@type": "LocationFeatureSpecification", "name": "Bedrooms", "value": 3 },
          { "@type": "LocationFeatureSpecification", "name": "Bathrooms", "value": 2 },
          { "@type": "LocationFeatureSpecification", "name": "Elevator", "value": true },
          { "@type": "LocationFeatureSpecification", "name": "Balcony", "value": "Yes" }
        ],
        "yearBuilt": 1920,
        "image": ["https://cdn.luxuryestate.com/img/..."]
      }
    }
  ]
}
```

The `mainEntity` object is extracted from the `@graph` array and its fields are merged/flattened into a `LuxuryEstateJsonLd` object. The `offers` price is merged into the same structure.

**amenityFeature extraction:**

Bedrooms and bathrooms are read from `numberOfBedrooms`/`numberOfBathroomsTotal` at the top level. If absent, the `amenityFeature` array is searched by `name` field (`"Bedrooms"`, `"Bathrooms"`). All boolean amenity flags (elevator, balcony, parking, etc.) are resolved from the `amenityFeature` array by matching on `name`.

---

## Category Detection (Detail Scraper)

File: `src/scrapers/detailScraper.ts`

Category is determined from the JSON-LD `@type` field on `mainEntity`:

| `@type` value | Detected Category |
|--------------|-------------------|
| `Apartment` | `apartment` |
| `SingleFamilyResidence` | `house` |
| `House` | `house` |
| `Villa` | `house` |
| `Residence` | `house` |

**Fallback keyword detection** on `name`, `description`, or URL path:

| Keywords | Category |
|----------|----------|
| `villa`, `casa`, `chalet`, `farmhouse`, `casale`, `rustico`, `masseria` | `house` |
| (default) | `apartment` |

**Transaction type detection** from URL path:

| URL Pattern | Transaction |
|-------------|-------------|
| `/for-rent/`, `/affitto/`, `-for-rent-`, `/rent/` | `rent` |
| (default) | `sale` |

---

## BullMQ Queue Worker

File: `src/queue/detailQueue.ts`

| Setting | Value |
|---------|-------|
| Queue name | `luxuryestate-it-details` |
| Job batch size (queueing) | 50 listings per job |
| Worker concurrency | 2 (configurable via `WORKER_CONCURRENCY`) |
| Ingest batch threshold | 100 items |
| Periodic flush interval | 10 seconds |
| Retry attempts | 3 |
| Retry backoff | Exponential, 2s base |
| Detail fetch delay | 500ms between requests |

**Worker flow per job:**
1. Wait 500ms (politeness delay)
2. Fetch detail page via `DetailScraper`
3. Transform via category-appropriate transformer
4. Accumulate in in-memory batch
5. Flush batch to ingest API when batch reaches 100 items or periodic flush fires

---

## Error Handling

### Fetch Errors
- HTTP errors result in BullMQ job failure and retry (up to 3 attempts with exponential backoff)
- Network timeouts cause the job to fail and retry

### JSON-LD Parse Errors
- If the `@graph` structure is absent or malformed, the detail job fails
- Failed jobs are retained for 2 hours for debugging inspection

### Ingest Errors
- Ingest API failures are thrown and propagate to the BullMQ job retry mechanism
- Batch is not cleared on failure, so items are not lost across retries within the same worker lifetime

---

## ScrapeRunTracker Integration

- `tracker.start()` called at the beginning of the scrape
- `tracker.complete({ listings_found, listings_new, listings_updated })` on success
- `tracker.fail(error)` on unhandled error
- Tracker uses best-effort mode with a 5s timeout to avoid blocking scrape execution

---

## Graceful Shutdown

SIGTERM/SIGINT handlers:
1. Stop accepting new scrape triggers
2. Close BullMQ worker (waits for in-progress jobs to finish)
3. Flush remaining accumulated batch to ingest API
4. Exit process
