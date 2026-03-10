# Willhaben.at Scraper

Production-ready TypeScript scraper for **willhaben.at**, Austria's largest real estate portal.

## Overview

This scraper extracts real estate listings from Willhaben.at using their internal API with CSRF token authentication. It follows the landomo-world scraper architecture and integrates seamlessly with the centralized ingest service.

## Features

- **CSRF Token Management**: Automated extraction and caching of CSRF tokens using Playwright
- **API-Based Scraping**: Direct API calls (no HTML parsing) for reliable data extraction
- **Rate Limiting**: 1-2 requests/second to respect server resources
- **Retry Logic**: Exponential backoff for failed requests
- **Batch Processing**: Efficient bulk upload to ingest API
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Graceful degradation and detailed error logging

## Architecture

```
willhaben-at/
├── src/
│   ├── index.ts                      # Express server & main orchestration
│   ├── scrapers/
│   │   └── listingsScraper.ts        # Core scraping logic
│   ├── types/
│   │   └── willhabenTypes.ts         # Willhaben API response types
│   ├── transformers/
│   │   └── willhabenTransformer.ts   # Transform to StandardProperty
│   ├── utils/
│   │   ├── fetchData.ts              # API client with CSRF handling
│   │   └── userAgents.ts             # User agent rotation
│   └── adapters/
│       └── ingestAdapter.ts          # Ingest API integration
├── package.json
├── tsconfig.json
└── README.md
```

## API Details

### Base Endpoint
```
https://www.willhaben.at/webapi/iad/search/atz/2/101/atverz
```

### Required Headers
```http
x-bbx-csrf-token: {extracted from session}
x-wh-client: api@willhaben.at;responsive_web;server;1.0.0;desktop
Accept: application/json
Referer: https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote
User-Agent: Mozilla/5.0 ...
```

### Query Parameters
- `rows`: Results per page (default: 30)
- `TOP_AD`: Include top ads (value: `topad_result`)
- `sort`: Sort order (11 = newest first)
- `page`: Page number (1-indexed)

### Response Structure
```json
{
  "advertSummary": [
    {
      "id": "1527029961",
      "description": "Wien Doebling Beste Lage...",
      "attributes": {
        "attribute": [
          {"name": "PRICE", "values": ["395000"]},
          {"name": "ESTATE_SIZE", "values": ["85"]},
          {"name": "NUMBER_OF_ROOMS", "values": ["3"]},
          {"name": "COORDINATES", "values": ["48.24029,16.34025"]}
        ]
      },
      "advertImageList": {
        "advertImage": [...]
      }
    }
  ]
}
```

## CSRF Token Extraction

The scraper uses Playwright to extract the CSRF token from Willhaben's session:

1. Launch headless browser
2. Navigate to Willhaben real estate page
3. Extract token from:
   - Cookies (`x-bbx-csrf-token`)
   - Meta tags
   - Network request headers
4. Cache token for 30 minutes
5. Auto-refresh on expiration (403/401 responses)

## Installation

```bash
cd scrapers/Austria/willhaben-at
npm install
```

## Configuration

Environment variables:

```bash
# Ingest API Configuration
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_WILLHABEN=dev_key_austria_1

# Server Port
PORT=8082
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Docker (Recommended)
```bash
docker build -t willhaben-scraper .
docker run -p 8082:8082 \
  -e INGEST_API_URL=http://ingest:3004 \
  -e INGEST_API_KEY_WILLHABEN=your_key \
  willhaben-scraper
```

## API Endpoints

### Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "scraper": "willhaben",
  "version": "1.0.0",
  "timestamp": "2026-02-07T12:00:00.000Z"
}
```

### Trigger Scrape
```bash
POST /scrape

Response (202 Accepted):
{
  "status": "scraping started",
  "timestamp": "2026-02-07T12:00:00.000Z"
}
```

Scraping runs asynchronously. Monitor logs for progress:
```
📡 Fetching listings from Willhaben API...
Processing page 1: 30 listings
Processing page 2: 30 listings
...
🔄 Transforming 150 listings...
✅ Successfully transformed 150 listings
📤 Sending batch 1/2 (100 properties)...
✅ Sent 100 properties to ingest API
📤 Sending batch 2/2 (50 properties)...
✅ Sent 50 properties to ingest API
✅ Scrape completed in 45.32s
```

## Data Transformation

Willhaben attributes are mapped to the StandardProperty schema:

