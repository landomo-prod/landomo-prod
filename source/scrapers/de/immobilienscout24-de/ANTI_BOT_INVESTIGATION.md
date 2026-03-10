# ImmobilienScout24-DE Anti-Bot Investigation

## Problem
The immobilienscout24-de scraper is blocked by anti-bot detection, showing "Ich bin kein Roboter" (I am not a robot) page and finding 0 listings.

## Investigation Results

### 1. Current Implementation (Playwright)
**File:** `src/scrapers/listingsScraper.ts`
**Status:** ❌ Blocked

```
Page title: Ich bin kein Roboter - ImmobilienScout24
Error: "Du bist ein Mensch aus Fleisch und Blut? Entschuldige bitte, dann hat unser System dich fälschlicherweise als Roboter identifiziert."
```

### 2. API Approach
**File:** `src/utils/fetchData.ts` (already exists!)
**Status:** ❌ Requires OAuth

Tested multiple API endpoints:
- `https://api.immobilienscout24.de/api/psa/is24/properties/search` → 404 Not Found
- `https://www.immobilienscout24.de/Suche/de/deutschland/wohnung-mieten` → 401 Unauthorized
- `https://rest.immobilienscout24.de/restapi/api/search/v1.0/search` → 401 Unauthorized

**Conclusion:** API requires OAuth authentication (similar to Austrian version)

### 3. Puppeteer with Stealth Plugin
**File:** `src/scrapers/listingsScraper-v2.ts` (created)
**Status:** ❌ Still blocked

Implemented:
- `puppeteer-extra` with `puppeteer-extra-plugin-stealth`
- Realistic user agents
- Anti-detection browser args
- Random delays

**Result:** Still triggers "Ich bin kein Roboter" page

### 4. Detection Mechanisms

ImmobilienScout24 uses sophisticated anti-bot detection:

**Browser Fingerprinting:**
- Detects Puppeteer/Playwright automation traces
- Analyzes TLS fingerprints
- Monitors JavaScript environment properties
- Tracks mouse/keyboard patterns

**Behavioral Analysis:**
- Request timing patterns
- Navigation patterns
- Cookie/session consistency

## Solution Options

### Option A: Cloudflare Bypass Service (Recommended)
**Time:** 1-2 hours
**Reliability:** ⭐⭐⭐⭐⭐

**Pros:**
- Project already has cloudflare-bypass infrastructure
- Proven to work (Zillow POC successful)
- Handles cookies, sessions, TLS fingerprints properly
- Production-ready
- Sustainable long-term

**Cons:**
- Requires integration work
- Additional service dependency

**Implementation:**
1. Study `cloudflare-bypass/examples/zillow_scraper_quickstart.py`
2. Adapt for TypeScript/Node.js integration
3. Create bypass client in scraper
4. Use acquired cookies/session for requests
5. Test and verify

**Files to Reference:**
- `cloudflare-bypass/README.md`
- `cloudflare-bypass/IMPLEMENTATION_GUIDE.md`
- `cloudflare-bypass/examples/zillow_scraper_quickstart.py`
- `docs/CLOUDFLARE_BYPASS_TYPESCRIPT_INTEGRATION.md` (if exists)

### Option B: curl-impersonate
**Time:** 30-60 min
**Reliability:** ⭐⭐⭐

**Pros:**
- Mimics real browser TLS fingerprints
- Simpler than full bypass service
- No additional services needed

**Cons:**
- May still be detected
- Cookie extraction needed
- Less reliable than Option A

**Implementation:**
1. Install curl-impersonate in Docker
2. Make initial request to get cookies
3. Use cookies in subsequent scraping
4. Handle cookie refresh

### Option C: Manual Cookie Injection (Quick Fix)
**Time:** 15-30 min
**Reliability:** ⭐

**Pros:**
- Fastest to implement
- Good for testing/POC

**Cons:**
- Cookies expire (not sustainable)
- Manual intervention required periodically
- Not production-ready

**Implementation:**
1. Manually browse to immobilienscout24.de
2. Extract cookies from browser DevTools
3. Inject into Puppeteer via `page.setCookie()`
4. Test scraping

## Recommendation

**Use Option A: Cloudflare Bypass Service**

**Rationale:**
1. Project already invested in cloudflare-bypass infrastructure
2. Most reliable and sustainable solution
3. Handles all detection vectors properly
4. Proven to work with similar protections
5. Production-ready

**Next Steps:**
1. Review cloudflare-bypass documentation
2. Create TypeScript/Node.js integration layer
3. Implement bypass client in scraper
4. Test with real requests
5. Verify 50+ listings found
6. Rebuild Docker container
7. Deploy and monitor

## Test Results

### Test 1: Playwright (Original)
```bash
npm run dev
# Result: 0 listings, "Ich bin kein Roboter" page
```

### Test 2: API Discovery
```bash
npx ts-node test-api-v2.ts
# Result: All endpoints 401/404
```

### Test 3: Puppeteer Stealth
```bash
npx ts-node test-stealth.ts
# Result: 0 listings, "Ich bin kein Roboter" page
```

### Test 4: Page Structure Analysis
```bash
npx ts-node test-page-structure.ts
# Result: Confirmed anti-bot protection active
# Title: "Ich bin kein Roboter - ImmobilienScout24"
```

## Files Created/Modified

### Modified
- `package.json` - Added puppeteer-extra dependencies
- `src/index.ts` - Updated to use ListingsScraperV2

### Created
- `src/scrapers/listingsScraper-v2.ts` - Puppeteer with stealth plugin
- `test-api.ts` - API endpoint testing
- `test-api-v2.ts` - Extended API discovery
- `test-stealth.ts` - Stealth scraper testing
- `test-page-structure.ts` - Page analysis
- `test-headful.ts` - Visual debugging
- `page-snapshot.html` - Captured anti-bot page
- `ANTI_BOT_INVESTIGATION.md` - This document

## Related Documentation

- `/docs/SCRAPER_MAINTENANCE_BEST_PRACTICES.md`
- `/docs/COMMON_SCRAPER_ISSUES.md`
- `/docs/CLOUDFLARE_BYPASS_TYPESCRIPT_INTEGRATION.md` (if exists)
- `/cloudflare-bypass/README.md`
- `/cloudflare-bypass/IMPLEMENTATION_GUIDE.md`
- `/CLAUDE.md` - Section on Cloudflare protection

## Estimated Effort

| Option | Time | Complexity | Reliability | Sustainability |
|--------|------|------------|-------------|----------------|
| A: Bypass Service | 1-2h | Medium | Excellent | Excellent |
| B: curl-impersonate | 30-60m | Low | Good | Good |
| C: Manual Cookies | 15-30m | Very Low | Poor | Poor |

**Recommended:** Option A - Cloudflare Bypass Service
