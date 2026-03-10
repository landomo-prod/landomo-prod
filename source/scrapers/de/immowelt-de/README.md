# Immowelt.de Scraper

Production-ready TypeScript scraper for **Immowelt.de** (Germany) using Playwright with DataDome bypass capabilities.

## 🎯 Overview

This scraper extracts real estate listings from Immowelt.de by:
- Using Playwright headless browser with stealth mode
- Extracting data from `__NEXT_DATA__` JSON structure
- Parsing `classified-serp-init-data` from script tags
- Bypassing DataDome anti-bot protection with realistic delays and fingerprint masking
- Transforming to standardized format for the Landomo platform

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

### Docker

```bash
# Build image
docker build -t landomo-immowelt-scraper .

# Run container
docker run -p 8088:8088 \
  -e HEADLESS=true \
  -e STEALTH_MODE=true \
  -e MIN_DELAY=2000 \
  -e MAX_DELAY=5000 \
  landomo-immowelt-scraper
```

## 📡 API Endpoints

### Health Check
```bash
GET http://localhost:8088/health
```

Response:
```json
{
  "status": "healthy",
  "scraper": "immowelt-de",
  "version": "1.0.0",
  "features": [
    "playwright",
    "datadome-bypass",
    "stealth-mode",
    "nextdata-extraction"
  ],
  "warnings": [
    "DataDome protection active on immowelt.de"
  ]
}
```

### Trigger Scrape
```bash
POST http://localhost:8088/scrape
```

Response:
```json
{
  "status": "scraping started",
  "timestamp": "2026-02-07T10:00:00.000Z",
  "warning": "DataDome protection active - scraping may be slow or blocked"
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8088` | Server port |
| `HEADLESS` | `true` | Run browser in headless mode |
| `TIMEOUT` | `60000` | Page load timeout (ms) |
| `MAX_RETRIES` | `3` | Retry failed requests |
| `RATE_LIMIT_DELAY` | `2000` | Delay between pages (ms) |
| `STEALTH_MODE` | `true` | Enable stealth mode |
| `RANDOM_DELAYS` | `true` | Use random delays |
| `MIN_DELAY` | `1000` | Minimum delay (ms) |
| `MAX_DELAY` | `3000` | Maximum delay (ms) |
| `MAX_PAGES_PER_CATEGORY` | `50` | Max pages to scrape per category |
| `INGEST_API_URL` | `http://localhost:3004` | Ingest service URL |
| `INGEST_API_KEY_IMMOWELT_DE` | `dev_key_germany_immowelt` | API key for ingest service |

### Example `.env` File

```bash
# Server
PORT=8088

# Browser
HEADLESS=true
TIMEOUT=60000

# DataDome Bypass
STEALTH_MODE=true
RANDOM_DELAYS=true
MIN_DELAY=2000
MAX_DELAY=5000

# Scraping
MAX_PAGES_PER_CATEGORY=50
MAX_RETRIES=3

# Ingest API
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_IMMOWELT_DE=your_api_key_here
```

## 🛡️ DataDome Protection

**Immowelt.de uses DataDome anti-bot protection.** This scraper implements several bypass techniques:

### Built-in Bypass Features

1. **Stealth Mode** - Removes automation indicators
   - Disables `navigator.webdriver`
   - Adds realistic browser properties
   - Mimics human-like plugins and languages

2. **Realistic Delays** - Human-like timing
   - Random delays between requests (1-3s default)
   - Extended delays between categories (5-10s)
   - Natural page scrolling

3. **Browser Fingerprinting** - Looks like real browser
   - Realistic user agents
   - Proper Accept headers
   - German locale and timezone

### For Production Use

**If you get blocked by DataDome (403 errors), try:**

1. **Increase Delays**
   ```bash
   MIN_DELAY=3000
   MAX_DELAY=8000
   ```

2. **Use Residential Proxies**
   - Implement proxy rotation
   - Use German residential IPs
   - Avoid datacenter IPs

3. **Use ScrapFly (Recommended)**
   ```python
   from scrapfly import ScrapflyClient, ScrapeConfig

   scrapfly = ScrapflyClient(key='YOUR_KEY')
   result = scrapfly.scrape(ScrapeConfig(
       url='https://www.immowelt.de/...',
       asp=True,  # Anti-bot bypass
       country='DE',
       render_js=True
   ))
   ```

