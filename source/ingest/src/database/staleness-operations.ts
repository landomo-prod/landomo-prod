/**
 * Staleness & Lifecycle Database Operations
 * Functions for managing listing status history, staleness detection,
 * and scrape run tracking.
 */

import { Pool } from 'pg';
import { stalenessLog } from '../logger';
import { promoteNextCanonical, PartitionTable } from './dedup-operations';

const CATEGORY_TABLE_MAP: Record<string, PartitionTable> = {
  apartment: 'properties_apartment',
  house: 'properties_house',
  land: 'properties_land',
  commercial: 'properties_commercial',
};

/**
 * Append a new status period to a property's status_history JSONB column.
 * Closes the last open period (to = null) before opening the new one.
 * Also writes to the listing_status_history table for SQL-queryable history.
 */
async function appendStatusHistory(pool: Pool | import('pg').PoolClient, propertyId: string, newStatus: string, reason?: string): Promise<void> {
  const q = pool as any;

  // 1. Update JSONB column (existing behavior)
  await q.query(
    `UPDATE properties
     SET status_history = CASE
       WHEN status_history IS NULL OR jsonb_array_length(status_history) = 0 THEN
         jsonb_build_array(jsonb_build_object('status', $2::text, 'from', to_jsonb(NOW()), 'to', to_jsonb(NULL::text)))
       WHEN (status_history->-1->>'to') IS NULL THEN
         jsonb_set(
           status_history,
           ARRAY[(jsonb_array_length(status_history) - 1)::text, 'to'],
           to_jsonb(NOW())
         ) || jsonb_build_array(jsonb_build_object('status', $2::text, 'from', to_jsonb(NOW()), 'to', to_jsonb(NULL::text)))
       ELSE
         status_history || jsonb_build_array(jsonb_build_object('status', $2::text, 'from', to_jsonb(NOW()), 'to', to_jsonb(NULL::text)))
     END
     WHERE id = $1`,
    [propertyId, newStatus]
  );

  // 2. Close the previous open period in listing_status_history table
  await q.query(
    `UPDATE listing_status_history SET ended_at = NOW()
     WHERE property_id = $1 AND ended_at IS NULL`,
    [propertyId]
  );

  // 3. Open new period in listing_status_history table
  await q.query(
    `INSERT INTO listing_status_history (property_id, status, started_at, reason)
     VALUES ($1, $2, NOW(), $3)`,
    [propertyId, newStatus, reason || null]
  );
}

export interface StalenessResult {
  markedRemoved: number;
  duration: number;
  skippedPortals: string[];
}

export interface ScrapeRunStats {
  listings_found: number;
  listings_new: number;
  listings_updated: number;
}

/**
 * Mark stale active properties as removed.
 * Uses per-portal threshold overrides from staleness_thresholds table,
 * falling back to the default threshold.
 *
 * Circuit breaker: only processes portals that had a successfully completed
 * scrape run within 2× the threshold window. If the scraper is broken (no
 * recent completed run), listings are NOT marked removed — preventing false
 * removals from outages. Unlike a percentage threshold, this correctly handles
 * genuine mass deactivations where >30% of listings really did disappear.
 */
