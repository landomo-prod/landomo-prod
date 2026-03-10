# Puppeteer Implementation for Reality.cz Scraper

## Overview

The Reality.cz scraper has been updated to use **Puppeteer** with a headless browser instead of the previous axios-only approach. This enables JavaScript rendering, which is required because Reality.cz dynamically loads listing content via JavaScript.

## Key Changes

### 1. **New Browser Pool Manager** (`src/utils/browserPool.ts`)

A dedicated browser pool manager handles Puppeteer lifecycle and concurrent page management:

**Features:**
- Single browser instance with concurrent page management
- Configurable max concurrent pages (default: 2)
- Queue-based waiting for available pages
- Automatic resource cleanup
- Error handling with retry logic
- Navigation timeout management

**Configuration via .env:**
```env
PUPPETEER_HEADLESS=true           # Run in headless mode
BROWSER_TIMEOUT=30000             # Timeout in milliseconds
MAX_CONCURRENT_PAGES=2            # Concurrent page limit (2-3 recommended)
```

### 2. **Updated Listings Scraper** (`src/scrapers/listingsScraper.ts`)

Major changes to the scraping mechanism:

**Before:**
```typescript
const response = await this.client.get(url);
const $ = cheerio.load(response.data);
```

**After:**
```typescript
const page = await browserPool.getPage();
await browserPool.navigateWithRetry(page, url, 3, 'networkidle2');
const content = await browserPool.getPageContent(page);
const $ = cheerio.load(content);
await browserPool.releasePage(page);
```

**Key improvements:**
- JavaScript rendering via Puppeteer
- Automatic retry logic with exponential backoff
- Proper resource management with try/finally
- Network idle waiting for complete content loading
- Cheerio still used for HTML parsing (no changes needed to selectors)

### 3. **Lifecycle Management**

New methods in `ListingsScraper`:
- `async initialize()` - Starts the browser pool
- `async shutdown()` - Closes all pages and browser

**Usage pattern:**
```typescript
const scraper = new ListingsScraper();
try {
  await scraper.initialize();
  const listings = await scraper.scrapeSales();
  // ...
} finally {
  await scraper.shutdown();
}
```

## Configuration

### .env Settings

```env
# Server Configuration
PORT=8086

# Ingest API Configuration
INGEST_API_URL=http://localhost:3004
INGEST_API_KEY_REALITY=dev_key_czech_reality

# Puppeteer / Browser Configuration
PUPPETEER_HEADLESS=true           # true for headless, false for debug
BROWSER_TIMEOUT=30000             # Navigation timeout in ms
MAX_CONCURRENT_PAGES=2            # 2-3 recommended for stability
FETCH_DETAILS=false               # Whether to fetch detail pages
```

### Key Configuration Notes

**MAX_CONCURRENT_PAGES:**
- Default: 2 (stable and conservative)
- Range: 1-4
- Each page consumes ~100MB RAM
- Increase only if you have sufficient memory
- Too many pages may cause crashes

**BROWSER_TIMEOUT:**
- Default: 30000ms (30 seconds)
- Increase if you have slow internet or server is under load
- Each page navigation waits for this timeout

**PUPPETEER_HEADLESS:**
- Default: true (no visual window)
- Set to false for debugging (requires display server)

## Dependencies

Added to `package.json`:
```json
"puppeteer": "^21.6.0"
```

Install with:
```bash
npm install
```

This will automatically download Chromium binary (~100-300MB).

## Performance Expectations

### Timing per Page

- First page: 5-8 seconds (browser startup)
- Subsequent pages: 3-5 seconds each
- Pagination delay: 1500ms between requests

### Memory Usage

- Browser instance: ~80-100MB
- Per page: ~100-150MB
- Total with MAX_CONCURRENT_PAGES=2: ~350-500MB

### Rate Limiting

Built-in delays:
- Between pages: 1500ms (configurable via `config.delay_ms`)
- Between batches (sent to API): 500ms
- Between detail page fetches: 500-1000ms random

## Error Handling

### Automatic Retry Logic

Navigation failures trigger automatic retries:
```typescript
await browserPool.navigateWithRetry(page, url, 3, 'networkidle2');
```

- Max 3 attempts by default
- Exponential backoff: 2s, 4s, 8s between retries
- Final error contains all attempt details

### Graceful Degradation