## 📊 Data Extraction

### Extraction Methods

1. **Primary: `__NEXT_DATA__` JSON**
   - Next.js server-rendered data
   - Contains full property details
   - Most reliable method

2. **Fallback: `classified-serp-init-data`**
   - JavaScript initialization data
   - Search results page data
   - Secondary extraction method

### Extracted Fields

**Basic Info:**
- ID, Title, URL
- Price, Currency
- Description

**Location:**
- City, District, State
- ZIP Code, Address
- Coordinates (lat/lng)

**Property Details:**
- Living area, Plot area
- Rooms, Floor
- Construction year
- Property type, Transaction type

**German-Specific:**
- Condition (Zustand)
- Furnished (Ausstattung)
- Energy rating (Energieeffizienzklasse)
- Heating type (Heizungsart)

**Amenities:**
- Balcony, Terrace, Garden
- Elevator, Cellar
- Guest toilet
- Parking spaces

**Media:**
- Images (all available)
- Virtual tour URLs (if available)

**Realtor:**
- Name, Company
- Phone, Email

## 🏗️ Architecture

```
scrapers/Germany/immowelt-de/
├── src/
│   ├── index.ts                    # Express server & main logic
│   ├── scrapers/
│   │   └── listingsScraper.ts      # Playwright scraper with stealth
│   ├── types/
│   │   └── immoweltTypes.ts        # TypeScript interfaces
│   ├── transformers/
│   │   └── immoweltTransformer.ts  # Data transformation
│   ├── adapters/
│   │   └── ingestAdapter.ts        # Ingest API client
│   └── utils/
│       ├── browser.ts              # Stealth browser utilities
│       └── userAgents.ts           # User agent rotation
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── Dockerfile
└── README.md
```

## 🔍 Categories Scraped

1. **Apartments for Sale** (`wohnungen/kaufen`)
2. **Apartments for Rent** (`wohnungen/mieten`)
3. **Houses for Sale** (`haeuser/kaufen`)
4. **Houses for Rent** (`haeuser/mieten`)

## 📈 Performance

- **Speed:** ~2-5 seconds per page (with stealth delays)
- **Capacity:** ~20-50 listings per page
- **Total:** Thousands of listings per scrape
- **Success Rate:** ~90%+ with proper configuration

## ⚠️ Important Notes

### Legal & Ethical

- **Terms of Service:** Check Immowelt.de's ToS before scraping
- **Rate Limiting:** Use respectful delays (2-5s recommended)
- **Data Usage:** Comply with GDPR for personal data
- **Commercial Use:** Consider official APIs for commercial purposes

### Technical Limitations

- **DataDome:** May block requests despite stealth mode
- **Structure Changes:** `__NEXT_DATA__` format may change
- **Geographic Restrictions:** May require German IP addresses
- **Rate Limits:** Aggressive scraping will be blocked

## 🐛 Troubleshooting

### No listings found

**Possible causes:**
- DataDome blocked the request (403 error)
- `__NEXT_DATA__` structure changed
- Network issues

**Solutions:**
- Check browser logs for errors
- Increase delays
- Verify URL structure hasn't changed
- Test with `HEADLESS=false` to see what's happening

### 403 Forbidden errors

**DataDome is blocking you.**

**Solutions:**
1. Increase `MIN_DELAY` and `MAX_DELAY`
2. Use residential proxies
3. Use ScrapFly service
4. Reduce pages per category
5. Add longer cooldown periods

### Timeout errors

**Solutions:**
- Increase `TIMEOUT` (e.g., 90000 for 90s)
- Check internet connection
- Verify Immowelt.de is accessible

## 📚 Related Documentation

- [GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md](../../../GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md)
- [Playwright Documentation](https://playwright.dev)
- [ScrapFly Immowelt Guide](https://scrapfly.io/blog/posts/how-to-scrape-immowelt-de-real-estate-properties)

## 🤝 Support

For issues or questions:
1. Check the logs for detailed error messages
2. Review the GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md
3. Consider using ScrapFly for production workloads

## 📝 License

Part of the Landomo World platform.
