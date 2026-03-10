# UlovDomov.cz API Investigation Results

**Date**: February 13, 2026
**Status**: API Currently Failing ❌ | HTML Fallback Available ✅

## Summary

The UlovDomov REST API (`https://ud.api.ulovdomov.cz/v1`) is returning 500 errors for all endpoints. However, the website loads successfully and displays listings via server-side rendering, providing a viable HTML scraping alternative.

---

## API Investigation

### Tested Endpoints

1. **Count Endpoint**: `POST /v1/offer/count`
2. **Find Endpoint**: `POST /v1/offer/find`

### Test Results

| Test | User Agent | Headers | Result |
|------|-----------|---------|--------|
| Basic Request | Default axios | Standard | 500 Error |
| Chrome UA | Chrome 144 | Standard | 500 Error |
| Firefox UA | Firefox 133 | Standard | 500 Error |
| Full Browser Headers | Chrome 144 | Origin, Referer, Sec-Fetch-* | 500 Error |
| Different Payload | All | Empty filters, RENT, SALE | 500 Error |

### API Response

```json
{
  "error": "udBe.internalServerError",
  "success": false,
  "data": null
}
```

**Status Code**: 500 Internal Server Error
**Consistent**: Yes - all requests fail identically

### Observations

1. **Browser Network Tab**: Shows 200 responses when visiting the site
2. **Scraper/curl**: Always returns 500 errors
3. **Headers**: No difference between browser and curl headers
4. **Timing**: Issue started recently (scraper was built expecting this API)

### Possible Causes

1. **API Authentication**: Might require cookies or session tokens
2. **Rate Limiting**: IP-based blocking or DDoS protection
3. **API Deprecation**: API may have been shut down or moved
4. **Server Issue**: Temporary backend problem
5. **CORS/Security**: Request origin validation (though CORS headers allow *)

---

## Alternative: HTML Scraping Method

### ✅ Working Approach

The website renders listings server-side in the HTML, making them scrapable without API access.

### Data Sources

#### 1. Listings Page
**URL**: `https://www.ulovdomov.cz/pronajem/byty`

**Available Data**:
- Listing ID (from URL: `/inzerat/{slug}/{id}`)
- Title: "Pronájem bytu 2+1 60 m2"
- Price: "17 000 Kč"
- Location: "Pardubice - Polabiny, Bělehradská"
- Size: 60 m2
- Disposition: 2+1
- Features: Balkón, Sklep, etc.
- Image URLs

**Pagination**: "Načíst další" (Load more) button with infinite scroll

#### 2. Detail Pages
**URL**: `https://www.ulovdomov.cz/inzerat/{slug}/{id}`

**Data Source**: `window.__NEXT_DATA__.props.pageProps.listingsFlatRent[0]`

**Available Fields** (from earlier investigation):
```javascript
{
  id: 5574930,
  title: "Pronájem bytu 3+1 60 m2",
  area: 60,
  description: "...",
  disposition: "3+1",
  houseType: {...},
  geoCoordinates: { lat: 50.xxx, lng: 15.xxx },
  photos: [...],
  rentalPrice: { value: 17000, currency: "CZK" },
  isNoCommission: false,
  depositPrice: {...},
  monthlyFeesPrice: {...},
  published: "2024-02-10",
  street: {...},
  village: {...},
  villagePart: {...},
  convenience: [...],
  houseConvenience: [...],
  floorLevel: 7,
  offerType: "RENT",
  propertyType: "FLAT"
}
```

---

## Recommended Implementation

### Approach 1: Hybrid (Recommended)

1. **Scrape listing URLs** from HTML pages (`/pronajem/byty`, `/pronajem/domy`, etc.)
2. **Extract full data** from `window.__NEXT_DATA__` on detail pages
3. **Fallback**: If `__NEXT_DATA__` unavailable, parse HTML tables

**Pros**:
- Complete data access
- Robust against API changes
- Can extract all 3,579 listings

**Cons**:
- Requires browser automation (Puppeteer/Playwright)
- Slower than direct API
- ~3,579 page requests for full scrape

### Approach 2: Listings Page Only

1. Scrape all data directly from listings grid pages
2. Paginate through "Load more" or URL pagination

**Pros**:
- Faster (fewer requests)
- Can use simple HTTP + Cheerio

**Cons**:
- Limited data (no full description, agent info, etc.)
- Might miss some fields

### Approach 3: Wait for API Fix

Monitor the API and retry periodically.

**Pros**:
- Existing code works as-is
- Fastest scraping method

**Cons**:
- No ETA on fix
- Might not be fixed at all

---

## Implementation Plan

### Phase 1: Quick Fix (HTML Scraping)

```typescript
// 1. Fetch listings page
const listingUrls = await scrapeListingUrls('https://www.ulovdomov.cz/pronajem/byty');

// 2. For each URL, extract data
for (const url of listingUrls) {
  const listing = await extractFromNextData(url);
  // or const listing = await parseHTML(url);
}
```

### Phase 2: Browser Automation

- Use Puppeteer/Playwright for JavaScript-rendered content
- Extract `window.__NEXT_DATA__` directly
- Handle infinite scroll pagination
- Implement user agent rotation

### Phase 3: API Monitoring

- Set up cron job to test API endpoints
- Auto-switch to API if it becomes available
- Keep HTML fallback for resilience

---

## User Agent Rotation (Suggested by User)

While user agent rotation didn't fix the API issue, it's still recommended for HTML scraping:

```javascript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/144.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/144.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'
];

// Rotate on each request
const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
```

---

## Next Steps

1. ✅ **Immediate**: Implement HTML scraping with Puppeteer
2. ⏳ **Monitor**: Check API status weekly
3. 🔄 **Optimize**: Add user agent rotation and rate limiting
4. 📊 **Test**: Verify data quality matches API format

---

## Files to Update

- `src/scrapers/listingsScraper.ts` - Switch from API to HTML
- `src/transformers/ulovdomovTransformer.ts` - Handle HTML data format
- `package.json` - Add puppeteer/playwright dependency
- `Dockerfile` - Add browser dependencies

---

## Conclusion

While the API is currently unavailable, **UlovDomov remains scrapable** via HTML extraction. The website provides all necessary data in both the listings grid and detail pages, with the added benefit of `window.__NEXT_DATA__` containing structured JSON.

**Recommendation**: Implement HTML scraping with `window.__NEXT_DATA__` extraction as the primary method, keeping the API code dormant for future use if the API is restored.
