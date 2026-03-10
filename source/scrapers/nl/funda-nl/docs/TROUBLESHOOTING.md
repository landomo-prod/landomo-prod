# Troubleshooting

> Common issues and their solutions for the Funda scraper

## Captcha / Bot Detection

### Captcha Wall Blocking Scraper

**Symptom:** Search or detail pages return HTML with captcha challenge instead of listing data. Listings found = 0 despite Funda having ~100k active listings.

**Cause:** Funda has aggressive bot detection that serves captcha pages to automated requests. This is the most common issue with this scraper.

**Diagnosis:**

```bash
# Check if getting captcha pages
docker logs nl-funda | grep "Fetched total listings"
# If "total: 0" for both koop and huur, captcha is likely blocking

# Test manually
curl -s "https://www.funda.nl/zoeken/koop/?selected_area=%5B%22nl%22%5D" | head -100
# Look for "captcha" or "challenge" in response
```

**Solutions:**

1. **Residential proxies** (recommended for production):
   - Route requests through residential IP pool
   - Dutch IPs preferred for locale consistency

2. **Puppeteer stealth** (alternative):
   - Replace Cheerio/Axios with Puppeteer + `puppeteer-extra-plugin-stealth`
   - Renders JavaScript, passes browser fingerprint checks
   - Higher resource usage (~4x memory)

3. **Reduce concurrency** (temporary mitigation):
   ```bash
   CONCURRENT_PAGES=2
   WORKER_CONCURRENCY=10
   MAX_PAGES=50  # Test with smaller subset
   ```

4. **Increase delays:**
   - Search page batch delay is 500-1000ms (configurable in `fetchData.ts`)
   - Detail fetch delay is 200-800ms (configurable in `detailQueue.ts`)

### Empty __NEXT_DATA__

**Symptom:** Search pages parse but return 0 results. HTML fallback also finds nothing.

**Cause:** Funda may have changed their page structure or removed `__NEXT_DATA__`.

**Diagnosis:**

```bash
# Fetch a search page and check structure
curl -s "https://www.funda.nl/zoeken/koop/?selected_area=%5B%22nl%22%5D" > /tmp/funda-test.html
grep "__NEXT_DATA__" /tmp/funda-test.html
```

**Solution:** Update selectors in `fetchData.ts`. Check `props.pageProps.searchResult.resultList` path.

## Connection Issues

### Redis Connection Failed

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

1. Verify Redis is running: `redis-cli ping`
2. In Docker, use service name: `REDIS_HOST=redis`
3. Check password: `REDIS_PASSWORD` must match Redis config

### Ingest API Connection Failed

**Symptom:**
```
Error: connect ECONNREFUSED localhost:3000
AxiosError: Request failed with status code 401
```

**Solution:**

1. Check ingest service: `curl http://localhost:3000/health`
2. Verify API key matches ingest service configuration
3. In Docker, use service name: `INGEST_API_URL=http://nl-ingest:3000`

## Data Quality Issues

### Missing Bedrooms

**Symptom:** `bedrooms: 0` for many listings

**Cause:** Funda may not always provide `aantalSlaapkamers`. Fallback uses `rooms - 1`.

**Solution:** This is expected when the portal omits bedroom count. The transformer falls back to `Math.max(rooms - 1, 0)`.

### Missing Square Meters

**Symptom:** `sqm: 0` or `livingArea: undefined`

**Cause:** Living area not found in `__NEXT_DATA__` or HTML `[title*="Woonoppervlakte"]`.

**Diagnosis:**

```bash
# Check detail page structure
curl -s "https://www.funda.nl/koop/amsterdam/appartement-12345/" | \
  grep -o '"woonoppervlakte":[0-9]*'
```

### Wrong Category Detection

**Symptom:** Houses categorized as apartments

**Cause:** Property type string not matching Dutch keywords in `mapFundaType()`

**Solution:** Check the `soortObject` or `type` field in the raw data. Add missing Dutch type keywords to the mapping in `fetchData.ts` and `detailQueue.ts`.

## Queue Issues

### Jobs Stuck in Active State

**Symptom:** Queue active count stays high, completed does not increase

**Solution:**

1. Check worker logs for errors:
   ```bash
   docker logs nl-funda | grep "Worker error"
   ```

2. Restart the scraper:
   ```bash
   docker restart nl-funda
   ```

3. Clear stale jobs:
   ```bash
   redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', 'bull:funda-details:*')))" 0
   ```

### Queue Not Draining

**Symptom:** Waiting count stays high

**Cause:** Workers may be blocked by captcha responses, causing all jobs to fail/retry.

**Diagnosis:**

```bash
# Check failed job count
curl http://localhost:8220/health | jq '.queue'

# Check logs for captcha indicators
docker logs nl-funda | grep -i "captcha\|challenge\|403\|429"
```

## Memory Issues

### Out of Memory Error

**Symptom:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solution:**

1. Default heap is 4GB. Increase if needed:
   ```json
   "start": "node --max-old-space-size=6144 dist/index.js"
   ```

2. Reduce worker count: `WORKER_CONCURRENCY=20`

## Diagnostic Commands

```bash
# Real-time logs
docker logs -f nl-funda

# Check queue state
curl http://localhost:8220/health | jq '.queue'

# Check scrape progress
docker logs nl-funda | grep "Phase\|Queue progress\|Scrape completed"

# Test Funda accessibility
curl -s -o /dev/null -w "%{http_code}" "https://www.funda.nl/zoeken/koop/"
```
