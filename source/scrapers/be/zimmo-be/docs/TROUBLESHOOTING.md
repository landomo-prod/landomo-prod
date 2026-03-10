# Troubleshooting

> Common issues and their solutions for the Zimmo scraper

## Connection Issues

### Redis Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
REDIS_HOST=redis  # Use service name in Docker
redis-cli ping    # Verify locally
```

### Ingest API Connection Failed

```bash
# Verify API key
echo $INGEST_API_KEY
curl -H "Authorization: Bearer $INGEST_API_KEY" http://localhost:3004/health
```

## Performance Issues

### Slow Scraping (>20 minutes)

**Diagnosis:**
```bash
curl http://localhost:8211/health | jq '.queue'
```

**Possible causes:**
1. Low worker count: increase `WORKER_CONCURRENCY` (default 30)
2. Rate limiting: check logs for 429 errors
3. Pages returning only HTML card IDs (no embedded JSON) -- triggers more detail fetches

### Empty Results for Category

**Cause:** Zimmo may have changed HTML structure or URL patterns.

**Solution:**
1. Check URL manually: `https://www.zimmo.be/nl/te-koop/appartement/?pagina=1`
2. Verify `__NEXT_DATA__` script tag still exists
3. Check `data-property-id` attribute is still present in HTML cards

## Data Quality Issues

### Missing Property Details

**Cause:** If `__NEXT_DATA__` extraction fails, the scraper falls back to HTML card parsing which only provides the listing ID. Full details require a separate detail fetch.

**Solution:** Check detail page extraction is working:
```bash
# Test detail fetch
curl -s "https://www.zimmo.be/en/property/12345" | grep "__NEXT_DATA__"
```

### Duplicate Listings

**Cause:** Zimmo may return the same listings across pages (like Slovak portals).

**Solution:** Already handled -- `seenIds` Set deduplicates within each scrape run.

## Rate Limiting

Zimmo has moderate rate limiting. The scraper uses:
- 500-1500ms delay between page fetches within a batch
- 1500ms delay between page batches
- 500-1500ms jitter on detail worker jobs

If encountering 429 errors, reduce `WORKER_CONCURRENCY` to 15 and increase delays.

## Diagnostic Commands

```bash
# Real-time logs
docker logs -f be-zimmo

# Queue state
curl http://localhost:8211/health | jq

# Redis queue inspection
redis-cli LLEN bull:zimmo-details:wait
redis-cli LLEN bull:zimmo-details:active
redis-cli LLEN bull:zimmo-details:completed
redis-cli LLEN bull:zimmo-details:failed
```
