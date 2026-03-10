# Troubleshooting

> Common issues and their solutions for the Immotop.lu scraper

## HTML Scraping Issues

### `__NEXT_DATA__` Not Found

**Symptom**: Phase 1 finds 0 listings for all categories

**Cause**: Immotop changed their Next.js page structure or added SSR protection

**Solution**:

1. Test manually:
```bash
curl -s 'https://www.immotop.lu/en/search/buy/apartment?page=1' | grep '__NEXT_DATA__'
```

2. If `__NEXT_DATA__` is missing, the cheerio HTML fallback should activate. Check if HTML card selectors match:
```bash
curl -s 'https://www.immotop.lu/en/search/buy/apartment?page=1' | grep -o 'property-card\|listing-card\|article class'
```

3. If both fail, the site may have added bot protection. Consider adding Puppeteer.

### Wrong URL Patterns

**Symptom**: HTTP 404 for all search pages

**Cause**: Immotop changed their URL structure

**Solution**:

1. Visit `https://www.immotop.lu` manually and inspect search URLs
2. Update `SEARCH_CONFIGS` in `src/utils/fetchData.ts`
3. Current patterns:
```
/en/search/buy/apartment
/en/search/rent/apartment
/en/search/buy/house
/en/search/rent/house
/en/search/buy/land
/en/search/buy/office
/en/search/rent/office
```

### Detail Page Structure Changed

**Symptom**: Listings processed but with missing fields (0 bedrooms, 0 sqm)

**Cause**: `__NEXT_DATA__` property names changed or HTML selectors no longer match

**Solution**:

1. Fetch a detail page and inspect `__NEXT_DATA__`:
```bash
curl -s 'https://www.immotop.lu/en/property/12345' | \
  grep -oP '(?<=<script id="__NEXT_DATA__" type="application/json">).*?(?=</script>)' | \
  jq '.props.pageProps'
```

2. Check which key holds the property data (`property`, `listing`, or other)
3. Update `fetchListingDetail()` in `src/utils/fetchData.ts`

### Feature Detection Missing

**Symptom**: All boolean features (has_elevator, has_parking, etc.) are false

**Cause**: Feature keywords don't match the language used on the page

**Solution**:

The scraper uses multilingual regex patterns (English, French). Check actual feature strings:
```bash
# From __NEXT_DATA__
curl -s 'https://www.immotop.lu/en/property/12345' | \
  grep -oP '__NEXT_DATA__.*?</script>' | \
  jq '.props.pageProps.property.features'
```

Add additional keywords to the regex patterns in `fetchListingDetail()` if needed.

## Connection Issues

### Redis Connection Failed

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**:

1. Check Redis is running: `redis-cli ping`
2. In Docker, use service name: `REDIS_HOST=redis-lu`

### Ingest API Connection Failed

**Symptom**: `AxiosError: Request failed with status code 401`

**Solution**:

1. Check ingest service: `curl http://localhost:3018/api/v1/health`
2. Verify `INGEST_API_KEY` matches ingest service configuration

## Performance Issues

### Slow Scraping (>30 minutes)

**Symptom**: Scrape takes much longer than expected 10-20 minutes

**Possible Causes**:

1. **Rate limiting**: Immotop may be throttling requests
   - Check logs for timeouts or slow responses
   - Default delays (300-800ms per detail, 500-1000ms per page) should be sufficient

2. **Too many new listings on first run**: First scrape has no checksums, so all listings are fetched
   - Expected: first run takes 2-3x longer
   - Subsequent runs should be much faster

3. **Worker count too low**:
```bash
WORKER_CONCURRENCY=30  # Increase from default 20
```

## Data Quality Issues

### Listing IDs Not Stable

**Symptom**: Same listings get different IDs across scrape runs

**Cause**: Immotop may use slugs or temporary IDs in HTML

**Solution**: The scraper attempts to extract numeric IDs from URLs (`/(\d+)/` regex). If URLs change format, update the ID extraction in `parseHtmlListingCard()`.

### Coordinate Data Missing

**Symptom**: No latitude/longitude for listings

**Cause**: Immotop may not expose coordinates in `__NEXT_DATA__` or HTML

**Solution**: This is a known limitation. Coordinates depend on what Immotop includes in their Next.js page props. The `parseNextDataListing()` function checks multiple possible field names: `latitude`, `lat`, `coordinates.lat`.

## Diagnostic Commands

```bash
# Real-time logs
docker logs -f lu-immotop

# Check queue state
curl http://localhost:8231/health | jq

# Test search page
curl -s -o /dev/null -w "%{http_code}" 'https://www.immotop.lu/en/search/buy/apartment?page=1'

# Trigger scrape
curl -X POST http://localhost:8231/scrape

# Check DB results
docker exec landomo-lu-postgres psql -U landomo -d landomo_lu -c \
  "SELECT source_platform, property_category, COUNT(*) FROM properties_new WHERE source_platform='immotop' GROUP BY source_platform, property_category;"
```
