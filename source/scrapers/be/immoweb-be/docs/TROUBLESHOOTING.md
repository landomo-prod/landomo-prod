# Troubleshooting

> Common issues and their solutions for the Immoweb scraper

## Cloudflare 403 Errors

### Symptom

```
Cloudflare blocked -- Immoweb search requires Puppeteer/stealth plugin. Returning empty results.
```

### Cause

Immoweb uses Cloudflare WAF which blocks automated HTTP requests to search pages.

### Solution

1. **For development/testing**: The scraper logs warnings and returns empty results gracefully. No crash.

2. **For production**: Deploy with Puppeteer stealth plugin:
```bash
# Add to package.json
"puppeteer": "^21.0.0",
"puppeteer-extra": "^3.3.6",
"puppeteer-extra-plugin-stealth": "^2.11.2"
```

3. **Temporary workaround**: If search API is intermittently accessible, increase retry count:
```bash
# Retry with longer delays
CONCURRENT_PAGES=2  # Reduce concurrency
```

## Connection Issues

### Redis Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Docker: use service name
REDIS_HOST=redis

# Local: check Redis is running
redis-cli ping
```

### Ingest API Connection Failed

```
AxiosError: Request failed with status code 401
```

**Solution:**
```bash
# Verify API key matches ingest service configuration
echo $INGEST_API_KEY

# Test connection
curl -H "Authorization: Bearer $INGEST_API_KEY" http://localhost:3004/health
```

## Performance Issues

### Slow Scraping (>30 minutes)

**Diagnosis:**
```bash
curl http://localhost:8210/health | jq '.queue'
```

**Possible causes:**
1. Cloudflare blocking most search pages (check logs for 403 warnings)
2. Low worker concurrency: increase `WORKER_CONCURRENCY`
3. Rate limiting: check for 429 errors in logs

### Queue Not Draining

```bash
# Check queue stats
curl http://localhost:8210/health | jq '.queue'

# Check for failed jobs
redis-cli LLEN bull:immoweb-details:failed
```

## Data Quality Issues

### Missing EPC Score

**Cause:** EPC (Energy Performance Certificate) data is only available on detail pages, not search results.

**Solution:** Ensure detail fetch is working. Check that `window.classified` JSON is being extracted from detail page HTML.

### Wrong Category Assignment

**Cause:** Category is determined by search URL parameter, not listing content.

**Solution:** Verify category mapping in `detailQueue.ts`:
```typescript
if (cat === 'APARTMENT' || cat === 'FLAT') return transformApartment(raw, transactionType);
if (cat === 'HOUSE') return transformHouse(raw, transactionType);
```

### Missing Coordinates

**Cause:** Some Immoweb listings hide exact coordinates.

**Solution:** Check `property.location.latitude` and `property.location.longitude` presence. No fallback available.

## Memory Issues

### Out of Memory

```
FATAL ERROR: Reached heap limit Allocation failed
```

**Solution:**
```bash
# Already configured to 4GB in package.json start script
# Reduce worker count if still occurring
WORKER_CONCURRENCY=25
```

## Diagnostic Commands

```bash
# Real-time logs
docker logs -f be-immoweb

# Check queue state
curl http://localhost:8210/health | jq

# Search for errors
docker logs be-immoweb | grep -i error

# Redis queue inspection
redis-cli LLEN bull:immoweb-details:wait
redis-cli LLEN bull:immoweb-details:active
redis-cli LLEN bull:immoweb-details:completed
redis-cli LLEN bull:immoweb-details:failed
```
