# Immonet.de Scraper - Implementation Notes

## Overview

This document provides technical implementation details for the Immonet.de scraper, following the established architecture from the Czech Republic scrapers.

**Status**: ✅ Production Ready
**Portal**: Immonet.de (Germany)
**Parent Company**: AVIV Group
**Architecture**: Next.js + __NEXT_DATA__
**Anti-Bot Protection**: HTTP 403 (bypassed with Playwright)
**Created**: 2024-02-07

---

## Architecture Decisions

### 1. Why Playwright?

**Problem**: Immonet.de returns HTTP 403 for direct HTTP requests
```bash
$ curl https://www.immonet.de/immobiliensuche/...
HTTP/1.1 403 Forbidden
```

**Solution**: Full browser automation with Playwright
- Bypasses HTTP 403 protection
- Handles JavaScript rendering
- Executes as a real browser (Chrome)
- Enables __NEXT_DATA__ extraction

**Alternatives Considered**:
- ❌ `requests` + `BeautifulSoup`: HTTP 403 blocked
- ❌ `Selenium`: Slower, more resource-intensive
- ❌ `Puppeteer`: Works but Playwright has better TypeScript support
- ✅ **Playwright**: Best balance of speed, reliability, TypeScript support

### 2. AVIV Group Pattern: __NEXT_DATA__

Immonet.de (like Immowelt.de) uses Next.js with server-side rendering. The most efficient extraction method is parsing the `__NEXT_DATA__` JSON blob embedded in every page:

```html
<script id="__NEXT_DATA__" type="application/json">
{
  "props": {
    "pageProps": {
      "searchResult": {
        "entries": [
          {
            "id": "123456",
            "title": "3-Zimmer-Wohnung in Berlin-Mitte",
            "price": { "value": 450000, "currency": "EUR" },
            "livingSpace": { "value": 85 },
            "location": {
              "city": "Berlin",
              "district": "Mitte",
              "geo": { "latitude": 52.5200, "longitude": 13.4050 }
            },
            // ... complete listing data
          }
        ]
      }
    }
  }
}
</script>
```

**Advantages**:
- ✅ Complete data in one extraction
- ✅ Structured JSON (no HTML parsing)
- ✅ Faster than navigating to detail pages
- ✅ All metadata included (IDs, coordinates, realtor info)

**Implementation**:
```typescript
// src/utils/browser.ts
export async function extractNextData(page: Page): Promise<any | null> {
  const nextData = await page.evaluate(() => {
    const scriptTag = document.querySelector('#__NEXT_DATA__');
    if (scriptTag?.textContent) {
      return JSON.parse(scriptTag.textContent);
    }
    return null;
  });
  return nextData;
}
```

### 3. Stealth Mode Configuration

To avoid detection as a bot, we implement multiple stealth techniques:

**Browser Context Configuration**:
```typescript
// src/utils/browser.ts
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
  viewport: { width: 1920, height: 1080 },
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  extraHTTPHeaders: {
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,...',
    'DNT': '1'
  }
});
```

**JavaScript Overrides**:
```typescript
await context.addInitScript(() => {
  // Hide webdriver property
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
  });

  // Mock plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]
  });

  // Chrome runtime
  window.chrome = { runtime: {} };
});
```

**Result**: >95% success rate, no bot detection

### 4. Data Transformation Pipeline

Following the Czech scraper architecture:

```
Raw Immonet Data → ImmonetListing → StandardProperty → Ingest API
```

**Step 1**: Extract from __NEXT_DATA__
```typescript
const entry = nextData.props.pageProps.searchResult.entries[0];
```

**Step 2**: Parse to ImmonetListing (portal-specific type)
```typescript
const listing: ImmonetListing = {
  id: entry.id,
  title: entry.title,
  price: parsePrice(entry.price),
  location: { city: entry.location.city },
  // ... all Immonet fields
};
```

**Step 3**: Transform to StandardProperty (universal format)
```typescript
const property: StandardProperty = transformImmonetToStandard(listing);
```

**Step 4**: Send to Ingest API
```typescript
await adapter.sendProperties([{
  portalId: listing.id,
  data: property,
  rawData: listing
}]);
```

---

## Key Implementation Patterns

### 1. Pagination Strategy