export async function markStalePropertiesRemoved(
  pool: Pool,
  defaultThresholdHours: number,
  batchSize: number
): Promise<StalenessResult> {
  const startTime = Date.now();
  let markedRemoved = 0;
  const skippedPortals: string[] = [];

  // --- Find all portals with stale active listings ---
  // Use listing_checksums.last_seen_at as the freshness signal, not properties.last_seen_at.
  // This is critical for checksum-based scrapers: unchanged listings are skipped during ingest
  // (so properties.last_seen_at is never updated), but the checksum endpoint updates
  // listing_checksums.last_seen_at for ALL listings — including unchanged ones.
  // Joining here means a listing is only considered stale if its checksum was also not
  // refreshed within the threshold window.
  const portalStatsResult = await pool.query(
    `SELECT
       p.portal,
       COUNT(*) FILTER (
         WHERE GREATEST(p.last_seen_at, COALESCE(lc.last_seen_at, p.last_seen_at))
               < NOW() - INTERVAL '1 hour' * COALESCE(st.threshold_hours, $1)
       ) AS stale_count
     FROM properties p
     LEFT JOIN listing_checksums lc ON lc.portal = p.portal AND lc.portal_id = p.portal_id
     LEFT JOIN staleness_thresholds st ON st.portal = p.portal
     WHERE p.status = 'active'
     GROUP BY p.portal
     HAVING COUNT(*) FILTER (
       WHERE GREATEST(p.last_seen_at, COALESCE(lc.last_seen_at, p.last_seen_at))
             < NOW() - INTERVAL '1 hour' * COALESCE(st.threshold_hours, $1)
     ) > 0`,
    [defaultThresholdHours]
  );

  if (portalStatsResult.rows.length === 0) {
    const duration = Date.now() - startTime;
    stalenessLog.info({ durationMs: duration }, 'Staleness check: no stale listings found');
    return { markedRemoved, duration, skippedPortals };
  }

  const portalsWithStale = portalStatsResult.rows.map((r: { portal: string }) => r.portal);

  // --- Circuit breaker: only allow portals with a recent successful scrape run ---
  // If a scraper is broken, it won't have a completed run → we skip to avoid false removals.
  // If listings genuinely disappeared, the scraper ran successfully → we proceed (no % limit).
  const recentRunWindow = defaultThresholdHours * 2;
  const lastRunResult = await pool.query(
    `SELECT DISTINCT ON (portal) portal, status, finished_at
     FROM scrape_runs
     WHERE portal = ANY($1)
       AND status = 'completed'
       AND finished_at > NOW() - INTERVAL '1 hour' * $2
     ORDER BY portal, finished_at DESC`,
    [portalsWithStale, recentRunWindow]
  );

  const portalsWithRecentRun = new Set(lastRunResult.rows.map((r: { portal: string }) => r.portal));

  const allowedPortals: string[] = [];
  for (const row of portalStatsResult.rows) {
    if (!portalsWithRecentRun.has(row.portal)) {
      stalenessLog.warn({
        portal: row.portal,
        staleCount: parseInt(row.stale_count, 10),
        windowHours: recentRunWindow,
      }, 'Circuit breaker: skipping portal — no completed scrape run within window');
      skippedPortals.push(row.portal);
    } else {
      allowedPortals.push(row.portal);
    }
  }

  if (allowedPortals.length === 0) {
    const duration = Date.now() - startTime;
    stalenessLog.info({ skippedPortals: skippedPortals.length, durationMs: duration }, 'Staleness check: all portals skipped (no recent runs)');
    return { markedRemoved, duration, skippedPortals };
  }

  // --- Process only allowed portals ---
  const portalList = allowedPortals;
  let hasMore = true;

  while (hasMore) {
    const staleResult = await pool.query(
      `SELECT p.id, p.portal, p.portal_id
       FROM properties p
       LEFT JOIN listing_checksums lc ON lc.portal = p.portal AND lc.portal_id = p.portal_id
       LEFT JOIN staleness_thresholds st ON st.portal = p.portal
       WHERE p.status = 'active'
         AND p.portal = ANY($3)
         AND GREATEST(p.last_seen_at, COALESCE(lc.last_seen_at, p.last_seen_at))
             < NOW() - INTERVAL '1 hour' * COALESCE(st.threshold_hours, $1)
       LIMIT $2`,
      [defaultThresholdHours, batchSize, portalList]
    );

    if (staleResult.rows.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of staleResult.rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Update property status to removed.
        // Re-check freshness against GREATEST(properties.last_seen_at, listing_checksums.last_seen_at)
        // to avoid a race with concurrent ingestion or checksum updates.
        const updateResult = await client.query(
          `UPDATE properties p SET status = 'removed', updated_at = NOW()
           FROM (
             SELECT GREATEST(p2.last_seen_at, COALESCE(lc.last_seen_at, p2.last_seen_at)) AS effective_last_seen
             FROM properties p2
             LEFT JOIN listing_checksums lc ON lc.portal = p2.portal AND lc.portal_id = p2.portal_id
             WHERE p2.id = $1
           ) freshness,
           (SELECT COALESCE(st.threshold_hours, $2) AS threshold_hours
            FROM (SELECT 1) dummy
            LEFT JOIN staleness_thresholds st ON st.portal = $3) thresholds
           WHERE p.id = $1
             AND p.status = 'active'
             AND freshness.effective_last_seen < NOW() - INTERVAL '1 hour' * thresholds.threshold_hours
           RETURNING p.id`,
          [row.id, defaultThresholdHours, row.portal]
        );

        // If the property was updated by ingestion since our query, skip it
        if (updateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          continue;
        }

        // Append 'removed' period to status_history JSONB + listing_status_history table
        await appendStatusHistory(client, row.id, 'removed', 'staleness');

        // If this was a canonical property, promote next-best active duplicate
        try {
          const catResult = await client.query(
            `SELECT property_category FROM properties WHERE id = $1`, [row.id]
          );
          const category = catResult.rows[0]?.property_category;
          const table = CATEGORY_TABLE_MAP[category];
          if (table) {
            await promoteNextCanonical(row.id, table, client);
          }
        } catch (cascadeErr) {
          stalenessLog.warn({ err: cascadeErr, propertyId: row.id }, 'Failed to promote next canonical after removal');
        }

        await client.query('COMMIT');
        markedRemoved++;
      } catch (error) {
        await client.query('ROLLBACK');
        stalenessLog.error({ err: error, propertyId: row.id, portal: row.portal }, 'Failed to mark property as removed');
      } finally {
        client.release();
      }
    }

    // If we got fewer than batchSize, we're done
    if (staleResult.rows.length < batchSize) {
      hasMore = false;
    }
  }

  const duration = Date.now() - startTime;
  stalenessLog.info({
    markedRemoved,
    skippedPortals: skippedPortals.length,
    durationMs: duration,
  }, 'Staleness check complete');

  return { markedRemoved, duration, skippedPortals };
}

