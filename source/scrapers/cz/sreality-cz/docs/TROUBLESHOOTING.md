# Troubleshooting

> Common issues and their solutions

## Table of Contents

- [Connection Issues](#connection-issues)
- [Performance Issues](#performance-issues)
- [Data Quality Issues](#data-quality-issues)
- [Queue Issues](#queue-issues)
- [API Issues](#api-issues)
- [Memory Issues](#memory-issues)

## Connection Issues

### Redis Connection Failed

**Symptom**:
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause**: Redis not running or wrong host/port

**Solution**:

1. Check Redis is running:
```bash
redis-cli ping
# Expected: PONG
```

2. Verify environment variables:
```bash
echo $REDIS_HOST  # Should be 'localhost' or 'redis'
echo $REDIS_PORT  # Should be 6379
```

3. Start Redis:
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:7

# macOS
brew services start redis

# Linux
sudo systemctl start redis-server
```

4. **Docker-specific**: Use service name, not localhost:
```bash
REDIS_HOST=redis  # NOT localhost when running in Docker
```

### Ingest API Connection Failed

**Symptom**:
```
Error: connect ECONNREFUSED localhost:3004
AxiosError: Request failed with status code 401
```

**Cause**: Ingest service not running or wrong API key

**Solution**:

1. Check ingest service:
```bash
curl http://localhost:3004/health
# Expected: {"status":"healthy"}
```

2. Verify API key:
```bash
echo $INGEST_API_KEY
# Should match key configured in ingest service
```

3. Test authentication:
```bash
curl -H "Authorization: Bearer $INGEST_API_KEY" \
  http://localhost:3004/health
```

4. Start ingest service:
```bash
cd ingest-service
npm run dev
```

### SReality API Timeout

**Symptom**:
```
Error: timeout of 30000ms exceeded
```

**Cause**: Network issues or API rate limiting

**Solution**:

1. Check internet connection
2. Reduce concurrency:
```bash
WORKER_CONCURRENCY=50
CONCURRENT_PAGES=10
```

3. Add retry logic (already implemented):
```typescript
// Retries: 3 attempts with exponential backoff
await fetchDataWithRetry(url, headers, 3);
```

## Performance Issues

### Slow Scraping (>30 minutes)

**Symptom**: Scrape takes much longer than expected 10-15 minutes

**Diagnosis**:

```bash
# Check queue stats
curl http://localhost:8102/health | jq '.queue'

# Expected output:
# {
#   "waiting": 1000,  # Should decrease over time
#   "active": 200,    # Should match WORKER_CONCURRENCY
#   "completed": 5000
# }
```

**Possible Causes**:

1. **Low Worker Count**:
```bash
# Check current setting
echo $WORKER_CONCURRENCY

# Increase to 200
WORKER_CONCURRENCY=200
```

2. **Network Latency**:
```bash
# Test API response time
time curl -s https://www.sreality.cz/api/cs/v2/estates/12345678 > /dev/null
# Should be < 1 second
```

3. **Rate Limiting**:
```bash
# Check for 429 errors in logs
docker logs landomo-scraper-sreality | grep "429"

# Reduce concurrency if rate limited
WORKER_CONCURRENCY=100
CONCURRENT_PAGES=10
```

4. **Queue Bottleneck**:
```bash
# Check Redis memory
redis-cli info memory | grep used_memory_human

# Clear old jobs if needed
redis-cli FLUSHALL  # DANGER: Deletes all data!
```

### High CPU Usage

**Symptom**: CPU at 100% during scrape

**Cause**: Too many concurrent workers for available cores

**Solution**:

1. Check CPU cores:
```bash
# macOS
sysctl -n hw.ncpu

# Linux
nproc
```

2. Adjust workers to match cores:
```bash
# 4 cores → 100 workers
# 8 cores → 200 workers
# 2 cores → 50 workers
WORKER_CONCURRENCY=<cores * 25>
```

3. Set CPU limits in Docker:
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
```

### Queue Not Draining

**Symptom**: Queue waiting count stays high, not decreasing

**Diagnosis**:

```bash
# Check worker count
curl http://localhost:8102/health | jq '.workers'

# Check queue stats
curl http://localhost:8102/health | jq '.queue'
```

**Possible Causes**:

1. **Workers Not Started**:
```typescript
// Check src/index.ts
const workers = createDetailWorker(WORKER_CONCURRENCY);
console.log('Workers:', WORKER_CONCURRENCY);
```

2. **Jobs Failing**:
```bash
# Check failed jobs
redis-cli LLEN bull:sreality-details:failed

# View failed job
redis-cli LRANGE bull:sreality-details:failed 0 0
```

3. **Worker Crash**:
```bash
# Check logs
docker logs landomo-scraper-sreality | grep "Worker error"

# Restart workers
docker restart landomo-scraper-sreality
```

## Data Quality Issues

### Missing Bedrooms

**Symptom**: `bedrooms: 0` or `bedrooms: null`

**Cause**: Disposition not extracted from title

**Diagnosis**:

```typescript
// Check transformation
const listing = { name: "Prodej bytu 2+kk 52 m²" };
const disposition = extractDispositionFromTitle(listing.name);
console.log('Disposition:', disposition); // Should be "2+kk"
console.log('Bedrooms:', bedroomsFromDisposition(disposition)); // Should be 2
```

**Solution**:

1. Verify title parsing:
```typescript
// In srealityHelpers.ts
export function extractDispositionFromTitle(title: string): string | undefined {
  const match = title.match(/(\d+\+(?:kk|1))/i);
  return match ? match[1].toLowerCase() : undefined;
}
```

2. Add fallback to items array:
```typescript
const disposition = extractDispositionFromTitle(titleString)
  || parser.getString(FIELD_NAMES.DISPOSITION);
```

### Missing Square Meters

**Symptom**: `sqm: 0` or `sqm: null`

**Cause**: Area not found in items or title

**Diagnosis**:

```typescript
// Check parser
const parser = new SRealityItemsParser(listing.items);
const sqm = parser.getAreaOr(
  FIELD_NAMES.LIVING_AREA,
  FIELD_NAMES.LIVING_AREA_TRUNCATED,
  FIELD_NAMES.TOTAL_AREA
);
console.log('SQM:', sqm);
```

**Solution**:

1. Add more fallback fields:
```typescript
const sqm = parser.getAreaOr(
  FIELD_NAMES.LIVING_AREA,
  FIELD_NAMES.LIVING_AREA_TRUNCATED,
  FIELD_NAMES.TOTAL_AREA,
  FIELD_NAMES.AREA  // Additional fallback
) || extractAreaFromTitle(titleString) || 0;
```

2. Check field name variations:
```bash
# View actual field names in API
curl https://www.sreality.cz/api/cs/v2/estates/12345678 | \
  jq '.items[].name'
```

### Wrong Category Detected

**Symptom**: House categorized as apartment

**Cause**: Category detection logic error

**Diagnosis**:

```typescript
// Test detection
const listing = { seo: { category_main_cb: 2 }, name: "Prodej domu" };
const category = detectCategoryFromSreality(listing);
console.log('Detected:', category); // Should be "house"
```

**Solution**:

1. Check API category first (most reliable):
```typescript
if (categoryId === 1) return 'apartment';
if (categoryId === 2) return 'house';
// ...
```

2. Update title keyword matching:
```typescript
// Add more house keywords
if (titleStr.includes('dům') ||
    /\brd\b/.test(titleStr) ||
    titleStr.includes('rodinný dům') ||
    titleStr.includes('vila'))
  return 'house';
```

### Checksum Not Detecting Changes

**Symptom**: All properties marked "unchanged" when prices changed

**Cause**: Checksum fields not extracted correctly

**Diagnosis**:

```typescript
// Test checksum extraction
const listing = { price_czk: { value_raw: 5500000 }, name: "Test" };
const fields = extractSRealityChecksumFields(listing);
console.log('Checksum fields:', fields);
// Should show: { price: 5500000, title: "Test", ... }
```

**Solution**:

1. Verify field paths:
```typescript
export function extractSRealityChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price_czk?.value_raw ?? listing.price ?? null,
    title: listing.name ?? null,
    // ...
  };
}
```

2. Test with real data:
```bash
# Fetch listing
curl https://www.sreality.cz/api/cs/v2/estates/12345678 > test.json

# Check structure
jq '.price_czk' test.json
jq '.name' test.json
```

## Queue Issues

### Jobs Stuck in "Active" State

**Symptom**: Jobs show active but never complete

**Cause**: Worker crashed without cleaning up

**Solution**:

1. Clear stale jobs:
```bash
redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', 'bull:sreality-details:*')))" 0
```

2. Restart workers:
```bash
docker restart landomo-scraper-sreality
```

3. Add timeout to jobs:
```typescript
defaultJobOptions: {
  timeout: 60000, // 60 second timeout per job
}
```

### Memory Leak in Queue

**Symptom**: Redis memory grows continuously

**Cause**: Completed jobs not cleaned up

**Solution**:

1. Check retention settings:
```typescript
removeOnComplete: {
  count: 1000,  // Keep only last 1000
  age: 3600,    // Delete after 1 hour
}
```

2. Manual cleanup:
```bash
# Count completed jobs
redis-cli LLEN bull:sreality-details:completed

# Delete old completed jobs
redis-cli DEL bull:sreality-details:completed
```

3. Monitor Redis memory:
```bash
redis-cli info memory | grep used_memory_human
```

## API Issues

### HTTP 429 (Too Many Requests)

**Symptom**:
```
AxiosError: Request failed with status code 429
```

**Cause**: Exceeded SReality API rate limits

**Solution**:

1. Reduce concurrency:
```bash
WORKER_CONCURRENCY=50
CONCURRENT_PAGES=5
```

2. Add delays:
```typescript
// In fetchData.ts
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
```

3. Implement exponential backoff:
```typescript
// Already implemented in fetchDataWithRetry
const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
```

### HTTP 410 (Gone) for Active Listings

**Symptom**: Many listings marked inactive with `http_410`

**Cause**: Listings were recently removed or SReality API issue

**Solution**:

1. Check if listing exists on website:
```bash
curl -I https://www.sreality.cz/detail/prodej/byt/2+kk/praha-2/12345678
# Check response code
```

2. Verify hash_id is correct:
```typescript
console.log('Hash ID:', listing.hash_id);
console.log('URL:', `https://www.sreality.cz/api/cs/v2/estates/${listing.hash_id}`);
```

3. Skip inactive listings (already implemented):
```typescript
if (detailResult.isInactive) {
  return { skipped: true, reason: detailResult.inactiveReason };
}
```

### Empty Response (`logged_in: false`)

**Symptom**: API returns `{"logged_in": false}`

**Cause**: SReality requires login for some listings (e.g., premium)

**Solution**:

Already handled - listings marked as inactive:

```typescript
if (typeof data === 'string' && data.trim() === '{"logged_in": false}') {
  return {
    isInactive: true,
    inactiveReason: 'logged_in_false'
  };
}
```

## Memory Issues

### Out of Memory Error

**Symptom**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Cause**: Too many concurrent workers or large batch size

**Solution**:

1. Increase heap size:
```json
// package.json
{
  "scripts": {
    "start": "node --max-old-space-size=6144 dist/index.js"
  }
}
```

2. Reduce worker count:
```bash
WORKER_CONCURRENCY=100  # Down from 200
```

3. Reduce batch size:
```typescript
// In detailQueue.ts
const BATCH_SIZE = 50;  // Down from 100
```

4. Enable garbage collection:
```bash
node --expose-gc --max-old-space-size=4096 dist/index.js
```

### Memory Leak

**Symptom**: Memory usage grows continuously over time

**Cause**: Objects not released after processing

**Solution**:

1. Profile memory:
```bash
node --inspect dist/index.js
# Open chrome://inspect and take heap snapshots
```

2. Clear batch after flush:
```typescript
async function flushBatch() {
  await adapter.sendProperties(batch);
  batch = [];  // Clear array
  batch.length = 0;  // Ensure array is empty
}
```

3. Close connections:
```typescript
// In worker shutdown
worker.on('closing', async () => {
  await flushBatch();
  await adapter.close();  // Close HTTP connections
});
```

## Diagnostic Commands

### View Logs

```bash
# Real-time logs
docker logs -f landomo-scraper-sreality

# Last 100 lines
docker logs --tail 100 landomo-scraper-sreality

# Search for errors
docker logs landomo-scraper-sreality | grep -i error
```

### Check Queue State

```bash
# Queue stats
curl http://localhost:8102/health | jq '.queue'

# Redis queue inspection
redis-cli LLEN bull:sreality-details:wait
redis-cli LLEN bull:sreality-details:active
redis-cli LLEN bull:sreality-details:completed
redis-cli LLEN bull:sreality-details:failed
```

### Check Scrape Progress

```bash
# View phase stats (from logs)
docker logs landomo-scraper-sreality | grep "Phase"

# Check ingest stats
curl http://localhost:3004/metrics | grep properties_ingested
```

### Performance Profiling

```bash
# CPU profiling
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect --max-old-space-size=4096 dist/index.js
# Use Chrome DevTools Memory Profiler
```

## Getting Help

If you can't resolve the issue:

1. Check logs for stack traces
2. Search existing issues on GitHub
3. Create issue with:
   - Error message
   - Environment (Docker/local, Node version)
   - Steps to reproduce
   - Relevant logs
4. Include diagnostics:
```bash
# System info
node --version
npm --version
redis-cli --version

# Queue state
curl http://localhost:8102/health

# Recent logs
docker logs --tail 50 landomo-scraper-sreality
```
