# Implementation Notes - Immowelt.at Scraper

## Technical Overview

### Technology Stack
- **Runtime**: Node.js + TypeScript
- **Browser Automation**: Playwright (Chromium)
- **Server**: Express.js
- **HTTP Client**: Axios
- **Type System**: Full TypeScript with @landomo/core types

### Architecture Pattern
Follows the established Czech scraper architecture from `/scrapers/Czech Republic/idnes-reality/`:
- Modular separation of concerns
- Type-safe data flow
- Express server for trigger endpoints
- Playwright for browser automation
- Standardized transformation layer

## Key Implementation Details

### 1. Next.js Data Extraction

Immowelt.at is built with Next.js, which provides a major advantage:

```typescript
// Extract from __NEXT_DATA__ script tag (preferred method)
const nextData = await page.evaluate(() => {
  const scriptTag = document.getElementById('__NEXT_DATA__');
  return JSON.parse(scriptTag.textContent);
});

// Navigate the Next.js data structure
const listings = nextData?.props?.pageProps?.searchResults?.items || [];
```

**Benefits:**
- Clean, structured JSON data
- No HTML parsing required
- All data in one request
- Faster and more reliable

**Data Structure:**
```json
{
  "props": {
    "pageProps": {
      "searchResults": {
        "items": [
          {
            "id": "12345",
            "title": "...",
            "price": { "value": 450000 },
            "location": { "city": "Wien" },
            "area": { "livingArea": 75 }
          }
        ],
        "totalCount": 1234
      }
    }
  }
}
```

### 2. HTML Fallback Strategy

If `__NEXT_DATA__` is unavailable (unlikely), fallback to HTML extraction:

```typescript
private async extractListingsFromHTML(page: Page): Promise<ImmoweltListing[]> {
  return await page.evaluate(() => {
    const selectors = [
      '[data-testid="property-card"]',
      '.property-card',
      'article[data-test*="property"]'
    ];
    // Extract from DOM elements
  });
}
```

### 3. Anti-Detection Measures

**Browser Stealth:**
```typescript
await context.addInitScript(() => {
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
  });

  // Mock plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]
  });

  // Set correct languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['de-AT', 'de', 'en']
  });
});
```

**Headers:**
```typescript
extraHTTPHeaders: {
  'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-User': '?1',
  'Sec-Fetch-Dest': 'document'
}
```

**Human-like Behavior:**
- Random delays: 500-2000ms between actions
- Scroll simulation for lazy-loaded content
- Cookie consent acceptance
- Realistic viewport size (1920x1080)

### 4. Cookie Consent Handling

Austrian/German sites typically use GDPR consent banners:

```typescript
async function handleCookieConsent(page: Page): Promise<void> {
  const consentSelectors = [
    'button[data-testid="uc-accept-all-button"]',
    'button:has-text("Akzeptieren")',
    'button:has-text("Alle akzeptieren")',
    '#didomi-notice-agree-button'
  ];

  // Try each selector until one works
  for (const selector of consentSelectors) {
    const button = await page.$(selector);
    if (button) {
      await button.click();
      return;
    }
  }
}
```

### 5. Data Transformation

**Austrian/German Specifics:**
```typescript
// Normalize German text to standard values
function normalizeCondition(condition?: string): string {
  'neu' → 'new'
  'saniert' → 'after_renovation'
  'gepflegt' → 'good'
  'modernisiert' → 'very_good'
}

function normalizeHeatingType(heating?: string): string {
  'Fernwärme' → 'central_heating'
  'Gas' → 'gas_heating'
  'Wärmepumpe' → 'heat_pump'
}

function normalizeEnergyRating(rating?: string): string {
  Extract A-G from various formats
  'A+' → 'a'
  'Klasse B' → 'b'
}
```

**Amenities Parsing:**
```typescript
// Parse from German feature strings
'Parkplatz' → has_parking: true
'Balkon' → has_balcony: true
'Aufzug' → has_elevator: true
'Barrierefrei' → is_barrier_free: true
```

### 6. Error Handling

**Network Retries:**
```typescript
async function navigateWithRetry(page, url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      return;
    } catch (error) {
      if (i < maxRetries - 1) {
        await sleep(2000 * (i + 1)); // Exponential backoff
      }
    }
  }
  throw new Error('Navigation failed');
}
```

**Graceful Degradation:**
```typescript
try {
  // Try Next.js extraction
  const nextData = await extractNextData(page);
  if (nextData) return parseNextData(nextData);
} catch (error) {
  // Fall back to HTML
  return extractFromHTML(page);
}
```

### 7. Performance Optimizations

**Batch Processing:**
```typescript
// Send data in batches to avoid overwhelming API
const batchSize = 100;
for (let i = 0; i < properties.length; i += batchSize) {
  const batch = properties.slice(i, i + batchSize);
  await adapter.sendProperties(batch);
  await sleep(500); // Small delay between batches
}
```

