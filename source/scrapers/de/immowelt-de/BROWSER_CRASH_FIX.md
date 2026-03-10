# Immowelt-de Browser Crash Fix

## Problem Summary

The immowelt-de scraper was experiencing "Target page, context or browser has been closed" errors, resulting in 0 listings being found. The browser context was crashing prematurely during scraping operations.

## Root Causes Identified

1. **Timeout Too Short**: Browser launch timeout was 30s (default), but operations needed 60s
2. **Context Lifecycle Issues**: Context closing before page operations completed
3. **Missing Error Handling**: No checks for closed pages before page.evaluate() calls
4. **Improper Cleanup Order**: Context closing before page in error scenarios
5. **No Retry on Critical Errors**: Navigation failures causing cascading failures

## Fixes Applied

### 1. Increased Timeouts (browser.ts)

**File**: `src/utils/browser.ts`

**Changes**:
- Browser launch timeout: 30s → 60s (line 21)
- Navigation timeout: 30s → 60s (line 93)

**Rationale**: DataDome checks and LZ-String decompression can take time, 30s was insufficient

### 2. Added Page State Checks (browser.ts)

**File**: `src/utils/browser.ts`

**Changes in `navigateWithRetry()`**:
- Added `page.isClosed()` check before navigation
- Early exit on "closed" or "detached" errors (no retry on fatal errors)

**Rationale**: Don't retry if browser/page is gone - fail fast

### 3. Enhanced Error Handling (listingsScraper-ufrn.ts)

**File**: `src/scrapers/listingsScraper-ufrn.ts`

**Changes in `extractUFRNData()`**:
- Added `page.isClosed()` check before evaluation
- Wrapped `page.evaluate()` in `.catch()` for immediate error handling
- Better error messages distinguishing page closure from data issues

**Changes in `extractListingsFromPage()`**:
- Added page closure check at start
- Wrapped `waitForLoadState()` in try-catch (timeout is non-fatal)
- Better error logging for closed/detached errors

### 4. Fixed Context Lifecycle (listingsScraper-ufrn.ts)

**File**: `src/scrapers/listingsScraper-ufrn.ts`

**Changes in `scrapeCategory()`**:

**BEFORE (Broken)**:
```typescript
const context = await createStealthContext(this.browser!);
try {
  const page = await context.newPage();
  // ... scraping ...
  await page.close();
} finally {
  await context.close(); // Context closed even if page operations failed
}
```

**AFTER (Fixed)**:
```typescript
let context = null;
let page = null;
try {
  context = await createStealthContext(this.browser!);
  page = await context.newPage();
  // ... scraping with proper error handling ...
} finally {
  // Proper cleanup order: page first, then context
  if (page && !page.isClosed()) {
    await page.close();
  }
  if (context) {
    await context.close();
  }
}
```

**Key improvements**:
- Variables declared outside try block for finally access
- Page closed before context (correct order)
- Check `page.isClosed()` before attempting close
- Wrapped each close in try-catch to prevent cascading failures
- Added logging for successful cleanup

### 5. Enhanced Navigation Error Handling

**Changes in `scrapeCategory()`**:
- Wrapped `page.goto()` in try-catch with explicit error thrown
- Added page closure check in pagination loop
- Wrapped all `page.evaluate()` calls in try-catch
- Added retry-safe error handling for selector queries

### 6. DataDome Detection Improvements

**Changes**:
- Wrapped DataDome check in try-catch (evaluation can fail)
- Return empty array instead of closing context early on detection
- Better warning messages

## Testing

### Test Script Created

**File**: `test-browser-crash.ts`

**What it tests**:
1. Browser initialization
2. Full scraping cycle (1 page only)
3. Browser lifecycle (open → scrape → close)
4. Error detection and reporting

**How to run**:
```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Germany/immowelt-de
npx ts-node test-browser-crash.ts
```

### Expected Outcomes

**BEFORE Fix**:
- ❌ Error: "Target page, context or browser has been closed"
- ❌ 0 listings found
- ❌ Browser crashes mid-operation

**AFTER Fix**:
- ✅ No browser crash errors
- ✅ Listings found (should be > 0)
- ✅ Clean shutdown

## Configuration Updates

### Environment Variables (recommended)