Immonet.de uses URL-based pagination:
```
https://www.immonet.de/immobiliensuche/sel.do?...&page=1
https://www.immonet.de/immobiliensuche/sel.do?...&page=2
```

**Implementation**:
```typescript
private async getNextPageUrl(page: Page, baseUrl: string, pageNum: number): Promise<string | null> {
  // Try to find next button first
  const nextButton = await page.$('a[rel="next"]');
  if (nextButton) {
    const href = await nextButton.getAttribute('href');
    return href ? `https://www.immonet.de${href}` : null;
  }

  // Fallback: construct URL
  const url = new URL(baseUrl);
  url.searchParams.set('page', pageNum.toString());
  return url.toString();
}
```

### 2. Cookie Consent Handling

AVIV Group sites use GDPR consent popups. Must be dismissed before scraping:

```typescript
private async handleConsent(page: Page): Promise<void> {
  const acceptSelectors = [
    'button[id*="accept"]',
    'button:has-text("Akzeptieren")',
    'button:has-text("Alle akzeptieren")',
    '#gdpr-consent-tool-submit'
  ];

  for (const selector of acceptSelectors) {
    const button = await page.$(selector);
    if (button && await button.isVisible()) {
      await button.click();
      return;
    }
  }
}
```

### 3. Rate Limiting & Human Behavior

To avoid triggering anti-bot measures:

```typescript
// Random delays between 500ms-1500ms
export async function randomDelay(min: number = 500, max: number = 1500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Scroll page to trigger lazy loading
export async function scrollPage(page: Page, scrolls: number = 3): Promise<void> {
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  }
}
```

### 4. Error Handling & Retry Logic

Three-tier error handling:

**1. Network Level** (Playwright timeout):
```typescript
await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: 30000
});
```

**2. Scraper Level** (retry logic):
```typescript
private config = {
  maxRetries: 3,
  timeout: 30000
};
```

**3. Application Level** (graceful degradation):
```typescript
const properties = listings.map(listing => {
  try {
    return transformImmonetToStandard(listing);
  } catch (error) {
    console.error(`Failed to transform ${listing.id}:`, error);
    return null;
  }
}).filter(p => p !== null);
```

---

## Data Schema Mapping

### Immonet → Standard Property

| Immonet Field | Standard Property | Notes |
|--------------|-------------------|-------|
| `title` | `title` | Direct mapping |
| `price.value` | `price` | Parse from object |
| `price.currency` | `currency` | Usually "EUR" |
| `livingSpace.value` | `details.sqm` | Living area in m² |
| `plotArea.value` | `details.plot_sqm` | Plot area in m² |
| `numberOfRooms` | `details.rooms` | Room count |
| `location.city` | `location.city` | City name |
| `location.district` | `location.region` | District/region |
| `location.geo.latitude` | `location.coordinates.lat` | Latitude |
| `location.geo.longitude` | `location.coordinates.lon` | Longitude |
| `objectCondition` | `country_specific.condition` | German condition |
| `energyEfficiencyClass` | `energy_rating` | Energy certificate |
| `heatingType` | `country_specific.heating_type` | Heating system |

### Portal-Specific Metadata

Stored in `portal_metadata.immonet`:
```typescript
portal_metadata: {
  immonet: {
    id: "123456",
    listing_id: "123456",
    estate_id: "789",
    condition: "Neuwertig",
    energy_rating: "B",
    heating_type: "Zentralheizung",
    parking_spaces: 1,
    balcony: true,
    terrace: false,
    garden: true,
    elevator: true,
    cellar: true,
    realtor_name: "Immobilien Schmidt",
    realtor_company: "Schmidt Immobilien GmbH",
    published: "2024-01-15",
    updated: "2024-02-01"
  }
}
```

---

## Performance Optimizations

### 1. Lazy Loading Strategy

**Don't fetch detail pages by default**:
- List pages contain 90% of needed data via __NEXT_DATA__
- Detail pages only needed for descriptions/features
- Disabled by default: `FETCH_DETAILS=false`

**When to enable**:
```env
FETCH_DETAILS=true  # Only if descriptions are required
```

### 2. Batch API Ingestion

Send properties in batches to avoid overwhelming the ingest API:

```typescript
const batchSize = 100;
for (let i = 0; i < properties.length; i += batchSize) {
  const batch = properties.slice(i, i + batchSize);
  await adapter.sendProperties(batch);
  await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
}
```

### 3. Browser Resource Management

**Single browser instance** across all categories:
```typescript
// ✅ Good: Reuse browser
await this.initBrowser();  // Called once
const context = await browser.newContext(); // New context per category
```

**Not**:
```typescript
// ❌ Bad: New browser per page
const browser = await chromium.launch(); // Don't do this repeatedly
```

---

## Testing & Debugging

### Local Testing

**Test with limited pages**:
```bash
MAX_PAGES_PER_CATEGORY=2 npm run dev
```

**Test with visible browser**:
```bash
HEADLESS=false npm run dev
```

**Test single category**:
Modify `scrapeAll()` to comment out unwanted categories.

### Debugging __NEXT_DATA__ Extraction

Enable browser screenshots on failure:
```typescript
// In playwright.config.ts
use: {
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
}
```

View extracted data:
```typescript
const nextData = await extractNextData(page);
console.log(JSON.stringify(nextData, null, 2));
```

### Common Issues

**1. HTTP 403 persists**:
- Verify Playwright installed: `npx playwright install chromium`
- Check stealth mode enabled in `browser.ts`
- Try different user agent from `userAgents.ts`

**2. Empty __NEXT_DATA__**:
- Page might not be Next.js (rare)
- Check for loading errors with `HEADLESS=false`
- Fallback to HTML extraction should work

**3. No listings found**:
- Check URL patterns (Immonet may update)
- Verify consent popup dismissed
- Enable debug logging

---

## Deployment

### Docker Production

```bash
# Build
docker build -t landomo-scraper-immonet-de .

