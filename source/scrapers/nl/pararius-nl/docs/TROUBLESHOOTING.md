# Troubleshooting

> Common issues and their solutions for the Pararius scraper

## Rate Limiting

### HTTP 429 or IP Block

**Symptom:**
```
AxiosError: Request failed with status code 429
```
Or search pages returning empty results after some pages succeed.

**Cause:** Pararius rate limits aggressively. Even moderate concurrency triggers blocks.

**Solution:**

1. Keep concurrency low:
   ```bash
   WORKER_CONCURRENCY=10  # Down from 20
   ```

2. Increase delays in `fetchData.ts`:
   - Search pages: 500-1000ms between pages (already conservative)
   - Detail pages: 300-1000ms random delay per request

3. Wait before retrying — blocks typically last 5-30 minutes

4. For production: use rotating residential proxies with Dutch IPs

### All Pages Return Empty

**Symptom:** `Fetched total listings: 0` for all property types

**Cause:** IP may be temporarily blocked, or Pararius changed HTML structure

**Diagnosis:**

```bash
# Test accessibility
curl -s -o /dev/null -w "%{http_code}" "https://www.pararius.nl/huurappartementen/nederland"
# 200 = accessible, 403/429 = blocked

# Check if HTML structure changed
curl -s "https://www.pararius.nl/huurappartementen/nederland" | \
  grep -c "search-list__item--listing"
# Should return > 0
```

## Selector Issues

### Search Page Selectors Broken

**Symptom:** Pages load (200 status) but 0 listings extracted

**Cause:** Pararius updated their HTML class names

**Diagnosis:**

```bash
# Download page and inspect
curl -s "https://www.pararius.nl/huurappartementen/nederland" > /tmp/pararius-test.html

# Check for listing elements
grep -c "listing-search-item" /tmp/pararius-test.html
grep -c "search-list__item" /tmp/pararius-test.html
```

**Solution:** Update selectors in `fetchData.ts`:
- Listing cards: `li.search-list__item--listing` or `section.listing-search-item`
- Links: `a.listing-search-item__link--title`
- Price: `.listing-search-item__price`
- Area: `.illustrated-features__description--surface-area`

### Detail Page Selectors Broken

**Symptom:** Detail pages fetch successfully but all fields are empty/undefined

**Key selectors to verify:**

| Data | Selector |
|------|----------|
| Address | `h1.listing-detail-summary__title` |
| City | `.listing-detail-summary__location` |
| Price | `.listing-detail-summary__price` |
| Description | `.listing-detail-description__content` |
| Features | `.listing-features__list-item dt` / `dd` |
| Agent | `.agent-summary__title` |

## Connection Issues

### Redis Connection Failed

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

1. Verify Redis is running: `redis-cli ping`
2. In Docker, use service name: `REDIS_HOST=redis`

### Ingest API Connection Failed

**Solution:**

1. Check ingest service: `curl http://localhost:3000/health`
2. In Docker: `INGEST_API_URL=http://nl-ingest:3000`
3. Verify API key matches

## Data Quality Issues

### Missing Coordinates

**Symptom:** `latitude` and `longitude` undefined for most listings

**Cause:** Pararius only provides coordinates in JSON-LD schema on some detail pages. Not all pages include the `geo` property.

**This is expected.** Coordinates will be populated for listings that include JSON-LD geographic data.

### Missing Bedrooms

**Symptom:** `bedrooms: 0` for many listings

**Cause:** Pararius feature tables use various labels: `slaapkamers`, `aantal slaapkamers`. If neither is present, falls back to `rooms - 1`.

### Furnished Status Not Detected

**Symptom:** `furnished: undefined`

**Cause:** Feature table may use different labels than expected (`interieur`, `gemeubileerd`).

**Diagnosis:** Check what label Pararius uses in the detail page features table.

## Queue Issues

### Queue Not Draining

**Symptom:** Waiting count stays high, completed doesn't increase

**Diagnosis:**

```bash
curl http://localhost:8221/health | jq '.queue'
docker logs nl-pararius | grep "Worker error\|Job failed"
```

**Common cause:** Rate limiting causing all detail fetches to fail with 429. Wait and retry.

## Diagnostic Commands

```bash
# Real-time logs
docker logs -f nl-pararius

# Check queue state
curl http://localhost:8221/health | jq '.queue'

# Check scrape progress
docker logs nl-pararius | grep "Phase\|Queue progress\|Scrape completed"

# Test Pararius accessibility
curl -s -o /dev/null -w "%{http_code}" "https://www.pararius.nl/huurappartementen/nederland"
```