/**
 * Reactivate a previously removed property (seen again by scraper).
 * Closes the current "removed" period and opens a new "active" period.
 */
export async function reactivateProperty(
  pool: Pool,
  propertyId: string,
  portal: string,
  portalId: string
): Promise<void> {
  await appendStatusHistory(pool, propertyId, 'active', 'reactivated');
}

/**
 * Open the initial "active" status period for a newly inserted property.
 * If status is provided (e.g., 'removed'), use that instead of 'active'.
 */
export async function openInitialStatusPeriod(
  pool: Pool,
  propertyId: string,
  status: 'active' | 'removed' | 'sold' | 'rented' = 'active'
): Promise<void> {
  // Initialize status_history for a newly inserted property.
  // The DEFAULT '[]' column is already set; this sets the first real period.
  await pool.query(
    `UPDATE properties
     SET status_history = jsonb_build_array(
       jsonb_build_object('status', $2::text, 'from', to_jsonb(NOW()), 'to', to_jsonb(NULL::text))
     )
     WHERE id = $1 AND status_history = '[]'::jsonb`,
    [propertyId, status]
  );

  // Also write to listing_status_history table
  await pool.query(
    `INSERT INTO listing_status_history (property_id, status, started_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT DO NOTHING`,
    [propertyId, status]
  );
}

/**
 * Bulk version of openInitialStatusPeriod — one query per distinct status value
 * instead of one query per property. Typically just one UPDATE for all 'active' properties.
 */
