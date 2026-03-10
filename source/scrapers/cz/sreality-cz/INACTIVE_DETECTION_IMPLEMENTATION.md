# Sreality Inactive Property Detection Implementation

## Overview

This implementation adds sophisticated detection for removed/inactive properties in the sreality scraper, using two mechanisms from the original implementation:

1. **HTTP 410 (Gone)** - Standard HTTP status for permanently removed resources
2. **JSON Response `{"logged_in": false}`** - Sreality-specific response indicating property is no longer available

## Changes Made

### 1. Scraper Side (sreality)

#### `src/utils/fetchData.ts`

**Added:**
- `EstateDetailResult` interface to return both data and inactive status
- Enhanced `fetchEstateDetail()` to detect and return inactive status

**Detection Logic:**
```typescript
export interface EstateDetailResult {
  data?: any;
  isInactive: boolean;
  inactiveReason?: 'http_410' | 'logged_in_false';
}

// HTTP 410 detection
if (axiosError.response?.status === 410) {
  return { isInactive: true, inactiveReason: 'http_410' };
}

// {"logged_in": false} detection
if (typeof data === 'string' && data.trim() === '{"logged_in": false}') {
  return { isInactive: true, inactiveReason: 'logged_in_false' };
}
```

#### `src/scrapers/listingsScraper.ts`

**Added:**
- `EnrichedListing` interface extending `SRealityListing` with `_inactive` and `_inactiveReason` fields
- Detection logic in `scrapeCategory()` to mark listings as inactive

**Detection Flow:**
```typescript
const detailResult = await fetchEstateDetail(estate.hash_id, userAgent);

if (detailResult.isInactive) {
  return {
    ...estate,
    _inactive: true,
    _inactiveReason: detailResult.inactiveReason
  };
}
```

#### `src/index.ts`

**Updated:**
- Transform logic to set `status: 'removed'` for inactive properties

```typescript
if (listing._inactive) {
  standardData.status = 'removed';
  console.log(`Marking property ${listing.hash_id} as removed (${listing._inactiveReason})`);
}
```

### 2. Ingest Service Side

#### `src/database/staleness-operations.ts`

**Added:**
- `recordScraperStatusChange()` - New function to handle status changes detected by scrapers
- Updated `openInitialStatusPeriod()` to accept initial status (defaults to 'active')

**Status Change Logic:**
```typescript
export async function recordScraperStatusChange(
  pool: Pool,
  propertyId: string,
  newStatus: 'active' | 'removed' | 'sold' | 'rented',
  reason: string
): Promise<void> {
  // 1. Close current open status period
  // 2. Insert new status history row
  // 3. Record in property_changes
}
```

#### `src/database/bulk-operations.ts`

**Updated:**
- Enhanced step 3a to create initial status periods with correct status (not just 'active')
- Enhanced step 3b to detect and record status changes from scrapers

**Status Change Detection:**
```typescript
// For each property update:
const newStatus = prop.data.status || 'active';

if (old.status !== newStatus) {
  await recordScraperStatusChange(
    pool,
    old.id,
    newStatus,
    'scraper_ingest'
  );
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    1. Sreality Scraper                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │  fetchEstateDetail(hash_id, userAgent)       │
     │  - Detects HTTP 410                          │
     │  - Detects {"logged_in": false}              │
     │  Returns: { isInactive: true, ... }          │
     └──────────────────────────────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │  listingsScraper.scrapeCategory()            │
     │  - Marks listing._inactive = true            │
     │  - Sets listing._inactiveReason              │
     └──────────────────────────────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │  index.ts - Transform & Send                 │
     │  - Sets standardData.status = 'removed'      │
     │  - Sends to ingest API                       │
     └──────────────────────────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────┐
│                  2. Ingest Service                     │
└────────────────────────────────────────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │  bulk-ingest route                           │
     │  - Accepts property with status field        │
     │  - Queues for processing                     │
     └──────────────────────────────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │  bulk-operations.ts                          │
     │  - Detects status change                     │
     │  - Calls recordScraperStatusChange()         │
     └──────────────────────────────────────────────┘
                            │
                            ▼
     ┌──────────────────────────────────────────────┐
     │  Database Updates                            │
     │  1. UPDATE properties SET status='removed'   │
     │  2. UPDATE listing_status_history            │
     │     SET ended_at=NOW()                       │
     │     WHERE ended_at IS NULL                   │
     │  3. INSERT listing_status_history            │
     │     (status='removed', reason='scraper_...')│
     │  4. INSERT property_changes                  │
     └──────────────────────────────────────────────┘
```

