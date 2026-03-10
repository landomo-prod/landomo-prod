# Retry Steps After ChecksumClient Fix

**Quick reference for scrape-validator after sreality-builder deploys the fix**

---

## Pre-Flight Checks (2 minutes)

### 1. Verify Infrastructure
```bash
./docker/verify-cz-ready.sh
```

Expected: All checks pass ✅

### 2. Verify Fix Was Applied
```bash
# Check that scraper container was rebuilt with new timestamp
docker inspect scraper-cz-sreality --format='{{.Created}}'

# Should be recent timestamp (within last hour)
```

### 3. Check Scraper Health
```bash
curl -s http://localhost:8102/health | jq '.'
```

Expected:
```json
{
  "status": "healthy",
  "scraper": "sreality",
  "workers": 200,
  "queue": { "waiting": 0, "active": 0, ... }
}
```

---

## Execute First Scrape (15-20 minutes)

### 1. Clear Any Previous Data (Optional)
```bash
docker exec postgres-cz psql -U landomo -d landomo_cz -c \
  "DELETE FROM property_checksums WHERE portal = 'sreality';"
```

### 2. Trigger Scrape
```bash
curl -X POST http://localhost:8102/scrape
```

Expected response:
```json
{"status":"scraping started","categories":"all","timestamp":"..."}
```

### 3. Monitor Real-Time (Open in separate terminal)
```bash
docker logs -f scraper-cz-sreality 2>&1 | grep -E "(PHASE|✅|❌|Phase)"
```

Watch for:
```
📋 PHASE 1: Collecting listings and generating checksums...
✅ Phase 1 complete: ~100000 listings in X.Xs

🔍 PHASE 2: Comparing checksums to detect changes...
✅ Phase 2 complete in X.Xs:  # ← This should NOT be 401 anymore!
  🆕 New: ~100000 (100%)
  🔄 Changed: 0 (0%)
  ✓  Unchanged: 0 (0%)

📤 PHASE 3: Queuing changed properties for detail fetching...
✅ Phase 3 complete: ~100000 properties queued
```

### 4. Wait for Completion
```bash
# Check queue status periodically
watch -n 10 'curl -s http://localhost:8102/health | jq ".queue"'
```

Wait until:
- `waiting: 0`
- `active: 0`
- `completed: ~100000`

---

## Verify Results (5 minutes)

### 1. Check Checksums Stored
```bash
docker exec postgres-cz psql -U landomo -d landomo_cz -c \
  "SELECT COUNT(*) FROM property_checksums WHERE portal = 'sreality';"
```

Expected: ~100,000 rows

### 2. Check Properties Ingested
```bash
docker exec postgres-cz psql -U landomo -d landomo_cz -c \
  "SELECT COUNT(*) FROM properties WHERE portal = 'sreality';"
```

Expected: ~100,000 rows

### 3. Get Detailed Stats
```bash
docker exec postgres-cz psql -U landomo -d landomo_cz -c "
  SELECT
    portal,
    COUNT(*) as total,
    MIN(first_seen_at) as first_seen,
    MAX(last_seen_at) as last_seen
  FROM property_checksums
  WHERE portal = 'sreality'
  GROUP BY portal;
"
```

---

## Execute Second Scrape (5-10 minutes)

### 1. Trigger Immediately
```bash
curl -X POST http://localhost:8102/scrape
```

### 2. Monitor Phase 2 (CRITICAL)
```bash
docker logs -f scraper-cz-sreality 2>&1 | grep -A 10 "PHASE 2"
```

**Expected Output (THE KEY TEST):**
```
🔍 PHASE 2: Comparing checksums to detect changes...
✅ Phase 2 complete in X.Xs:
  🆕 New: ~500 (0.5%)
  🔄 Changed: ~5000 (5%)
  ✓  Unchanged: ~94500 (94-95%)  ← TARGET!
  💰 Savings: 94-95% fewer detail fetches
```

### 3. Verify Fast Completion
Second scrape should complete in ~2-5 minutes (not 15-20 minutes).

### 4. Compare Performance
```bash
docker exec postgres-cz psql -U landomo -d landomo_cz -c "
  SELECT
    portal,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - started_at))::INT as duration_seconds,
    listings_found,
    listings_new,
    listings_updated,
    listings_unchanged,
    ROUND((listings_unchanged::DECIMAL / listings_found) * 100, 1) as unchanged_pct
  FROM scrape_runs
  WHERE portal = 'sreality'
  ORDER BY started_at DESC
  LIMIT 2;
"
```

---

## Success Criteria

### Task #5: First Scrape ✅
- [ ] Phase 1 completed (~100k listings)
- [ ] Phase 2 completed (100% new, no auth error)
- [ ] Phase 3 completed (all queued)
- [ ] ~100k checksums stored in DB
- [ ] ~100k properties ingested
- [ ] Duration: 10-20 minutes

### Task #6: Second Scrape ✅
- [ ] Phase 2 shows 90-95% unchanged
- [ ] Only ~5-10k properties fetched
- [ ] Duration: 2-5 minutes (5-7x faster)
- [ ] Bandwidth savings validated

---

## If Something Goes Wrong

### Auth Still Failing
```bash
# Check if fix was actually applied
docker exec scraper-cz-sreality cat /app/shared-components/dist/core-client/checksum-client.js | grep -A 5 "Authorization"

# Should see: 'Authorization': 'Bearer ' + apiKey
```

### Checksums Not Storing
```bash
# Check ingest service logs
docker logs ingest-cz --tail 100 | grep checksum

# Check for errors in Phase 2
docker logs scraper-cz-sreality | grep -i "phase 2" -A 20
```

### Slow Performance
```bash
# Check if workers are stuck
curl -s http://localhost:8102/health | jq '.queue'

# Check BullMQ queue
docker exec redis redis-cli LLEN bull:sreality-detail-queue:wait
```

---

## Report Results

### Task #5 Complete
```bash
# Send to team-lead:
- First scrape duration
- Checksums stored count
- Properties ingested count
- Any issues encountered
```

### Task #6 Complete
```bash
# Send to team-lead:
- Second scrape duration
- Savings percentage (unchanged %)
- Performance comparison table
- Success criteria validation
```

---

## Automated Execution

If you want to run everything automatically:

```bash
cd ingest-service
./test-checksum-scrape.sh
```

This script handles:
- ✅ Pre-flight checks
- ✅ First scrape trigger + monitoring
- ✅ Checksum verification
- ✅ Second scrape trigger + monitoring
- ✅ Performance comparison
- ✅ Success criteria validation
- ✅ Formatted output with tables

**Estimated total time:** 25-35 minutes

---

**Created by:** scrape-validator
**Purpose:** Quick reference for retry after ChecksumClient fix
**Status:** Ready to execute once fix is deployed
