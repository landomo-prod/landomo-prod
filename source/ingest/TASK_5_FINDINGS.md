# Task #5 Findings: First Scrape Test Results

**Agent:** scrape-validator
**Date:** 2026-02-10
**Status:** Blocked - Auth header fix needed

---

## Executive Summary

First scrape was triggered and successfully completed **Phase 1** (collected 10,000 listings in 5.9s), but failed in **Phase 2** due to an authentication header mismatch between ChecksumClient and ingest service auth middleware.

**Root Cause:** ChecksumClient sends `X-API-Key` header, but ingest service expects `Authorization: Bearer` header.

---

## Test Execution Timeline

### ✅ Infrastructure Verification (8:56 AM)
- postgres-cz: Running (port 5433) ✓
- redis: Running (port 6379) ✓
- ingest-cz: Running (port 3004 → 3000 internal) ✓
- scraper-cz-sreality: Running (port 8102) ✓
- Initial checksums: 0 (as expected)

### ✅ Scrape Triggered (8:56:12 AM)
```bash
curl -X POST http://localhost:8102/scrape
→ {"status":"scraping started","categories":"all"}
```

### ✅ Phase 1: SUCCESS (5.9 seconds)
```
📋 PHASE 1: Collecting listings and generating checksums...
  [Category 1] Found 2000 listings
  [Category 2] Found 2000 listings
  [Category 3] Found 2000 listings
  [Category 4] Found 2000 listings
  [Category 5] Found 2000 listings
✅ Phase 1 complete: 10000 listings in 5.9s
```

**Results:**
- Categories processed: 5
- Total listings: 10,000
- Checksums generated: 10,000
- Duration: 5.9s

### ❌ Phase 2: FAILED (Authorization Error)
```
🔍 PHASE 2: Comparing checksums to detect changes...
  Generated 10000 checksums
❌ Scrape failed: Request failed with status code 401
```

**Error Details:**
```
AxiosError: Request failed with status code 401
  at ChecksumClient.compareChecksums
  at runThreePhaseScrape
  at runScraper

Response:
{
  error: 'Unauthorized',
  message: 'Missing or invalid Authorization header'
}
```

**Failed Request:**
```
POST http://ingest-cz:3000/api/v1/checksums/compare
Headers: {
  'X-API-Key': 'dev_key_cz_1',  // ❌ Wrong format
  'Content-Type': 'application/json'
}
```

### ⏳ Phase 3: Not Reached
Phase 3 (selective fetching) was never executed due to Phase 2 failure.

---

## Root Cause Analysis

### Header Mismatch

**ChecksumClient Implementation:**
```typescript
// File: shared-components/src/core-client/checksum-client.ts
// Line: 24-31

constructor(baseURL: string, apiKey: string) {
  this.client = axios.create({
    baseURL,
    headers: {
      'X-API-Key': apiKey,  // ❌ Sends this
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}
```

**Ingest Auth Middleware:**
```typescript
// File: ingest-service/src/middleware/auth.ts
// Line: 47-54

const authHeader = request.headers.authorization;  // ✅ Expects this

if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return reply.status(401).send({
    error: 'Unauthorized',
    message: 'Missing or invalid Authorization header',
  });
}
```

### Why This Happened

1. ChecksumClient was designed with `X-API-Key` header (common pattern)
2. Ingest service auth middleware expects `Authorization: Bearer` (more standard)
3. No integration test caught this mismatch before first scrape
4. Environment variables are correct - only the header format is wrong

---

## The Fix

### Required Change

**File:** `shared-components/src/core-client/checksum-client.ts`

**Line 27 - Change from:**
```typescript
'X-API-Key': apiKey,
```

**To:**
```typescript
'Authorization': `Bearer ${apiKey}`,
```

### Complete Fixed Constructor:
```typescript
constructor(baseURL: string, apiKey: string) {
  this.client = axios.create({
    baseURL,
    headers: {
      'Authorization': `Bearer ${apiKey}`,  // ✅ Fixed
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}
```