**Memory Management:**
```typescript
// Close context after each category to free memory
async scrapeCategory(url) {
  const page = await this.context!.newPage();
  try {
    // Scrape...
  } finally {
    await page.close(); // Always close
  }
}
```

## Differences from Czech Scraper

### Similar:
- Express server architecture
- Playwright browser automation
- Type-safe transformations
- Ingest API adapter
- GDPR/cookie handling

### Different:
- **Next.js extraction** instead of just HTML parsing
- **Austrian-specific** field normalization (German language)
- **Different URL patterns** (immowelt.at vs reality.idnes.cz)
- **Energy rating format** (A-G vs Czech system)
- **Currency** (EUR vs CZK)

## Testing Strategy

### Unit Tests (Future)
```typescript
describe('ImmoweltTransformer', () => {
  it('should transform Austrian apartment listing', () => {
    const input: ImmoweltListing = { /* ... */ };
    const output = transformImmoweltToStandard(input);
    expect(output.currency).toBe('EUR');
    expect(output.location.country).toBe('Austria');
  });
});
```

### Integration Tests
```bash
# Test with 1 page per category
MAX_PAGES_PER_CATEGORY=1 npm run dev

# Verify output structure
# Check logs for extraction success
# Validate transformed data
```

### Smoke Test
```bash
# Quick health check
curl http://localhost:8090/health

# Trigger scrape
curl -X POST http://localhost:8090/scrape

# Check logs for errors
```

## Deployment Checklist

- [ ] Install dependencies: `npm install`
- [ ] Install browsers: `npm run install:browsers`
- [ ] Configure `.env` file
- [ ] Test with limited pages
- [ ] Verify data quality
- [ ] Build: `npm run build`
- [ ] Start server: `npm start`
- [ ] Monitor logs
- [ ] Check Ingest API receives data

## Known Limitations

1. **JavaScript Required**: Cannot scrape with simple HTTP client
2. **Rate Limiting**: Must maintain delays to avoid blocking
3. **Dynamic Content**: Page structure may change with Next.js updates
4. **Pagination**: Relies on URL parameters (may change)
5. **No API**: No official API available, browser automation only

## Maintenance

### When Immowelt.at Updates

**If __NEXT_DATA__ structure changes:**
1. Update `parseListingFromNextData()` method
2. Add new field mappings
3. Test with current data

**If HTML selectors change:**
1. Update `extractListingsFromHTML()` selectors
2. Test fallback extraction
3. Update documentation

**If cookie consent changes:**
1. Add new selectors to `handleCookieConsent()`
2. Test consent flow
3. Verify scraping continues

### Monitoring

**Key Metrics:**
- Listings found per page
- Extraction success rate (Next.js vs HTML)
- Transformation errors
- Ingest API success rate
- Average scrape duration

**Error Patterns:**
- Consistent "No listings found" → selectors outdated
- Timeout errors → increase TIMEOUT value
- 403 errors → add delays, check user agent
- Consent issues → update consent selectors

## References

### Documentation
- `/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md` - Research findings
- Czech scraper: `/scrapers/Czech Republic/idnes-reality/`
- Shared types: `/shared-components/dist/types/property.d.ts`

### External Resources
- [ScrapFly Immowelt Guide](https://scrapfly.io/blog/posts/how-to-scrape-immowelt-de-real-estate-properties)
- [Playwright Anti-Detection](https://playwright.dev/docs/test-use-options#basic-options)
- [Next.js Data Fetching](https://nextjs.org/docs/basic-features/data-fetching)

### Decompiled App
Location: `/apk-downloader/decompiled_all/immowelt  Real Estate`
- Contains mobile API endpoints
- Future: Could implement direct API calls instead of browser scraping
- Package: `de.immowelt.android.immobiliensuche`

## Future Enhancements

### Phase 1: Stability
- [ ] Add comprehensive error logging
- [ ] Implement retry queues for failed items
- [ ] Add data validation before sending to API
- [ ] Screenshot capture on errors

### Phase 2: Performance
- [ ] Parallel category scraping
- [ ] Connection pooling for API calls
- [ ] Incremental scraping (only new/updated)
- [ ] Caching of property details

### Phase 3: Features
- [ ] Detail page scraping for complete data
- [ ] Mobile API integration (from decompiled app)
- [ ] Proxy rotation support
- [ ] Distributed scraping support
- [ ] Real-time monitoring dashboard

### Phase 4: Scale
- [ ] Kubernetes deployment
- [ ] Auto-scaling based on workload
- [ ] Multi-region deployment
- [ ] Data quality metrics
- [ ] Alert system integration

## Contact & Support

For technical issues or questions:
1. Check logs for error details
2. Review this documentation
3. Test with visible browser (`HEADLESS=false`)
4. Contact Landomo development team

---

**Last Updated:** February 7, 2026
**Author:** Claude Code (Anthropic)
**Version:** 1.0.0