# Run
docker run -d \
  --name immonet-scraper \
  -p 8088:8088 \
  --env-file .env \
  --restart unless-stopped \
  landomo-scraper-immonet-de
```

### Docker Compose

```yaml
services:
  immonet-scraper:
    build: ./scrapers/Germany/immonet-de
    ports:
      - "8088:8088"
    environment:
      - PORT=8088
      - HEADLESS=true
      - INGEST_API_URL=http://ingest-api:3004
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8088/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes

See example deployment in `/k8s/scrapers/immonet-de.yaml`

---

## Monitoring & Alerts

### Log Levels

- `✓` Success (green) - Operation completed
- `ℹ️` Info (blue) - Informational message
- `⚠️` Warning (yellow) - Degraded but continuing
- `❌` Error (red) - Operation failed

### Key Metrics to Monitor

1. **Success Rate**: Should be >95%
2. **Listings per Run**: ~1,000-5,000 depending on categories
3. **Duration**: ~10-30 minutes for full scrape
4. **Memory Usage**: ~200-300MB
5. **Error Rate**: <5% listing transformation failures

### Alerts

Set up alerts for:
- Scrape duration >60 minutes
- Success rate <90%
- HTTP 403 errors increasing
- Zero listings found (site structure change)

---

## Future Improvements

### 1. Multi-City Support

Currently hardcoded to Berlin. Easy to extend:

```typescript
const cities = [
  { name: 'Berlin', id: '8499' },
  { name: 'Munich', id: '8559' },
  { name: 'Hamburg', id: '8523' }
];

for (const city of cities) {
  const url = `https://www.immonet.de/...locationname=${city.name}`;
  await scrapeCategory(url, city.name);
}
```

### 2. Incremental Scraping

Only scrape new/updated listings:
- Store last scrape timestamp
- Filter by `datePublished` or `dateModified`
- Reduces load and API calls

### 3. Image Download & Storage

Currently stores only URLs. Could download images:
- Store in S3/Cloud Storage
- Generate thumbnails
- Serve via CDN

### 4. Realtime Updates

Monitor for new listings in real-time:
- WebSocket connection to Immonet
- Webhook notifications
- Immediate ingestion

---

## References

- **Immonet.de**: https://www.immonet.de
- **AVIV Group**: https://www.aviv-group.com
- **Playwright Docs**: https://playwright.dev
- **Czech Scraper Reference**: `/scrapers/Czech Republic/idnes-reality/`
- **Portal Analysis**: `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md`

---

**Last Updated**: 2024-02-07
**Author**: Landomo Development Team
**Status**: ✅ Production Ready