### Basic Mapping
- `HEADING` → `title`
- `PRICE` → `price` (EUR)
- `PROPERTY_TYPE_ID` → `property_type`
- `ADTYPE_ID` → `transaction_type` (1=sale, 2=rent)

### Location
- `LOCATION` → `location.address`
- `STATE` / `DISTRICT` → `location.region`
- `POSTCODE` → `location.postal_code`
- `COORDINATES` → `location.coordinates` (lat/lon)

### Details
- `NUMBER_OF_ROOMS` → `details.rooms`, `details.bedrooms`
- `ESTATE_SIZE/LIVING_AREA` → `details.sqm`
- `FLOOR` → `details.floor`

### Amenities (from ESTATE_PREFERENCE)
- `24` → Balcony
- `25` → Terrace
- `26` → Garden
- `27` → Garage
- `28` → Parking
- `250` → Elevator

### Media
- `advertImageList.advertImage[]` → `media.images[]`
- `mainImageUrl`, `thumbnailImageUrl`, `referenceImageUrl`
- Floor plans (if available)

## Rate Limiting

The scraper implements proper rate limiting:
- **1-2 seconds delay** between page requests
- **500ms delay** between batch uploads
- **Exponential backoff** on errors (1s, 2s, 4s, 8s)
- **CSRF token caching** (30 min TTL)

## Error Handling

### CSRF Token Expiration
- Detected on 403/401 responses
- Automatically refreshes token
- Retries failed request

### Network Errors
- 3 retry attempts with exponential backoff
- Graceful degradation on detail fetch failures
- Continues with remaining batches if one fails

### Transformation Errors
- Individual listing errors logged
- Scraper continues with remaining listings
- Failed count reported in summary

## Testing

### Manual Test
```bash
# Test CSRF extraction
ts-node -e "
import { extractCsrfToken } from './src/utils/fetchData';
extractCsrfToken().then(token => console.log('Token:', token));
"

# Test scraping (first page only)
ts-node -e "
import { ListingsScraper } from './src/scrapers/listingsScraper';
const scraper = new ListingsScraper();
scraper.scrapePages(1).then(listings =>
  console.log('Scraped', listings.length, 'listings')
);
"
```

### Integration Test
```bash
# Start scraper
npm run dev

# Trigger scrape from another terminal
curl -X POST http://localhost:8082/scrape
```

## Performance

### Metrics
- **CSRF extraction**: ~3-5 seconds (cached for 30 min)
- **Page fetch**: ~1-2 seconds per page (30 listings)
- **Transformation**: ~0.1ms per listing
- **Batch upload**: ~1-2 seconds per 100 properties

### Estimated Throughput
- ~300-500 listings per minute
- ~18,000-30,000 listings per hour (with delays)

## Monitoring

### Key Metrics to Track
- CSRF token refresh rate
- API response times
- Failed request rate
- Transformation error rate
- Ingest API success rate

### Log Levels
- **INFO**: Scrape progress, batch uploads
- **WARN**: Failed detail fetches, retries
- **ERROR**: CSRF failures, API errors, critical issues

## Troubleshooting

### "Failed to extract CSRF token"
- Check if Willhaben changed their page structure
- Verify Playwright is installed: `npm install playwright`
- Install browser: `npx playwright install chromium`
- Check network connectivity

### "403 Forbidden" errors
- CSRF token may be expired (should auto-refresh)
- User agent may be blocked (rotate with `userAgents.ts`)
- Too many requests (check rate limiting)

### "No listings found"
- API endpoint may have changed
- Search parameters may need adjustment
- Check network capture for current endpoint format

## Maintenance

### Regular Tasks
1. **Monitor API changes**: Willhaben may update their API
2. **Update user agents**: Keep user agent pool current
3. **Check CSRF logic**: Verify token extraction still works
4. **Review logs**: Look for patterns in failures

### When Willhaben Updates
1. Capture new network requests (use browser DevTools)
2. Update endpoint URL in `fetchData.ts`
3. Update request headers if changed
4. Update type definitions if response structure changed
5. Test thoroughly before deployment

## References

- **Research Guide**: `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`
- **Network Capture**: `/scrapers/Austria/willhaben_network_capture.json`
- **Czech Scraper**: `/scrapers/Czech Republic/sreality/` (reference architecture)

## License

Proprietary - Landomo World Platform

## Support

For issues or questions, contact the development team.
