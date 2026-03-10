# Immodirekt-AT URL Reference Guide

## Quick Reference: Correct URLs

### ✅ Working URLs (Use These)

```
Apartments for Rent:  https://www.immodirekt.at/mietwohnungen/oesterreich
Apartments for Sale:  https://www.immodirekt.at/eigentumswohnungen/oesterreich
Houses for Rent:      https://www.immodirekt.at/haeuser-mieten/oesterreich
Houses for Sale:      https://www.immodirekt.at/haeuser-kaufen/oesterreich
```

### ❌ Invalid URLs (404 - Do NOT Use)

```
❌ https://www.immodirekt.at/miethauser/oesterreich
❌ https://www.immodirekt.at/hauser/oesterreich
❌ https://www.immodirekt.at/hauser-mieten/oesterreich
❌ https://www.immodirekt.at/hauser-kaufen/oesterreich
❌ https://www.immodirekt.at/kaufen/wohnung
```

## Available Listings by Category

| Category | URL | Total Listings |
|----------|-----|----------------|
| Apartments for Sale | `/eigentumswohnungen/oesterreich` | 34,661 |
| Apartments for Rent | `/mietwohnungen/oesterreich` | 10,125 |
| Houses for Sale | `/haeuser-kaufen/oesterreich` | 11,087 |
| Houses for Rent | `/haeuser-mieten/oesterreich` | 758 |
| **TOTAL** | | **56,631** |

## Pagination

All URLs support pagination via query parameter:
```
Page 1: https://www.immodirekt.at/[category]/oesterreich
Page 2: https://www.immodirekt.at/[category]/oesterreich?pagenumber=2
Page 3: https://www.immodirekt.at/[category]/oesterreich?pagenumber=3
...
```

**Listings per page:** 25

## German Terminology

| German Term | English | URL Segment |
|-------------|---------|-------------|
| Mietwohnungen | Apartments for Rent | mietwohnungen |
| Eigentumswohnungen | Apartments for Sale (Ownership) | eigentumswohnungen |
| Häuser kaufen | Houses for Sale (to buy) | haeuser-kaufen |
| Häuser mieten | Houses for Rent (to rent) | haeuser-mieten |

**Note:** German "ä" is written as "ae" in URLs (häuser → haeuser)

## Extraction Method

The site uses obfuscated CSS classes, so DOM selectors won't work reliably.

**✅ Correct Method:** Extract from JavaScript state
```typescript
const data = await page.evaluate(() => {
  const state = window.__INITIAL_STATE__;
  return state.properties.hits; // Array of listings
});

const total = await page.evaluate(() => {
  const state = window.__INITIAL_STATE__;
  return state.properties.totalHits; // Total count
});
```

**❌ Wrong Method:** DOM selectors (unreliable due to obfuscation)
```typescript
// Don't use this:
const listings = await page.$$('.listing-card');
```

## Testing URLs

To verify a URL is working:

```bash
# Check HTTP status
curl -I https://www.immodirekt.at/[category]/oesterreich

# 200 OK = Working ✅
# 404 Not Found = Invalid URL ❌
```

Or use the verification script:
```bash
npx ts-node verify-house-urls.ts
```

## Common Mistakes

1. **Using `/miethauser/` instead of `/haeuser-mieten/`**
   - ❌ `/miethauser/oesterreich` → 404
   - ✅ `/haeuser-mieten/oesterreich` → 200 OK

2. **Using `/hauser/` without the umlaut equivalent**
   - ❌ `/hauser/oesterreich` → 404
   - ✅ `/haeuser-kaufen/oesterreich` → 200 OK

3. **Using old sale URLs**
   - ❌ `/kaufen/wohnung` → 404
   - ✅ `/eigentumswohnungen/oesterreich` → 200 OK

## Production Configuration

The scraper is configured in:
```
/src/scrapers/listingsScraper.ts
Lines 313-339
```

Current production URLs are **correct** and **verified working**.

---

**Last Verified:** 2026-02-07
**Total Listings Available:** 56,631
**Test Status:** ✅ All 4 categories passing