- Failed page navigations don't crash the scraper
- Skipped pages are logged and tracked
- 3 consecutive empty pages stop pagination
- Process continues with next property type

## Testing

### Run Test Suite

```bash
npm run build
npx ts-node src/test-puppeteer.ts
```

### Test Coverage

1. **Browser Pool Initialization** - Verifies browser startup
2. **Single Page Fetch** - Tests apartment listings scraping
3. **HTML Parsing** - Confirms cheerio still works correctly
4. **Resource Cleanup** - Verifies page/browser closure

### Expected Output

```
============================================
  Reality.cz Puppeteer Integration Tests
============================================

Test 1: Browser Pool Initialization
-----------------------------------
Status: { initialized: true, activePages: 0, ... }
✅ Browser pool initialized

Test 2: Single Page Fetch
------------------------
Testing apartments (byty) for sale...
Found 25 listings
✅ Successfully scraped listings

Test 3: Browser Pool Status
---------------------------
Status: { initialized: true, activePages: 0, ... }
✅ Browser pool status checked

Test 4: Cleanup
---------------
Final status: { initialized: false, ... }
✅ Cleanup completed
```

## Monitoring & Debugging

### Enable Debug Output

```bash
DEBUG=puppeteer:* npm start
```

### Check Browser Pool Status

```typescript
const status = browserPool.getStatus();
console.log(status);
// {
//   initialized: true,
//   activePages: 1,
//   totalPages: 2,
//   maxConcurrent: 2,
//   queueLength: 0
// }
```

### Common Issues

**Issue: "No listings found"**
- Selectors may have changed on website
- JavaScript may not have fully rendered
- Try increasing BROWSER_TIMEOUT or using `waitUntil: 'domcontentloaded'`

**Issue: "Browser crashed"**
- Running out of memory (reduce MAX_CONCURRENT_PAGES)
- Network timeout (increase BROWSER_TIMEOUT)
- Check system RAM with `free -h` or `top`

**Issue: "Navigation timeout"**
- Website is slow (increase BROWSER_TIMEOUT)
- Network issues (check connectivity)
- Website blocking bots (add delays, rotate user agents)

## Migration from axios

### What Changed

| Aspect | Before | After |
|--------|--------|-------|
| HTTP Client | axios | Puppeteer |
| Rendering | No JavaScript | Full JS execution |
| Page Load | Static HTML only | Dynamic content loaded |
| Timeout | 30s HTTP timeout | 30s navigation timeout |
| Retries | Manual in scrapePage | Built-in with backoff |
| Resource Cleanup | Automatic (axios) | Manual (must call shutdown) |

### What Stayed the Same

- ✅ All cheerio selectors remain unchanged
- ✅ Field extraction logic unchanged
- ✅ Data transformation pipeline unchanged
- ✅ API ingest format unchanged
- ✅ Error handling patterns similar

## File Structure

```
src/
├── utils/
│   └── browserPool.ts          # NEW - Browser pool manager
├── scrapers/
│   └── listingsScraper.ts      # UPDATED - Uses Puppeteer
├── index.ts                    # UPDATED - Better cleanup
├── adapters/
├── transformers/
├── types/
└── test-puppeteer.ts           # NEW - Test suite
```

## Next Steps / Future Improvements

1. **Proxy Support** - Add proxy rotation for large-scale scraping
2. **Screenshot Debugging** - Capture screenshots on errors
3. **Request Interception** - Block images/CSS to speed up loading
4. **Execution Context** - Run JavaScript directly on page for data extraction
5. **Session Persistence** - Cache login sessions across scrapes
6. **Performance Metrics** - Track timing per page type
7. **Health Checks** - Periodic browser restart to prevent memory leaks

## References

- [Puppeteer Documentation](https://pptr.dev/)
- [Browser Pool Pattern](https://pptr.dev/#?product=Puppeteer&version=main&show=api-class-BrowserContext)
- [Navigation Waiting](https://pptr.dev/#?product=Puppeteer&version=main&show=api-pagenav)
- [Cheerio Documentation](https://cheerio.js.org/)

## Support

For issues or questions:
1. Check the error messages in console output
2. Review the BROWSER_TIMEOUT and MAX_CONCURRENT_PAGES settings
3. Test with `npm run build && npx ts-node src/test-puppeteer.ts`
4. Check system resources (memory, CPU)
5. Verify Reality.cz website is accessible
