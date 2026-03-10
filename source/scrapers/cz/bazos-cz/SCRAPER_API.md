# Bazos Real Estate Scraper - API Documentation

Specialized scraper API for Bazos real estate listings across 4 Central European countries.

## Server Endpoints

### Health Check

```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "scraper": "bazos",
  "focus": "real-estate",
  "version": "1.0.0",
  "timestamp": "2026-02-07T21:30:00.000Z",
  "supported_countries": ["cz", "sk", "pl", "at"],
  "supported_sections": ["RE"],
  "description": "Multi-country real estate listings scraper"
}
```

### Trigger Full Real Estate Scrape

```http
POST /scrape
```

**Response (202 Accepted):**
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-07T21:30:00.000Z"
}
```

Starts asynchronous scraping of:
- Countries: All 4 (CZ, SK, PL, AT)
- Section: Real Estate (RE) only
- Max pages: 10 per country (~200 listings per country)

Example:
```bash
curl -X POST http://localhost:8082/scrape
```

### Trigger Country-Specific Real Estate Scrape

```http
POST /scrape/:country
```

**Parameters:**

- `country` (path): One of `cz`, `sk`, `pl`, `at`
- `maxPages` (body, optional): Maximum pages to scrape (default: 5)

**Request:**
```bash
curl -X POST http://localhost:8082/scrape/cz \
  -H "Content-Type: application/json" \
  -d '{
    "maxPages": 10
  }'
```

**Response (202 Accepted):**
```json
{
  "status": "scraping started",
  "country": "cz",
  "timestamp": "2026-02-07T21:30:00.000Z"
}
```

Available countries:
- `cz` - Czech Republic
- `sk` - Slovakia
- `pl` - Poland
- `at` - Austria

## Real Estate Focus

This scraper is specialized for the **RE (Reality)** section of Bazos:

### RE Section Code

```
RE = Reality (Real Estate)
   - Residential properties (apartments, houses)
   - Commercial properties (offices, shops)
   - Land (building plots, agricultural)
   - Garages & parking
   - Mixed properties
```

## Configuration

### Environment Variables

```env
PORT=8082                              # Server port
INGEST_API_URL=http://localhost:3000   # Ingest API endpoint
NODE_ENV=production                    # Environment
```

### Scraper Configuration (In Code)

```typescript
const scraper = new ListingsScraper({
  countries: ['cz', 'sk', 'pl', 'at'],  // All countries
  sections: ['RE'],                     // Real Estate only
  maxPages: 10,                         // Pages per country (200 listings)
  delayMs: 1000                         // Delay between requests (ms)
});
```

## Data Models

### Input: Bazos Real Estate Ad

```json
{
  "id": "214665464",
  "title": "Spacious 3+1 apartment with balcony",
  "price_formatted": "5 500 000 Kč",
  "price": 5500000,
  "currency": "CZK",
  "locality": "Prague 2",
  "from": "2026-02-07 20:00:00",
  "views": 250,
  "topped": true,
  "favourite": false,
  "image_thumbnail": "https://...",
  "image_thumbnail_width": 350,
  "image_thumbnail_height": 293,
  "url": "https://reality.bazos.cz/..."
}
```

### Output: StandardProperty (Real Estate)

```json
{
  "title": "Spacious 3+1 apartment with balcony",
  "price": 5500000,
  "currency": "CZK",
  "property_type": "real_estate",
  "transaction_type": "sale",
  "source_url": "https://reality.bazos.cz/...",
  "source_platform": "bazos",
  "location": {
    "address": "Prague 2",
    "city": "Prague",
    "region": "Prague 2",
    "country": "Czech Republic"
  },
  "media": {
    "images": ["https://..."],
    "total_images": 1
  },
  "status": "active",
  "portal_metadata": {
    "bazos": {
      "ad_id": "214665464",
      "section": "RE",
      "country": "cz",
      "views": 250,
      "posted_date": "2026-02-07T20:00:00.000Z",
      "topped": true,
      "favourite": false,
      "thumbnail_url": "https://..."
    }
  },
  "images": ["https://..."],
  "description": "",
  "description_language": "cs"
}
```

## Ingest API Payload

The scraper sends batches to the ingest API:

```http
POST /ingest/bazos
Content-Type: application/json
```

**Request Body:**
```json
{
  "properties": [
    {
      "portalId": "214665464",
      "data": {
        "title": "Spacious 3+1 apartment...",
        "price": 5500000,
        "property_type": "real_estate",
        ...
      },
      "rawData": {
        "id": "214665464",
        ...
      }
    },
    ...
  ],
  "timestamp": "2026-02-07T21:30:00.000Z",
  "count": 100
}
```

**Response (200 OK / 202 Accepted):**
```json
{
  "status": "received",
  "count": 100
}
```

## Logging Output

### Start Message
```
🚀 Bazos Real Estate scraper running
   Port: 8082
   Health: http://localhost:8082/health
   Focus: Real Estate (RE section)
   Trigger full scrape: POST http://localhost:8082/scrape
   Trigger country scrape: POST http://localhost:8082/scrape/:country

