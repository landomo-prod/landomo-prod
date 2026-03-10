# Troubleshooting

> Common issues and their solutions for the Realo BE scraper

## Anti-Bot / 403 Errors

### Symptom

Empty results from all search paths, or 403 errors in logs.

### Cause

Realo has heavy anti-bot protection. Simple HTTP requests may be blocked.

### Solution

1. **Check if portal is accessible**: Test manually in browser
2. **For production**: Deploy with Puppeteer stealth plugin
3. **Priority note**: Realo data overlaps significantly with Immoweb and Zimmo. If those scrapers are working, Realo adds limited incremental value.

## Connection Issues

### Redis / Ingest API

Same as other Belgium scrapers. Use `REDIS_HOST=redis` in Docker, verify API key.

## Performance Issues

### Slow Scraping

**Diagnosis:**
```bash
curl http://localhost:8214/health | jq '.queue'
```

**Causes:**
1. Anti-bot blocking most search pages
2. Apollo state extraction is more complex than Next.js
3. HTML card fallback produces minimal data

## Data Quality Issues

### Missing Fields from Apollo State

Apollo GraphQL cache entries may have different key patterns depending on the query. If properties are not being extracted:

1. Check if Apollo state keys still start with `Property:` or `Listing:`
2. Test: fetch a search page manually and check for `__APOLLO_STATE__` in `<script>` tags
3. The extraction function `extractPropertiesFromApolloState` may need updated key prefixes

### Multilingual Condition Values

Realo serves content in Dutch, French, and English. The condition mapper handles all three:
- Dutch: `nieuw`, `goed`, `uitstekend`, `gerenoveerd`, `te renoveren`
- French: `neuf`, `bon`, `excellent`
- English: `new`, `good`, `excellent`, `to renovate`

If new condition values appear, add them to `mapCondition()` in the apartment transformer.

## Rate Limiting

Realo uses 200-500ms delays between requests with a 200-page safety limit. If encountering errors:
1. Reduce `WORKER_CONCURRENCY` to 25
2. Check logs for 429 responses

## Diagnostic Commands

```bash
docker logs -f be-realo
curl http://localhost:8214/health | jq
redis-cli LLEN bull:realo-be-details:wait
redis-cli LLEN bull:realo-be-details:failed
```
