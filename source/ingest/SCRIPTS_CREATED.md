# Scripts Created by Scrape Validator

This document lists all scripts created by the scrape-validator agent for Tasks #5 and #6.

---

## 1. Automated Test Script

**Path:** `ingest-service/test-checksum-scrape.sh`

**Purpose:** Complete end-to-end validation of checksum-based scraping with automatic execution of both scrapes and comprehensive reporting.

**Features:**
- Service health checks before starting
- First scrape trigger and monitoring
- Checksum count verification
- Second scrape trigger and monitoring
- Real-time log monitoring with color-coded output
- Detailed results analysis for both scrapes
- Performance comparison tables
- Success criteria validation (90-95% savings)
- Professional formatted output

**Usage:**
```bash
cd /Users/samuelseidel/Development/landomo-world/ingest-service
./test-checksum-scrape.sh
```

**Expected Runtime:** 22-35 minutes total
- First scrape: 10-15 min
- Second scrape: 2-5 min
- Analysis: 5 min

---

## 2. Infrastructure Diagnostic Script

**Path:** `docker/diagnose-cz-infrastructure.sh`

**Purpose:** Comprehensive diagnostic tool to check all CZ infrastructure components and identify issues.

**Features:**
- Docker availability check
- Service status for all CZ containers
- Port availability tests (5433, 6379, 3007, 8102)
- API endpoint testing (ingest + scraper)
- Database existence and table verification
- Row count queries (properties, checksums, scrape_runs)
- Environment variable validation
- Recent error log analysis
- Actionable fix recommendations

**Usage:**
```bash
cd /Users/samuelseidel/Development/landomo-world
./docker/diagnose-cz-infrastructure.sh
```

**Exit Codes:**
- `0` = All checks pass
- `1` = Issues found

---

## 3. Quick Verification Script

**Path:** `docker/verify-cz-ready.sh`

**Purpose:** Fast verification that all services are healthy and ready for scrape tests. Designed for docker-deployer to confirm Task #4 completion.

**Features:**
- Container status checks (5 services)
- API endpoint health checks (2 endpoints)
- Database accessibility test
- Required tables verification
- Simple pass/fail output
- Clear next steps on success

**Usage:**
```bash
cd /Users/samuelseidel/Development/landomo-world
./docker/verify-cz-ready.sh
```

**Expected Runtime:** < 5 seconds

**Exit Codes:**
- `0` = Ready for testing
- `1` = Not ready, issues found

---

## 4. Status Documentation

**Path:** `ingest-service/SCRAPE_VALIDATOR_STATUS.md`

**Purpose:** Comprehensive status document tracking progress, deliverables, and communication.

**Contents:**
- Current infrastructure status
- All deliverables with locations
- Complete test plan (Tasks #5 and #6)
- Success criteria
- Communication log
- Expected timeline
- Next steps

---

## Usage Workflow

### For Docker Deployer:
1. Start services
2. Run `./docker/verify-cz-ready.sh`
3. If pass, notify scrape-validator
4. Mark Task #4 complete

### For Scrape Validator:
1. Receive confirmation from docker-deployer
2. Run `./ingest-service/test-checksum-scrape.sh`
3. Monitor automated execution
4. Capture results
5. Report to team-lead
6. Mark Tasks #5 and #6 complete

---

## Expected Results

### First Scrape
- Duration: 10-15 minutes
- Listings found: ~100,000
- New: 100% (all new on first run)
- Changed: 0%
- Unchanged: 0%
- Checksums stored: ~100,000

### Second Scrape
- Duration: 2-5 minutes (67-75% faster)
- Listings found: ~100,000
- New: 0.5-1% (~500-1,000)
- Changed: 4-9% (~4,000-9,000)
- Unchanged: 90-95% (~90,000-95,000) ← **TARGET**
- Detail fetches: ~5-10k (90-95% reduction)

### Success Criteria
✅ Second scrape completes 5-7x faster
✅ 90-95% of listings marked unchanged
✅ Only 5-10% require full detail fetch
✅ Bandwidth savings: 90-95%

---

## Monitoring Tips

### During First Scrape:
Watch for:
- Phase 1: Discovery (~100k listings)
- Phase 2: 100% new (expected)
- Phase 3: All queued for fetching
- Completion: "Scrape completed"

### During Second Scrape:
Watch for:
- Phase 1: Discovery (~100k listings)
- **Phase 2: 90-95% unchanged** ← CRITICAL
- Phase 3: Only ~5-10k queued
- Completion: Much faster

### Key Log Messages:
```
Phase 1: Discovered X listings
Phase 2: New: Y, Changed: Z, Unchanged: W
Savings: N% of listings unchanged
Phase 3: Queued M listings for fetching
Scrape completed successfully
```

---

## Troubleshooting

### Services Not Starting:
```bash
./docker/diagnose-cz-infrastructure.sh
```

### Scraper Fails:
```bash
docker logs scraper-cz-sreality --tail 50
```

### Database Issues:
```bash
docker exec postgres-cz psql -U landomo -d landomo_cz -c "\dt"
```

### API Not Responding:
```bash
curl -v http://localhost:3007/api/v1/health
curl -v http://localhost:8102/health
```

---

**Created by:** scrape-validator agent
**Date:** 2026-02-10
**Purpose:** Tasks #5 and #6 (Scrape testing and validation)