export async function bulkOpenInitialStatusPeriods(
  pool: Pool,
  entries: Array<{ id: string; status: 'active' | 'removed' | 'sold' | 'rented' }>
): Promise<void> {
  if (entries.length === 0) return;
  // Group by status (almost always a single group: 'active')
  const byStatus = new Map<string, string[]>();
  for (const { id, status } of entries) {
    const group = byStatus.get(status) ?? [];
    group.push(id);
    byStatus.set(status, group);
  }
  for (const [status, ids] of byStatus) {
    // Update JSONB column
    await pool.query(
      `UPDATE properties
       SET status_history = jsonb_build_array(
         jsonb_build_object('status', $1::text, 'from', to_jsonb(NOW()), 'to', to_jsonb(NULL::text))
       )
       WHERE id = ANY($2::uuid[]) AND status_history = '[]'::jsonb`,
      [status, ids]
    );

    // Bulk insert into listing_status_history table
    const values: string[] = [];
    const params: unknown[] = [status];
    for (let i = 0; i < ids.length; i++) {
      values.push(`($${i + 2}::uuid, $1, NOW())`);
      params.push(ids[i]);
    }
    await pool.query(
      `INSERT INTO listing_status_history (property_id, status, started_at)
       VALUES ${values.join(', ')}
       ON CONFLICT DO NOTHING`,
      params
    );
  }
}

/**
 * Record a status change from scraper detection (e.g., HTTP 410 or {"logged_in": false}).
 * Closes the current status period and opens a new one with the detected status.
 */
export async function recordScraperStatusChange(
  pool: Pool,
  propertyId: string,
  newStatus: 'active' | 'removed' | 'sold' | 'rented',
  reason: string
): Promise<void> {
  await appendStatusHistory(pool, propertyId, newStatus, reason);
}

/**
 * Reap orphaned scrape runs that have been stuck in 'running' for >4 hours.
 * These are likely from crashed scrapers that never reported completion.
 */
export async function reapOrphanedRuns(pool: Pool): Promise<number> {
  const result = await pool.query(
    `UPDATE scrape_runs SET status = 'failed', finished_at = NOW()
     WHERE status = 'running' AND started_at < NOW() - INTERVAL '4 hours'
     RETURNING id, portal`
  );

  if (result.rows.length > 0) {
    stalenessLog.warn({
      count: result.rows.length,
      runs: result.rows.map((r: { id: string; portal: string }) => ({ portal: r.portal, id: r.id })),
    }, 'Reaped orphaned scrape runs');
  }

  return result.rows.length;
}

/**
 * Start a scrape run and return the run ID.
 * Returns null if a run for the same portal is already in progress (overlap guard).
 */
export async function startScrapeRun(
  pool: Pool,
  portal: string
): Promise<string | null> {
  // Overlap guard: check if a run for this portal is already running
  const existing = await pool.query(
    `SELECT id FROM scrape_runs WHERE portal = $1 AND status = 'running' LIMIT 1`,
    [portal]
  );

  if (existing.rows.length > 0) {
    return null;
  }

  const result = await pool.query(
    `INSERT INTO scrape_runs (portal, started_at, status)
     VALUES ($1, NOW(), 'running')
     RETURNING id`,
    [portal]
  );
  return result.rows[0].id;
}

/**
 * Complete a scrape run with stats.
 */
export async function completeScrapeRun(
  pool: Pool,
  runId: string,
  stats: ScrapeRunStats
): Promise<void> {
  await pool.query(
    `UPDATE scrape_runs
     SET finished_at = NOW(),
         listings_found = $2,
         listings_new = $3,
         listings_updated = $4,
         status = 'completed'
     WHERE id = $1`,
    [runId, stats.listings_found, stats.listings_new, stats.listings_updated]
  );
}

/**
 * Mark a scrape run as failed.
 */
export async function failScrapeRun(
  pool: Pool,
  runId: string
): Promise<void> {
  await pool.query(
    `UPDATE scrape_runs SET finished_at = NOW(), status = 'failed' WHERE id = $1`,
    [runId]
  );
}
