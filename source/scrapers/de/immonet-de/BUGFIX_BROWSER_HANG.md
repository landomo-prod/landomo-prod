# Bug Fix: Browser Hang After Reinitialization

## Problem

The scraper hangs indefinitely after browser reinitialization between categories. Timeline:
1. First category completes successfully
2. Browser disconnects (line 415-418 detects this)
3. Browser reinitializes
4. Next category page 1 loads successfully
5. **HANGS** when trying to navigate to page 2

## Root Cause

Multiple issues compound to create the hang:

### 1. Page Object Invalidation
After browser reinitialization, the existing `page` object from the old context is still referenced in the pagination loop. When `page.goto()` is called on line 472, the page object is invalid/closed.

### 2. Silent Failures
The try-catch block (lines 468-489) catches errors but only logs and breaks. If the navigation fails silently, the loop just logs "waiting X.XXs" but never actually navigates.

### 3. Missing Navigation Timeout
The `page.goto()` uses `this.config.timeout` but doesn't handle the case where the navigation simply never resolves (infinite hang vs timeout).

### 4. Context Confusion
The check on line 415-418 reinitializes the *browser* but the *context* is created separately on line 423. If the browser was just reinitialized, the context might not be fully ready.

## Solution

### Option 1: Fresh Browser Per Category (Safest)

Close and recreate browser for each category instead of reusing. This ensures clean state.

**Changes needed in `listingsScraper.ts`:**

```typescript
private async scrapeCategory(
  url: string,
  category: string,
  maxPages: number = 10
): Promise<ImmonetListing[]> {
  const allListings: ImmonetListing[] = [];

  // Always start with fresh browser for each category
  await this.close(); // Close any existing browser
  await this.initBrowser();

  // Verify browser is ready
  if (!this.browser || !this.browser.isConnected()) {
    throw new Error('Failed to initialize browser');
  }

  // ... rest of method
```

**Pros:**
- Cleanest solution
- Prevents state issues
- Isolates each category

**Cons:**
- Slower (browser startup overhead per category)
- More resource intensive

### Option 2: Better Error Handling + Navigation Timeout (Recommended)

Keep current approach but add robust error handling and navigation timeouts.

**Changes needed in `listingsScraper.ts`:**

```typescript
// In pagination loop (around line 468):
try {
  // Rotate headers before each page request
  await rotateHeadersOnPage(page);

  // Check if page is still valid before navigating
  if (page.isClosed()) {
    console.log(`   ⚠️  Page closed, creating new page...`);
    page = await context.newPage();
    await rotateHeadersOnPage(page);
  }

  // Navigate with explicit timeout and better error handling
  console.log(`   🌐 Navigating to page ${currentPage + 1}...`);
  const navigationPromise = page.goto(nextPageUrl, {
    waitUntil: 'domcontentloaded',
    timeout: this.config.timeout
  });

  // Race navigation against timeout
  const result = await Promise.race([
    navigationPromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Navigation timeout')), this.config.timeout + 5000)
    )
  ]);

  await waitForNetworkIdle(page, this.config.timeout);
  await scrollPage(page, 3);

  currentPage++;
  const pageListings = await this.extractListingsFromPage(page);
  console.log(`   ✓ Page ${currentPage}: Found ${pageListings.length} listings`);

  if (pageListings.length === 0) {
    console.log(`   ℹ️  No listings on page ${currentPage}, stopping`);
    break;
  }

  allListings.push(...pageListings);
} catch (error: any) {
  console.error(`   ❌ Failed to navigate to page ${currentPage + 1}:`, error.message);

  // Try to recover once
  try {
    console.log(`   🔄 Attempting recovery...`);
    if (page && !page.isClosed()) {
      await page.close();
    }
    page = await context.newPage();
    await rotateHeadersOnPage(page);
    await page.goto(nextPageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout
    });
    console.log(`   ✓ Recovery successful, retrying page ${currentPage + 1}`);
    // Retry the extraction
    await waitForNetworkIdle(page, this.config.timeout);
    await scrollPage(page, 3);
    currentPage++;
    const pageListings = await this.extractListingsFromPage(page);
    console.log(`   ✓ Page ${currentPage}: Found ${pageListings.length} listings`);
    allListings.push(...pageListings);
  } catch (retryError: any) {
    console.error(`   ❌ Recovery failed:`, retryError.message);
    break;
  }
}
```

**Pros:**
- Faster than Option 1
- Handles transient errors
- One retry attempt

**Cons:**
- More complex code
- Still uses same browser/context

### Option 3: Watchdog Timer (Additional Safety)

Add a watchdog that detects hung scrapers and forcefully restarts.

**New utility function in `browser.ts`:**

```typescript
export async function withWatchdog<T>(
  promise: Promise<T>,
  timeoutMs: number,
  description: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Watchdog timeout: ${description} exceeded ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}
```

**Usage in scrapeCategory:**

```typescript
// Wrap entire pagination in watchdog (max 5 minutes per page)
const pageListings = await withWatchdog(
  this.extractListingsFromPage(page),
  300000, // 5 minutes
  `Extract page ${currentPage + 1}`
);
```

**Pros:**
- Safety net for any hang
- Easy to add
- Works with any solution

**Cons:**
- Doesn't prevent hang, just detects it
- Forceful timeout might leave browser in bad state

## Recommended Implementation

**Combine Option 1 + Option 3:**

1. Use fresh browser per category (Option 1) - safest, isolates issues
2. Add watchdog timer (Option 3) - catches any remaining hangs
3. Improve logging to track exact failure points

**Timeline:**
- Option 1: 30 minutes to implement and test
- Option 3: 15 minutes to implement
- Total: 45 minutes

## Testing Plan

1. **Test browser reinitialization:**
   - Set `MAX_PAGES_PER_CATEGORY=3` to trigger multiple category transitions quickly
   - Monitor for hangs

2. **Test error recovery:**
   - Kill browser process mid-scrape
   - Verify scraper recovers or fails gracefully

3. **Test full scrape:**
   - Run all 22 categories
   - Verify no hangs
   - Track total duration

4. **Stress test:**
   - Run 3 consecutive full scrapes
   - Check for memory leaks or degradation

## Priority

**CRITICAL** - Blocks production deployment

## Estimated Fix Time

- **Analysis:** ✅ Complete (30 minutes)
- **Implementation:** 45 minutes
- **Testing:** 30 minutes
- **Total:** ~1 hour 45 minutes

---

*Report created: 2026-02-09T16:58 UTC*
*Scraper hung at: 16:50 UTC (8 minutes into second category)*
