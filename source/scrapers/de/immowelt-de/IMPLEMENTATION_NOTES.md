# Immowelt.de Scraper - Implementation Notes

## Recent Changes (February 2026)

### Issue: Site Architecture Changed
Immowelt.de migrated from Next.js to a custom React framework. The data is no longer available in `__NEXT_DATA__` on search pages, but instead in a compressed format in `window.__UFRN_FETCHER__.data`.

### Solution Implemented: URL Extraction Method

Instead of trying to parse the compressed data, we implemented a two-step approach:

#### Step 1: Extract Listing URLs from Search Pages
- Extract all listing URLs using DOM selector: `a[href*="/expose/"]`
- Typically finds ~60 listing URLs per search page
- Fast and reliable (< 10 seconds per page)

#### Step 2: Scrape Individual Detail Pages
- Visit each detail page individually
- Try to extract data from `__NEXT_DATA__` first (detail pages may still use it)
- Fall back to HTML DOM extraction if `__NEXT_DATA__` is not available
- Apply rate limiting between requests to avoid DataDome blocks

### Key Implementation Details

#### Modified Files
1. **`/src/scrapers/listingsScraper.ts`**
   - Added `extractListingUrls()` - Extract URLs from search page DOM
   - Added `extractDetailPageData()` - Extract data from detail pages (tries `__NEXT_DATA__` first, then HTML fallback)
   - Updated `extractListingsFromPage()` - Now uses two-step URL extraction + detail page scraping
   - Updated `scrapeListingDetails()` - Uses new extraction method

#### Configuration
- **`MAX_LISTINGS_PER_PAGE`** (default: 60): Maximum number of detail pages to scrape per search page
  - Set lower for testing (e.g., 3)
  - Set to 60+ for production

- **Rate Limiting**: Critical to avoid DataDome blocks
  - `MIN_DELAY`: 2000ms (default)
  - `MAX_DELAY`: 5000ms (default)
  - For production: Use 3000-8000ms delays

### Performance

#### Expected Speed
- **URL Extraction**: ~60 URLs in 5-10 seconds
- **Detail Page Scraping**: 0.5-1 listing/second (with rate limiting)
- **Total per page**: ~1-2 minutes for 60 listings

#### Comparison
- **Old Method** (Next.js data): ~60 listings in 10-15 seconds
- **New Method** (URL extraction): ~60 listings in 60-120 seconds

The new method is slower but more reliable given the site changes.

### Testing

#### Quick Test (3 listings)
```bash
# Set test configuration
export MAX_LISTINGS_PER_PAGE=3
export HEADLESS=false

# Run test
npm run build && node dist/test-fixed-scraper.js
```

#### Full Test (60 listings)
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and set:
# MAX_LISTINGS_PER_PAGE=60

# Run scraper
npm start
```

### Alternative Approach (Not Implemented)

An alternative would be to decode the compressed data in `window.__UFRN_FETCHER__.data`. This data appears to be:
- JSON compressed/encoded in some format
- Contains all listing data for the search page
- Would be faster if decoded successfully

However, this approach:
- Requires reverse engineering the compression/encoding
- May break easily if the format changes
- The URL extraction method is simpler and more maintainable

### DataDome Protection

Immowelt.de uses DataDome anti-bot protection. To avoid blocks:

1. **Use Stealth Mode** (enabled by default)
   - Removes automation flags
   - Randomizes user agents
   - Uses realistic browser headers

2. **Rate Limiting** (critical)
   - Never scrape faster than 0.5-1 listing/second
   - Use random delays between requests
   - Take breaks between categories

3. **Residential Proxies** (recommended for production)
   - Rotate IP addresses
   - Use German IPs when possible
   - Consider using ScrapFly or similar services

### Debugging

#### Check if DataDome is Blocking
```javascript
const isBlocked = await page.evaluate(() => {
  return document.body.textContent?.includes('DataDome') ||
         document.body.textContent?.includes('Access denied') ||
         document.querySelector('[id*="datadome"]') !== null;
});
```

#### Inspect __UFRN_FETCHER__ Data
```javascript
const ufrnData = await page.evaluate(() => {
  return (window as any).__UFRN_FETCHER__;
});
console.log('UFRN Data:', JSON.stringify(ufrnData, null, 2));
```

#### View Detail Page Structure
Run with `HEADLESS=false` to see the pages being scraped.

### Future Improvements

1. **Parallel Processing**: Scrape multiple detail pages in parallel (with rate limiting)
2. **Decode __UFRN_FETCHER__**: If compression format is identified
3. **Proxy Rotation**: Integrate residential proxy service
4. **Resume Capability**: Save progress and resume interrupted scrapes
5. **Enhanced Error Handling**: Better detection and recovery from blocks

### Maintenance Notes

- Monitor for changes to DOM selectors (`a[href*="/expose/"]`)
- Check if detail pages still have `__NEXT_DATA__` (currently using HTML fallback)
- Adjust rate limits based on block frequency
- Update HTML extraction selectors if page structure changes
