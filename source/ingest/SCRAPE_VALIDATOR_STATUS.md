# Scrape Validator Status

**Agent:** scrape-validator
**Tasks:** #5 (First Scrape), #6 (Second Scrape + Validation)
**Status:** Ready, waiting for infrastructure

---

## Current Situation

### Infrastructure Status
- ✅ New containers created with correct naming
- ⏳ Containers in "Created" state, need to be started
- ⏳ Waiting for docker-deployer to start services and complete Task #4

### Containers Needed
- `postgres-cz` (port 5433)
- `redis` (port 6379)
- `ingest-cz` (port 3007)
- `worker-cz-1`, `worker-cz-2`, `worker-cz-3`
- `scraper-cz-sreality` (port 8102)

---

## Deliverables Prepared

### 1. Test Automation Script ✅
**Location:** `/Users/samuelseidel/Development/landomo-world/ingest-service/test-checksum-scrape.sh`

**Features:**
- Automated first scrape + second scrape execution
- Real-time log monitoring with color-coded output
- Checksum verification before/after
- Detailed results analysis
- Performance comparison tables
- Success criteria validation (90-95% savings)

**Usage:**
```bash
cd ingest-service
./test-checksum-scrape.sh
```

### 2. Infrastructure Diagnostic Script ✅
**Location:** `/Users/samuelseidel/Development/landomo-world/docker/diagnose-cz-infrastructure.sh`

**Features:**
- Service status checks
- Port availability tests
- API endpoint health checks
- Database table verification
- Environment variable validation
- Recent error log analysis
- Actionable fix suggestions

**Usage:**
```bash
cd /Users/samuelseidel/Development/landomo-world
./docker/diagnose-cz-infrastructure.sh
```

---

## Test Plan

### Task #5: First Scrape (Baseline)
1. Trigger scrape: `curl -X POST http://localhost:8102/scrape`
2. Monitor logs: `docker logs -f scraper-cz-sreality`
3. Wait for completion (~10-15 minutes expected)
4. Verify checksums stored: ~100,000 expected
5. Record metrics: duration, listings found, new/changed/unchanged

### Task #6: Second Scrape (Validation)
1. Trigger scrape immediately after first: `curl -X POST http://localhost:8102/scrape`
2. Monitor Phase 2 output - **CRITICAL TEST**:
   - Expected: 90-95% unchanged
   - Expected: 0.5-1% new
   - Expected: 4-9% changed
3. Verify completion time: 2-5 minutes (vs 10-15)
4. Verify only ~5-10k properties fetched (vs 100k)
5. Compare performance metrics

### Success Criteria
- ✅ First scrape collects ~100k checksums
- ✅ Second scrape shows 90-95% unchanged
- ✅ Second scrape completes in 2-5 minutes (not 10-15)
- ✅ Bandwidth savings: 90-95% fewer detail page fetches

---

## Communication Log

### Messages to docker-deployer:
1. Initial status check request
2. Infrastructure issues identified (API key, service names, stopped services)
3. Updated status (new containers created but not started)
4. Start sequence instructions provided

### Messages to team-lead:
1. Infrastructure issues blocking tests
2. Test script ready, waiting for infrastructure
3. Waiting for Task #4 completion

---

## Next Steps

### Immediate (Blocked on docker-deployer):
1. ⏳ docker-deployer starts all CZ services
2. ⏳ docker-deployer validates health checks pass
3. ⏳ docker-deployer marks Task #4 complete

### Once Unblocked:
4. ▶️ Run test automation script
5. ▶️ Analyze first scrape results
6. ▶️ Analyze second scrape results
7. ▶️ Generate performance comparison report
8. ▶️ Mark Tasks #5 and #6 complete
9. ▶️ Send detailed results to team-lead

---

## Expected Timeline

| Phase | Duration | Details |
|-------|----------|---------|
| Infrastructure startup | 5-10 min | docker-deployer starting services |
| First scrape | 10-15 min | Baseline, full fetch |
| Second scrape | 2-5 min | Validation, 90-95% savings |
| Analysis & reporting | 5 min | Generate reports, send results |
| **Total** | **22-35 min** | End-to-end completion |

---

## Contact

For updates on Task #5 and #6 progress, contact **scrape-validator** agent.

**Status:** ⏳ Ready to execute, waiting for infrastructure
