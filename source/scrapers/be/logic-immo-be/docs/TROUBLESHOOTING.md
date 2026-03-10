# Troubleshooting

> Common issues and their solutions for the Logic-Immo BE scraper

## Connection Issues

### Redis / Ingest API

Same as other Belgium scrapers. Use `REDIS_HOST=redis` in Docker, verify API key.

## Performance Issues

### Slow Scraping (>25 minutes)

**Diagnosis:**
```bash
curl http://localhost:8213/health | jq '.queue'
```

**Causes:**
1. All 7 search paths running sequentially within p-limit(3)
2. HTML card fallback mode produces listings with only IDs -- more detail fetches needed
3. Page limit of 200 pages hit for large categories

### Hit Page Limit Warning

```
Hit page limit -- category: apartment
```

**Cause:** A category has more than 200 pages of results. This is a safety limit to prevent infinite loops.

**Solution:** This is expected for large categories. Increase the limit in `fetchData.ts` if needed, but verify pagination is actually terminating.

## Data Quality Issues

### Missing Fields from HTML Fallback

When `__NEXT_DATA__` and JSON-LD both fail, the HTML card parser extracts limited data:
- ID from `data-listing-id` attribute
- Price from `[class*="price"]` text
- Surface from `[class*="surface"]` text
- City from `[class*="location"]` text

All other fields (bedrooms, features, coordinates) will be missing and must come from detail page fetch.

### Incorrect Category Assignment

**Cause:** Category is determined by search URL path, not listing content.

**Solution:** Verify search paths in `SEARCH_PATHS` array in `fetchData.ts`.

## Rate Limiting

Logic-Immo has moderate rate limiting. The scraper uses 200-500ms delays between page requests. If encountering 429 errors:

1. The scraper automatically waits for Retry-After duration
2. Reduce concurrency: `WORKER_CONCURRENCY=25`
3. Pages within the same path retry automatically

## Cheerio Parsing Changes

Logic-Immo may update their HTML structure. If parsing breaks:

1. Check if `__NEXT_DATA__` script ID has changed
2. Check if JSON-LD schema types have changed
3. Update CSS selectors in `parseListingsFromHTML`:
   - `[data-listing-id]` for listing cards
   - `.price` or `[class*="price"]` for prices
   - `[class*="surface"]` for area

## Diagnostic Commands

```bash
docker logs -f be-logic-immo
curl http://localhost:8213/health | jq
redis-cli LLEN bull:logic-immo-be-details:wait
redis-cli LLEN bull:logic-immo-be-details:failed
```