Waiting for scrape triggers...
```

### Scrape Progress
```
[2026-02-07T21:30:00.000Z] 🚀 Starting Bazos Real Estate scrape...

📍 Scraping CZ...
📡 Fetching listings from Bazos API...
  ✓ Reality: 200 listings (10 pages)

📍 Scraping SK...
  ✓ Reality: 200 listings (10 pages)

📍 Scraping PL...
  ✓ Reality: 200 listings (10 pages)

📍 Scraping AT...
  ✓ Reality: 200 listings (10 pages)

Found 800 listings
🔄 Transforming 800 listings...
✅ Successfully transformed 800 listings

📤 Sending batch 1/8 (100 properties)...
✓ Sent 100 properties to ingest API
📤 Sending batch 2/8 (100 properties)...
...

✅ Scrape completed in 78.32s
   Total listings: 800
   Transformed: 800
   Sent to ingest API: 800
```

## Error Handling

### Common Errors

**Invalid Country:**
```http
POST /scrape/xx
```

Response (400 Bad Request):
```json
{
  "error": "Invalid country",
  "supported": ["cz", "sk", "pl", "at"]
}
```

**Ingest API Unavailable:**
```
❌ Failed to send batch: connect ECONNREFUSED 127.0.0.1:3000
```

**API Rate Limit (HTTP 429):**
```
Error fetching ads from cz: 429 Too Many Requests
```

Scraper automatically backs off and retries.

## Performance Metrics

### Typical Execution Times

| Task | Time |
|------|------|
| Fetch 200 listings (10 pages) | 15-20 seconds |
| Transform 200 listings | 1-2 seconds |
| Send batch (100 items) | 1-2 seconds |
| Single country (10 pages) | 15-20 seconds |
| All 4 countries (10 pages each) | 60-80 seconds |

### API Response Times

- Categories: <100ms
- Ads (per page): 200-500ms
- Ad detail: 300-800ms

### Throughput

- **~100-120 listings/minute** (respecting rate limits)
- **~600-800 properties/hour** per country
- **~10,000+ properties/day** total (all countries combined)

## Real Estate Data by Country

### Czech Republic (CZ)

```json
{
  "locality": "Prague 2, Vinohrady",
  "price_formatted": "5 500 000 Kč",
  "currency": "CZK",
  "views": 250
}
```

Typical properties:
- Apartments in Prague, Brno, Ostrava
- Houses in suburbs and countryside
- Land plots
- Commercial spaces

### Slovakia (SK)

```json
{
  "locality": "Bratislava, Staré Mesto",
  "price_formatted": "450 000 €",
  "currency": "EUR",
  "views": 180
}
```

Typical properties:
- Apartments in Bratislava, Košice, Banská Bystrica
- Family houses
- Land and plots
- Commercial real estate

### Poland (PL)

```json
{
  "locality": "Warsaw, Mokotów",
  "price_formatted": "850 000 zł",
  "currency": "PLN",
  "views": 320
}
```

Typical properties:
- Apartments in Warsaw, Krakow, Wroclaw
- Houses and villas
- Land and agricultural
- Investment properties

### Austria (AT)

```json
{
  "locality": "Vienna, 1st District",
  "price_formatted": "650 000 €",
  "currency": "EUR",
  "views": 210
}
```

Typical properties:
- Apartments in Vienna, Graz, Linz
- Houses and townhouses
- Commercial properties
- Alpine properties

## Queue-Based LLM Extraction

LLM property extraction uses BullMQ for rate-limited, reliable processing.

### Architecture

```
Scraper → Cache Check → BullMQ Queue → Worker(s) → Azure AI → Cache Store
                ↓ hit                      ↑
           Return cached              Rate Limited
                                    (60 req/min)
```

### Running the Worker

```bash
# Development
npm run dev:worker

