# Immodirekt.at Scraper

Production-ready TypeScript scraper for [immodirekt.at](https://www.immodirekt.at) - Austrian real estate portal owned by Scout24 Group.

## Features

- **Cloudflare Bypass**: Advanced stealth mode with automated Cloudflare challenge solving
- **Playwright-based**: Headless browser automation with anti-detection measures
- **Austrian Locale**: Proper de-AT locale and Vienna geolocation
- **Rate Limiting**: Respectful scraping with configurable delays
- **Cookie Consent**: Automatic handling of GDPR consent popups
- **Batch Processing**: Efficient data ingestion in batches
- **Error Recovery**: Robust error handling with retry logic
- **Detail Pages**: Optional enrichment from individual property pages

## Architecture

```
src/
├── index.ts                 # Express server & main orchestration
├── scrapers/
│   └── listingsScraper.ts  # Core scraping logic with Cloudflare bypass
├── types/
│   └── immodirektTypes.ts  # TypeScript type definitions
├── transformers/
│   └── immodirektTransformer.ts  # Data transformation to standard format
├── adapters/
│   └── ingestAdapter.ts    # API client for data ingestion
└── utils/
    ├── browser.ts          # Browser utilities & stealth mode
    └── userAgents.ts       # User agent rotation
```

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers
```

## Configuration

### Environment Variables

```bash
# Server
PORT=8088

# Scraping behavior
HEADLESS=true                    # Run browser in headless mode
TIMEOUT=60000                    # Page load timeout (ms)
MAX_RETRIES=3                    # Retry failed requests
RATE_LIMIT_DELAY=2000           # Delay between requests (ms)
MAX_PAGES_PER_CATEGORY=10       # Max pages to scrape per category

# Cloudflare bypass
STEALTH_MODE=true               # Enable stealth mode
BYPASS_CLOUDFLARE=true          # Enable Cloudflare bypass

# Detail enrichment
FETCH_DETAILS=true              # Scrape individual property pages

# Ingest API
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_IMMODIREKT_AT=dev_key_austria_immodirekt
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

### Docker

```bash
# Build Docker image
docker build -t landomo-scraper-immodirekt-at .

# Run container
docker run -p 8088:8088 \
  -e HEADLESS=true \
  -e BYPASS_CLOUDFLARE=true \
  landomo-scraper-immodirekt-at
```

## API Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "scraper": "immodirekt-at",
  "version": "1.0.0",
  "timestamp": "2026-02-07T10:00:00.000Z",
  "features": [
    "playwright",
    "cloudflare-bypass",
    "stealth-mode",
    "headless-browser",
    "austrian-locale"
  ],
  "cloudflare_protection": "enabled",
  "bypass_method": "playwright-stealth"
}
```

### Trigger Scrape

```bash
POST /scrape
```

**Response:**
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-07T10:00:00.000Z",
  "note": "Cloudflare bypass may take longer than usual"
}
```

## Cloudflare Bypass Strategy

This scraper implements multiple techniques to bypass Cloudflare protection:

### 1. Stealth Mode
- Removes `navigator.webdriver` flag
- Overrides automation detection signals
- Mimics real browser behavior

### 2. Browser Fingerprinting
- Austrian locale (de-AT)
- Vienna geolocation
- Realistic viewport and device settings
- Proper HTTP headers

### 3. User Agent Rotation
- Rotates between legitimate browser user agents
- Matches browser capabilities to user agent

### 4. Rate Limiting
- Respectful delays between requests (2s default)
- Random delays to appear human-like
- Extra delays between categories

### 5. Challenge Detection
- Automatically detects Cloudflare challenges
- Waits for challenge completion
- Handles multiple challenge types

## Data Flow

1. **Scraping**: Playwright navigates to listing pages with Cloudflare bypass
2. **Extraction**: JavaScript evaluation extracts structured data
3. **Transformation**: Convert to standardized schema
4. **Ingestion**: Send to central API in batches

## Property Types Scraped

- Apartments (for sale & rent)
- Houses (for sale & rent)
- Land (optional)
- Commercial properties (optional)

## Performance

- **Average scrape time**: 30-60 minutes (depends on Cloudflare challenges)
- **Listings per category**: Variable (depends on availability)
- **Memory usage**: ~200-300MB
- **CPU usage**: Moderate (browser automation)

## Troubleshooting

### Cloudflare Blocks

If Cloudflare blocks continue:
1. Increase `RATE_LIMIT_DELAY` to 3000ms or higher
2. Enable `HEADLESS=false` to debug visually
3. Use residential proxy rotation (not implemented)
4. Consider Scout24 API alternative (see research guide)

### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Browser Crashes

```bash
# Ensure Playwright browsers are installed
npm run install:browsers

# Clear browser cache
rm -rf ~/.cache/ms-playwright
```

## Alternative: ImmoScout24 API

As noted in the research guide, immodirekt.at is owned by Scout24 Group. Consider using the ImmoScout24 API instead:

- **No Cloudflare protection**
- **Faster scraping**
- **More reliable**
- **Same parent company data**

See: `/Users/samuelseidel/Development/landomo-world/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`

## Development Notes

### Testing Cloudflare Bypass

```bash
# Run with visible browser to debug
HEADLESS=false STEALTH_MODE=true npm run dev

# Test specific category
MAX_PAGES_PER_CATEGORY=1 npm run dev
```

### Adding New Categories

Edit `src/scrapers/listingsScraper.ts`:

```typescript
const categories = [
  {
    name: 'Land for Sale',
    url: 'https://www.immodirekt.at/kaufen/grundstuck',
    type: 'sale',
    propertyType: 'land'
  }
];
```

## License

Part of the Landomo World platform.

## Support

For issues related to:
- **Cloudflare bypass**: Check browser logs and stealth settings
- **Data extraction**: Inspect page selectors (they may change)
- **API ingestion**: Check ingest service logs

## References

- Research guide: `/Users/samuelseidel/Development/landomo-world/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`
- Reference implementation: `/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/idnes-reality/`
- Playwright docs: https://playwright.dev/
