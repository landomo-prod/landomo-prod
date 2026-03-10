# Immowelt.at Scraper

Production-ready TypeScript scraper for Immowelt.at using Playwright.

## Architecture

This scraper follows the established Landomo architecture:

```
immowelt-at/
├── src/
│   ├── index.ts                    # Express server & orchestration
│   ├── scrapers/
│   │   └── listingsScraper.ts      # Playwright-based scraping logic
│   ├── types/
│   │   └── immoweltTypes.ts        # TypeScript type definitions
│   ├── transformers/
│   │   └── immoweltTransformer.ts  # Raw → StandardProperty transformation
│   ├── adapters/
│   │   └── ingestAdapter.ts        # Communication with Ingest API
│   └── utils/
│       ├── browser.ts              # Playwright utilities
│       └── userAgents.ts           # User agent rotation
├── package.json
├── tsconfig.json
└── playwright.config.ts
```

## Features

- **Playwright-based**: Headless browser automation with stealth mode
- **Next.js Extraction**: Extracts data from `__NEXT_DATA__` script tags
- **HTML Fallback**: Falls back to HTML parsing if Next.js data unavailable
- **Cookie Consent**: Automatic handling of cookie/GDPR banners
- **Rate Limiting**: Configurable delays between requests
- **Anti-Detection**: User agent rotation, stealth scripts, human-like behavior
- **Retry Logic**: Automatic retries on failures
- **Batch Processing**: Sends data to Ingest API in batches

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers
```

## Configuration

Create a `.env` file:

```env
# Server
PORT=8090

# Browser
HEADLESS=true
TIMEOUT=30000
MAX_RETRIES=3
RATE_LIMIT_DELAY=1000

# Scraping
MAX_PAGES_PER_CATEGORY=999999
FETCH_DETAILS=false

# Ingest API
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_IMMOWELT_AT=dev_key_austria_immowelt
```

## Usage

### Development

```bash
# Run in development mode
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### API Endpoints

#### Health Check
```bash
GET http://localhost:8090/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "immowelt-at",
  "version": "1.0.0",
  "timestamp": "2026-02-07T10:00:00.000Z",
  "features": ["playwright", "next-js-extraction", "headless-browser"]
}
```

#### Trigger Scrape
```bash
POST http://localhost:8090/scrape
```

Response:
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-07T10:00:00.000Z"
}
```

## Scraping Strategy

### 1. Next.js Data Extraction

Immowelt.at is built with Next.js, which embeds data in a `__NEXT_DATA__` script tag:

```javascript
const nextData = await page.evaluate(() => {
  const scriptTag = document.getElementById('__NEXT_DATA__');
  return JSON.parse(scriptTag.textContent);
});
```

This provides structured JSON data without parsing HTML.

### 2. HTML Fallback

If `__NEXT_DATA__` is unavailable, the scraper falls back to HTML extraction:

```javascript
const listings = await page.evaluate(() => {
  const cards = document.querySelectorAll('[data-testid="property-card"]');
  // Extract data from DOM
});
```

### 3. Categories Scraped

- Apartments for Sale: `/liste/oesterreich/wohnungen/kaufen`
- Apartments for Rent: `/liste/oesterreich/wohnungen/mieten`
- Houses for Sale: `/liste/oesterreich/haeuser/kaufen`
- Houses for Rent: `/liste/oesterreich/haeuser/mieten`

### 4. Anti-Detection Measures

- **Stealth Mode**: Removes automation flags
- **User Agent Rotation**: Random desktop user agents
- **Human Behavior**: Random delays, scrolling
- **Cookie Consent**: Automatic acceptance
- **Rate Limiting**: Configurable delays between requests

## Data Transformation

### Input (ImmoweltListing)
```typescript
{
  id: "12345",
  title: "Schöne 3-Zimmer-Wohnung in Wien",
  url: "https://www.immowelt.at/expose/12345",
  price: 450000,
  location: { city: "Wien", district: "Leopoldstadt" },
  area: 75,
  rooms: 3,
  propertyType: "apartment",
  transactionType: "sale"
}
```

### Output (StandardProperty)
```typescript
{
  title: "Schöne 3-Zimmer-Wohnung in Wien",
  price: 450000,
  currency: "EUR",
  property_type: "apartment",
  transaction_type: "sale",
  source_platform: "immowelt-at",
  location: {
    country: "Austria",
    city: "Wien",
    region: "Leopoldstadt"
  },
  details: {
    sqm: 75,
    rooms: 3
  },
  price_per_sqm: 6000
}
```

## Error Handling

- **Network Errors**: Automatic retry with exponential backoff
- **Parsing Errors**: Logged and skipped, scraping continues
- **Browser Crashes**: Browser is restarted automatically
- **API Errors**: Batches are retried independently

## Performance

- **Parallel Scraping**: Multiple categories scraped sequentially
- **Batch Processing**: 100 properties per batch to Ingest API
- **Rate Limiting**: ~1-2 seconds between page loads
- **Memory Efficient**: Browser context closed after each category

## Monitoring

Logs include:
- Scraping progress (pages, listings found)
- Transformation success/failure rates
- Ingest API responses
- Error details with stack traces

## Legal & Compliance

- Respects rate limits to avoid overloading the server
- Uses realistic user agents
- Does not bypass authentication
- For research/development purposes only

## Troubleshooting

### Browser Crashes
```bash
# Reinstall Playwright browsers
npm run install:browsers
```

### Timeout Errors
```env
# Increase timeout in .env
TIMEOUT=60000
```

### No Listings Found
```env
# Disable headless to see what's happening
HEADLESS=false
```

### Cookie Banner Issues
Check browser utils for updated consent selectors.

## Dependencies

- **playwright**: Browser automation
- **express**: HTTP server
- **axios**: HTTP client for Ingest API
- **@landomo/core**: Shared types and utilities
- **typescript**: Type safety

## Development

### Type Safety
All data structures are fully typed:
- `ImmoweltListing`: Portal-specific raw data
- `StandardProperty`: Normalized landomo format
- `NextDataStructure`: Next.js data structure

### Testing
```bash
# Test with limited pages
MAX_PAGES_PER_CATEGORY=2 npm run dev
```

### Debugging
```bash
# Run with browser visible
HEADLESS=false npm run dev
```

## Future Improvements

- [ ] Add detail page scraping for complete data
- [ ] Implement proxy rotation for large-scale scraping
- [ ] Add screenshot capture on errors
- [ ] Implement incremental scraping (only new/updated)
- [ ] Add metrics/monitoring integration
- [ ] Support for additional property types (commercial, land)

## Contact

For questions or issues, contact the Landomo development team.

## License

Proprietary - Landomo World
