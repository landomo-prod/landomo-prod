# Quick Start Guide - Immowelt.at Scraper

## Installation (2 minutes)

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Austria/immowelt-at

# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npm run install:browsers

# 3. Create environment file
cp .env.example .env
```

## Test Run (Development)

```bash
# Test with limited pages (fast)
MAX_PAGES_PER_CATEGORY=1 HEADLESS=false npm run dev
```

This will:
- Launch Chrome browser (visible)
- Scrape 1 page per category (4 categories)
- Extract ~20-40 listings
- Transform to standard format
- Print results to console

## Production Run

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

Then trigger scraping:
```bash
curl -X POST http://localhost:8090/scrape
```

## Verify It Works

### 1. Health Check
```bash
curl http://localhost:8090/health
```

Expected output:
```json
{
  "status": "healthy",
  "scraper": "immowelt-at",
  "version": "1.0.0",
  "features": ["playwright", "next-js-extraction", "headless-browser"]
}
```

### 2. Check Logs

You should see:
```
🚀 Starting Immowelt.at scrape...
🌐 Launching headless browser...
📄 Scraping category: Apartments for Sale
   ✓ Found __NEXT_DATA__ script tag
   ✓ Extracted 20 listings from __NEXT_DATA__
   ✓ Page 1: Found 20 listings
✅ Category complete: Apartments for Sale - 20 listings
```

## Common Issues

### Issue: "Browser not found"
```bash
npm run install:browsers
```

### Issue: "Connection timeout"
```env
# In .env file, increase timeout
TIMEOUT=60000
```

### Issue: "No listings found"
```env
# Run with visible browser to debug
HEADLESS=false
```

### Issue: "Cannot find module @landomo/core"
```bash
# Install shared components
cd ../../../shared-components
npm install
npm run build
cd -
npm install
```

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│          Express Server (index.ts)              │
│  - Health endpoint: GET /health                 │
│  - Scrape trigger: POST /scrape                 │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│      ListingsScraper (Playwright)               │
│  - Launch browser with stealth mode             │
│  - Extract __NEXT_DATA__ from pages             │
│  - Fallback to HTML parsing                     │
│  - Handle pagination                            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         ImmoweltTransformer                     │
│  - ImmoweltListing → StandardProperty           │
│  - Normalize Austrian/German fields             │
│  - Parse amenities from features                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│          IngestAdapter                          │
│  - Send batches to Ingest API                   │
│  - Handle retries and errors                    │
└─────────────────────────────────────────────────┘
```

## Key Features

### 1. Next.js Extraction
Immowelt.at uses Next.js, which embeds data in `__NEXT_DATA__`:
```javascript
// Extract structured JSON instead of parsing HTML
const nextData = document.getElementById('__NEXT_DATA__').textContent;
const listings = JSON.parse(nextData).props.pageProps.searchResults.items;
```

### 2. Stealth Mode
Anti-detection measures:
- Remove automation flags (`navigator.webdriver`)
- Realistic user agents
- Human-like delays (random 500-2000ms)
- Cookie consent handling
- Austrian locale (de-AT)

### 3. Error Resilience
- Automatic retries on failures
- HTML fallback if Next.js extraction fails
- Graceful degradation
- Detailed error logging

## Performance Metrics

| Metric | Value |
|--------|-------|
| Pages per second | ~0.5-1 |
| Listings per page | ~20 |
| Categories | 4 |
| Expected total time | ~10-20 minutes |
| Expected listings | ~1,000-5,000 |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8090 | Server port |
| `HEADLESS` | true | Run browser in headless mode |
| `TIMEOUT` | 30000 | Page load timeout (ms) |
| `MAX_RETRIES` | 3 | Retry attempts on failure |
| `RATE_LIMIT_DELAY` | 1000 | Delay between requests (ms) |
| `MAX_PAGES_PER_CATEGORY` | 999999 | Pages to scrape per category |

## Next Steps

1. **Test the scraper** with limited pages
2. **Verify data quality** in output
3. **Run full scrape** with all pages
4. **Monitor logs** for errors
5. **Integrate with scheduler** for automated runs

## Support

For issues or questions, refer to:
- Full documentation: `README.md`
- Type definitions: `src/types/immoweltTypes.ts`
- Research guide: `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`