### Deployment Steps

1. **Fix ChecksumClient:**
   ```bash
   cd shared-components
   # Edit src/core-client/checksum-client.ts (line 27)
   npm run build
   ```

2. **Rebuild Scraper:**
   ```bash
   cd "scrapers/Czech Republic/sreality"
   npm install  # Picks up updated @landomo/core
   docker compose -f docker/docker-compose.yml build scraper-cz-sreality
   ```

3. **Restart Scraper:**
   ```bash
   docker restart scraper-cz-sreality
   ```

4. **Re-trigger Scrape:**
   ```bash
   curl -X POST http://localhost:8102/scrape
   ```

---

## Environment Verification

All environment variables are correctly configured:

### Scraper Container (scraper-cz-sreality)
```bash
INGEST_API_URL=http://ingest-cz:3000  ✓
INGEST_API_KEY=dev_key_cz_1           ✓
```

### Ingest Container (ingest-cz)
```bash
API_KEYS=dev_key_cz_1,dev_key_cz_2    ✓
PORT=3000                               ✓
```

### Network Connectivity
```bash
# From scraper to ingest (internal)
http://ingest-cz:3000  ✓

# From host to ingest (external)
http://localhost:3004  ✓

# From host to scraper
http://localhost:8102  ✓
```

---

## Database State

### Before Scrape
```sql
SELECT COUNT(*) FROM property_checksums WHERE portal = 'sreality';
→ 0 rows
```

### After Failed Scrape
```sql
SELECT COUNT(*) FROM properties WHERE portal = 'sreality';
→ 0 rows (Phase 3 never executed, no properties ingested)

SELECT COUNT(*) FROM property_checksums WHERE portal = 'sreality';
→ 0 rows (Phase 2 failed, no checksums stored)
```

---

## Impact Assessment

### What Worked ✅
- Infrastructure deployment
- Service health checks
- Environment configuration
- Phase 1: Listing collection
- Checksum generation

### What Failed ❌
- Phase 2: Checksum comparison (auth issue)
- Phase 3: Not reached
- Property ingestion: 0 properties
- Checksum storage: 0 checksums

### Blocking Tasks
- **Task #5:** Cannot complete until auth fix deployed
- **Task #6:** Depends on Task #5 completion
- **Task #7:** Depends on Task #6 results

---

## Next Steps

### Immediate (Assigned to sreality-builder)
1. Fix ChecksumClient auth header
2. Rebuild shared-components
3. Rebuild scraper
4. Notify scrape-validator when ready

### After Fix (scrape-validator)
1. Verify infrastructure still healthy
2. Re-trigger first scrape
3. Monitor all three phases
4. Verify ~100k checksums stored
5. Complete Task #5
6. Proceed to Task #6 (second scrape)

---

## Lessons Learned

1. **Integration Testing Gap:** Need end-to-end test that validates auth headers before deployment
2. **Header Standardization:** Should document expected auth format across all services
3. **Quick Diagnosis:** Diagnostic scripts (verify-cz-ready.sh) helped identify issue quickly
4. **Good Logging:** Error messages clearly indicated the auth header issue

---

## Test Artifacts

### Scripts Created
- `ingest-service/test-checksum-scrape.sh` - Automated test (ready for retry)
- `docker/diagnose-cz-infrastructure.sh` - Infrastructure diagnostics
- `docker/verify-cz-ready.sh` - Quick health check
- `ingest-service/SCRIPTS_CREATED.md` - Usage documentation

### Logs Captured
- Scraper logs: Phase 1 success, Phase 2 failure
- Error stack trace: Full auth error details
- Container status: All services running

---

## Estimated Time to Resolution

- **Fix implementation:** 5 minutes (one line change)
- **Build + deploy:** 10 minutes (rebuild containers)
- **Re-test scrape:** 20-30 minutes (full scrape cycle)
- **Total:** ~40-45 minutes from fix to completion

---

**Status:** Waiting for sreality-builder to deploy fix
**Next Update:** After fix is deployed and re-test is triggered