# Production
npm run start:worker
```

The worker runs alongside the scraper. The scraper dispatches jobs to the queue; the worker processes them.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_EXTRACTION_ENABLED` | `false` | Enable LLM extraction |
| `LLM_QUEUE_MAX_CONCURRENT` | `5` | Concurrent worker jobs |
| `LLM_QUEUE_RATE_LIMIT_MAX` | `60` | Max requests per duration |
| `LLM_QUEUE_RATE_LIMIT_DURATION` | `60000` | Rate limit window (ms) |
| `LLM_QUEUE_RETRY_ATTEMPTS` | `3` | Retry count per job |
| `LLM_QUEUE_RETRY_DELAY` | `5000` | Initial retry delay (ms) |
| `LLM_QUEUE_TIMEOUT_MS` | `300000` | Max wait for all jobs |
| `AZURE_OPENAI_ENDPOINT` | - | Azure AI endpoint |
| `AZURE_OPENAI_API_KEY` | - | Azure AI API key |

### Queue Files

```
src/queue/
├── llmQueue.ts       # Queue setup, addExtractionJobs(), waitForJobs()
├── llmWorker.ts      # Worker processor, cache integration, metrics
└── startWorker.ts    # Standalone worker entry point
```

### Testing

```bash
npx ts-node test-queue.ts
```

Tests: Redis connection, queue config, job processing, cache hits, rate limiting (20-job burst), extraction quality.

### Troubleshooting

**Worker not processing jobs:** Ensure Redis is running and `LLM_EXTRACTION_ENABLED=true`.

**429 errors from Azure:** Lower `LLM_QUEUE_RATE_LIMIT_MAX` (e.g., to 30) or increase `LLM_QUEUE_RATE_LIMIT_DURATION`.

**Jobs timing out:** Increase `LLM_QUEUE_TIMEOUT_MS`. Check Azure endpoint latency.

**Cache not working:** Enable persistent cache with `PERSISTENT_CACHE_ENABLED=true` for cross-restart persistence.

## Rate Limiting

⚠️ **Bazos enforces strict rate limiting:**

```
Valid pagination:
  offset=0, limit=20    (page 1)
  offset=20, limit=20   (page 2)
  offset=40, limit=20   (page 3)
  offset=60, limit=20   (page 4)
  ...

Invalid pagination:
  offset=10, limit=20   ❌ IP BLOCK
  offset=15, limit=30   ❌ IP BLOCK
  offset=25, limit=20   ❌ IP BLOCK
```

Default delay: **1000ms between requests** (can be configured)

## Examples

### Quick Test with Node

```typescript
import { ListingsScraper } from './scrapers/listingsScraper';
import { transformBazosToStandard } from './transformers/bazosTransformer';

const scraper = new ListingsScraper({
  countries: ['cz'],
  sections: ['RE'],
  maxPages: 1
});

const listings = await scraper.scrapeAll();
const standardFormat = listings.map(ad =>
  transformBazosToStandard(ad, 'cz', 'RE')
);

console.log(JSON.stringify(standardFormat, null, 2));
```

### cURL Examples

**Full scrape (all 4 countries):**
```bash
curl -X POST http://localhost:8082/scrape
```

**Czech real estate (10 pages):**
```bash
curl -X POST http://localhost:8082/scrape/cz \
  -H "Content-Type: application/json" \
  -d '{"maxPages": 10}'
```

**All countries (5 pages each):**
```bash
for country in cz sk pl at; do
  curl -X POST "http://localhost:8082/scrape/$country" \
    -H "Content-Type: application/json" \
    -d '{"maxPages": 5}'
done
```

## Integration with Centralized Scheduler

The scraper integrates with a centralized scheduling system:

1. Scheduler calls `POST /scrape` (full) or `POST /scrape/:country` (single)
2. Scraper responds immediately (202) and runs async
3. Scraper fetches real estate listings from Bazos API
4. Scraper transforms to StandardProperty
5. Scraper sends batches to ingest API
6. On completion, scraper logs final stats

This allows the scheduler to manage multiple scrapers without blocking.

## Troubleshooting

### Issue: Connection refused to Bazos API

**Solution:** Check internet connectivity

```bash
curl https://www.bazos.cz/api/v1/categories.php
```

### Issue: IP blocked due to rate limiting

**Solution:** Wait 30+ minutes, or use different IP/VPN

### Issue: Ingest API returns 500 error

**Solution:** Check ingest API logs, verify StandardProperty format

### Issue: No real estate listings found

**Solution:** Check if RE section has data:
```bash
curl 'https://www.bazos.cz/api/v1/ads.php?offset=0&limit=20&section=RE'
```

### Issue: High latency between requests

**Solution:** Check network conditions, may need to increase delayMs

## Support

For issues or questions:
1. Check logs for error messages
2. Verify ingest API is running
3. Check Bazos API connectivity
4. Review this documentation

---

**Version:** 3.2.0 (Queue-Based LLM Extraction)
**Last Updated:** February 16, 2026
**Status:** ✅ Production Ready