```bash
HEADLESS=true
TIMEOUT=60000          # Increased from 30000
MAX_RETRIES=3
RATE_LIMIT_DELAY=2000
STEALTH_MODE=true
RANDOM_DELAYS=true
MIN_DELAY=1000
MAX_DELAY=3000
MAX_PAGES_PER_CATEGORY=50
```

## Docker Testing

### Build and Test

```bash
cd /Users/samuelseidel/Development/landomo-world/scrapers/Germany/immowelt-de

# Build image
docker build -t landomo/scraper-immowelt-de:latest .

# Run test
docker run --rm \
  -e HEADLESS=true \
  -e TIMEOUT=60000 \
  -e MAX_PAGES_PER_CATEGORY=1 \
  landomo/scraper-immowelt-de:latest \
  npx ts-node test-browser-crash.ts

# Check health
docker run --rm -p 8088:8088 landomo/scraper-immowelt-de:latest &
sleep 5
curl http://localhost:8088/health
```

### Expected Health Response

```json
{
  "status": "healthy",
  "scraper": "immowelt-de",
  "version": "1.0.0",
  "features": [
    "playwright",
    "datadome-bypass",
    "stealth-mode",
    "nextdata-extraction",
    "headless-browser"
  ],
  "warnings": [
    "DataDome protection active on immowelt.de",
    "Use stealth mode and realistic delays",
    "Consider residential proxies for production"
  ]
}
```

## Code Quality Improvements

### Error Handling Pattern

**BEFORE**:
```typescript
const data = await page.evaluate(() => { ... });
// No error handling - crashes on closed page
```

**AFTER**:
```typescript
if (page.isClosed()) {
  console.error('Page is closed');
  return null;
}
const data = await page.evaluate(() => { ... })
  .catch(err => {
    console.error('Evaluation failed:', err);
    return null;
  });
```

### Cleanup Pattern

**BEFORE**:
```typescript
try {
  // operations
} finally {
  await context.close(); // Can fail and hide original error
}
```

**AFTER**:
```typescript
try {
  // operations
} finally {
  if (page && !page.isClosed()) {
    try { await page.close(); } catch (e) { /* log */ }
  }
  if (context) {
    try { await context.close(); } catch (e) { /* log */ }
  }
}
```

## Known Limitations

1. **DataDome Protection**: Still active, may block requests if delays too short
2. **Rate Limiting**: Still needed - use realistic delays
3. **Proxy Recommendation**: Residential proxies recommended for production
4. **ScrapFly Alternative**: Consider ScrapFly for high-volume scraping

## Monitoring

### Success Indicators

- ✅ No "closed" or "detached" errors in logs
- ✅ Listings count > 0
- ✅ "Browser closed" log message at end
- ✅ "Page closed" and "Context closed" in category logs

### Failure Indicators

- ❌ "Page is closed before extraction"
- ❌ "Browser context crashed"
- ❌ "Target page, context or browser has been closed"
- ❌ Listings count = 0 with no DataDome warning

## Verification Checklist

- [x] Timeout increased to 60s
- [x] Page closure checks added
- [x] Error handling around page.evaluate()
- [x] Proper cleanup order (page → context)
- [x] Navigation retry logic improved
- [x] DataDome check error handling
- [x] Test script created
- [x] Documentation updated

## Next Steps

1. **Run test script**: `npx ts-node test-browser-crash.ts`
2. **Rebuild Docker image**: `docker build -t landomo/scraper-immowelt-de:latest .`
3. **Test in Docker**: Run container and trigger scrape
4. **Monitor logs**: Check for clean execution
5. **Update task**: Mark task #2 as complete

## Related Files

- `src/utils/browser.ts` - Browser lifecycle management
- `src/scrapers/listingsScraper-ufrn.ts` - Main scraper logic
- `src/index.ts` - Entry point
- `test-browser-crash.ts` - Verification test
- `BROWSER_CRASH_FIX.md` - This document

## Support

If issues persist:
1. Check browser logs: Look for DataDome challenges
2. Increase delays: MIN_DELAY=2000, MAX_DELAY=5000
3. Use proxies: Set HTTP_PROXY environment variable
4. Contact: Check DataDome bypass documentation