## Database Schema

The `listing_status_history` table tracks all status periods:

```sql
CREATE TABLE listing_status_history (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  status VARCHAR(20) CHECK (status IN ('active', 'removed', 'sold', 'rented')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,           -- NULL for current period
  reason VARCHAR(50)               -- 'scraper_ingest', 'staleness_check', 'manual'
);
```

## Example Status History

For a property that goes through lifecycle:

| id | property_id | status | started_at | ended_at | reason |
|----|-------------|--------|------------|----------|--------|
| 1  | abc-123     | active | 2026-01-01 | 2026-01-15 | scraper_ingest |
| 2  | abc-123     | removed | 2026-01-15 | 2026-01-20 | scraper_ingest |
| 3  | abc-123     | active | 2026-01-20 | 2026-02-01 | scraper_ingest |
| 4  | abc-123     | removed | 2026-02-01 | NULL | scraper_ingest |

## Testing

### Manual Testing

1. **Find a removed property:**
   ```bash
   # Try various hash_ids from sreality.cz
   curl https://www.sreality.cz/api/cs/v2/estates/123456789
   ```

2. **Expected responses for removed properties:**
   - HTTP 410 Gone
   - `{"logged_in": false}`

3. **Run the scraper and verify:**
   ```bash
   cd scrapers/Czech\ Republic/sreality
   npm run dev

   # Check logs for:
   # "Estate 123456789 is inactive (http_410)"
   # "Marking property 123456789 as removed (http_410)"
   ```

4. **Verify in database:**
   ```sql
   -- Check property status
   SELECT id, portal_id, status, last_seen_at
   FROM properties
   WHERE portal = 'sreality' AND portal_id = '123456789';

   -- Check status history
   SELECT status, started_at, ended_at, reason
   FROM listing_status_history
   WHERE property_id = (
     SELECT id FROM properties
     WHERE portal = 'sreality' AND portal_id = '123456789'
   )
   ORDER BY started_at DESC;
   ```

### Automated Testing

Run the test script:
```bash
cd scrapers/Czech\ Republic/sreality
npx ts-node test-inactive-detection.ts
```

## Benefits

1. **Accurate Lifecycle Tracking:** Property status changes are immediately detected and recorded
2. **Historical Data:** Full history of status periods maintained in `listing_status_history`
3. **No Delay:** Properties marked as removed immediately, not waiting for staleness check (72h)
4. **Audit Trail:** All status changes logged in `property_changes` with reason
5. **Reactivation Support:** Properties that return to active status handled automatically

## Comparison with Staleness Check

| Aspect | Scraper Detection | Staleness Check |
|--------|------------------|-----------------|
| **Detection Time** | Immediate | 72 hours |
| **Method** | HTTP 410 / API response | Last seen timestamp |
| **Accuracy** | Definitive (portal confirms) | Heuristic (assumes removed) |
| **Use Case** | Portal explicitly removed | Scraper failed to see property |
| **False Positives** | Very low | Protected by 30% circuit breaker |

## Monitoring

Key metrics to track:

```sql
-- Properties marked removed by scrapers (last 24h)
SELECT portal, COUNT(*)
FROM property_changes
WHERE change_type = 'status_change'
  AND changed_fields->>'new_status' = 'removed'
  AND changed_fields->>'reason' LIKE 'scraper_%'
  AND changed_at > NOW() - INTERVAL '24 hours'
GROUP BY portal;

-- Active vs removed properties per portal
SELECT portal, status, COUNT(*)
FROM properties
GROUP BY portal, status
ORDER BY portal, status;
```

## Future Enhancements

1. **Add metrics to Grafana:**
   - Inactive properties detected per day
   - HTTP 410 vs `{"logged_in": false}` breakdown
   - Average time between active and removed status

2. **Alerting:**
   - Alert if >10% of portal's properties marked removed in single scrape
   - Alert on unusual status change patterns

3. **Extended Detection:**
   - Detect `sold` and `rented` statuses from portal responses
   - Parse status from page content when available

## References

- Original implementation: `/Users/samuelseidel/Development/old/landomo/scrapers/sreality/src/functions/processPropertyDetail.ts`
- Migration 004: `ingest-service/migrations/004_listing_lifecycle.sql`
- CLAUDE.md: Project documentation
