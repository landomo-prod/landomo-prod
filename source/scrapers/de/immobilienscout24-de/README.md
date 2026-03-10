# ImmobilienScout24.de Scraper

Production-ready TypeScript scraper for ImmobilienScout24.de (Germany's largest real estate portal).

## Overview

This scraper uses the **ImmobilienScout24 Android mobile API** discovered through reverse engineering. The API provides:

- No authentication required
- Clean JSON responses
- Pagination support
- Property search with filters
- Detailed property information

## Features

- **Direct API Access**: Uses mobile app API endpoints (no browser automation needed)
- **Rate Limiting**: Built-in rate limiter (2 req/sec) to avoid throttling
- **Retry Logic**: Exponential backoff with jitter for failed requests
- **Error Handling**: Robust error handling with detailed logging
- **Type Safety**: Full TypeScript type definitions
- **Standard Format**: Transforms data to landomo StandardProperty schema
- **Batch Processing**: Efficient batch ingestion to API
- **Auto-Discovery**: Automatically discovers working API base URL

## Architecture

Based on Czech scraper patterns (`sreality` and `bezrealitky`):

```
src/
├── index.ts                    # Express server & main orchestration
├── scrapers/
│   └── listingsScraper.ts     # API client & pagination logic
├── types/
│   └── immoscout24Types.ts    # TypeScript type definitions
├── transformers/
│   └── immoscout24Transformer.ts  # Data transformation to StandardProperty
├── utils/
│   ├── fetchData.ts           # HTTP client with retry logic
│   └── userAgents.ts          # User agent rotation
└── adapters/
    └── ingestAdapter.ts       # Ingest API client
```

## Installation

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Germany/immobilienscout24-de

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Configuration

Create `.env` file:

```bash
PORT=8082
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_IMMOBILIENSCOUT24=dev_key_germany_1
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t landomo-immobilienscout24-scraper .
docker run -p 8082:8082 landomo-immobilienscout24-scraper
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8082/health
```

### Trigger Scrape
```bash
POST http://localhost:8082/scrape
```

## API Details

### Discovered Endpoints

Based on reverse engineering from Android APK (see research in `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`):

**Search Properties:**
```
GET /api/psa/is24/properties/search?profile=android&size=20&from=0&sort=dateDesc
```

**Property Details:**
```
GET /api/psa/is24/property/{exposeId}
```

### Base URLs

The scraper auto-discovers the working base URL from these candidates:

- `https://api.immobilienscout24.de`
- `https://api-prod.immobilienscout24.de`
- `https://is24-api.immobilienscout24.de`

### Search Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `profile` | string | Required: "android" | android |
| `size` | number | Results per page | 20 |
| `from` | number | Offset for pagination | 0 |
| `sort` | string | Sort order | dateDesc, priceAsc, priceDesc |
| `country` | string | Country code | DE |
| `marketingType` | string | Transaction type | PURCHASE, RENT |
| `propertyType` | string | Property type | APARTMENT, HOUSE, LAND |
| `priceMin` | number | Minimum price | 100000 |
| `priceMax` | number | Maximum price | 500000 |
| `areaMin` | number | Minimum area (m²) | 50 |
| `areaMax` | number | Maximum area (m²) | 150 |

## Data Flow

1. **Fetch**: Scraper calls ImmoScout24 API with pagination
2. **Transform**: Raw API data → StandardProperty format
3. **Ingest**: Batch send to ingest API (100 properties/batch)
4. **Dedupe**: Ingest service handles deduplication & change detection

## Rate Limiting

- **Default**: 2 requests/second (conservative)
- **Configurable**: Adjust in `RateLimiter` constructor
- **Per-request delay**: 500ms between requests
- **Batch delay**: 500ms between ingest batches

## Error Handling

- **Network Errors**: Automatic retry with exponential backoff (3 attempts)
- **4xx Errors**: No retry (client errors)
- **5xx Errors**: Retry with backoff
- **Consecutive Errors**: Stop after 3 consecutive failures per category
- **Failed Transformations**: Logged but don't stop scraping

## Monitoring

The scraper logs:

- Progress updates every 100 listings
- Batch ingestion status
- API errors with details
- Total time and counts

Example output:
```
🚀 Starting ImmobilienScout24 scrape...
✅ Using base URL: https://api.immobilienscout24.de

Scraping PURCHASE listings...
  Fetched 100 listings...
  Fetched 200 listings...
  ✅ Found 237 PURCHASE listings

Scraping RENT listings...
  Fetched 100 listings...
  ✅ Found 189 RENT listings

✅ Scraping complete: 426 total listings
🔄 Transforming 426 listings...
✅ Successfully transformed 426 listings
📤 Sending batch 1/5 (100 properties)...
✅ Sent 100 properties to ingest API

✅ Scrape completed in 45.23s
   Total listings: 426
   Transformed: 426
   Sent to ingest API: 426
```

## Advanced Features

### Detail Enrichment

By default, the scraper fetches **search results only** (fast).

To fetch **full property details** for each listing, uncomment this line in `src/index.ts`:

```typescript
const enrichedListings = await scraper.enrichListings(listings);
```

**Warning**: This increases scraping time significantly (1 extra API call per property).

### Custom Search Options

Modify the search in `src/scrapers/listingsScraper.ts`:

```typescript
const listings = await scraper.scrapeCategory({
  marketingType: 'PURCHASE',
  propertyType: 'APARTMENT',
  priceMin: 200000,
  priceMax: 500000,
  areaMin: 60,
  sort: 'priceAsc'
});
```

## Research & Reverse Engineering

This scraper is based on extensive reverse engineering documented in:

- `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`
- `/private/tmp/claude/.../scratchpad/ImmoScout24_API_Analysis.md`
- `/private/tmp/claude/.../scratchpad/test_immoscout24_api.py`

Key findings:

- No certificate pinning
- No API authentication required
- Public API endpoints
- TLS 1.2/1.3 support
- Standard HTTP/2

## Anti-Bot Status

**Status**: ✅ No anti-bot protection detected

- Direct API access works
- No Cloudflare/DataDome
- No rate limiting observed (at 2 req/sec)
- User-Agent rotation recommended

## Legal & Ethics

- **robots.txt**: Check compliance
- **Rate Limiting**: Respect server resources (2 req/sec)
- **ToS**: Review ImmobilienScout24 Terms of Service
- **GDPR**: Handle personal data appropriately
- **Commercial Use**: Consider official API partnership

## Troubleshooting

### API Base URL Not Found

If auto-discovery fails:

1. Check network connectivity
2. Try manual URL in browser
3. Check API endpoint changes
4. Review error logs

### No Listings Returned

1. Verify search parameters
2. Check API response structure
3. Test with minimal parameters
4. Review API changes

### High Error Rate

1. Reduce rate limiting (1 req/sec)
2. Add longer delays
3. Rotate user agents more frequently
4. Check for API changes

## Development

### Run Tests

```bash
npm test
```

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npx eslint src/
```

## Related Scrapers

- **Austria**: `/scrapers/Austria/immobilienscout24-at/` (same API, different base URL)
- **Czech Republic**: `/scrapers/Czech Republic/sreality/` (similar architecture)
- **Czech Republic**: `/scrapers/Czech Republic/bezrealitky/` (GraphQL pattern)

## Support

For issues or questions:

1. Check research documentation
2. Review error logs
3. Test API endpoints manually
4. Contact team

## License

Internal use only - Landomo World platform
