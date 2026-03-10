import * as crypto from 'crypto';
import { Pool } from 'pg';

/**
 * Database-backed change detection using checksums
 * Stores checksums in PostgreSQL for persistence and manual control
 */

interface ListingChecksum {
  portal_id: string;
  checksum: string;
  last_seen_at: Date;
}

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'landomo_czech',
  user: process.env.DB_USER || 'landomo',
  password: process.env.DB_PASSWORD || 'landomo',
  max: 10, // Limit connections for scraper
});

const PORTAL = 'sreality';

/**
 * Calculate checksum for a listing to detect changes
 * Uses price, location, and key attributes that indicate a meaningful change
 */
export function calculateListingChecksum(listing: any): string {
  const relevantData = {
    price: listing.price,
    price_czk: listing.price_czk,
    locality: listing.locality,
    name: listing.name,
    seo: listing.seo?.locality,
  };

  return crypto
    .createHash('md5')
    .update(JSON.stringify(relevantData))
    .digest('hex');
}

/**
 * Load previously seen checksums from database
 */
async function loadChecksums(portalIds: string[]): Promise<Map<string, string>> {
  try {
    const result = await pool.query(
      `SELECT portal_id, checksum
       FROM listing_checksums
       WHERE portal = $1 AND portal_id = ANY($2)`,
      [PORTAL, portalIds]
    );

    const map = new Map<string, string>();
    result.rows.forEach((row: ListingChecksum) => {
      map.set(row.portal_id, row.checksum);
    });

    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Loaded cached checksums from database', count: map.size }));
    return map;
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to load checksums from database', err: (error as Error).message }));
    return new Map();
  }
}

/**
 * Save checksums to database (UPSERT)
 */
async function saveChecksums(checksums: Map<string, string>): Promise<void> {
  if (checksums.size === 0) return;

  try {
    // Batch UPSERT for performance
    const values: any[] = [];
    const entries = Array.from(checksums.entries());

    entries.forEach(([portalId, checksum], index) => {
      const offset = index * 3;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, NOW())`);
    });

    const params = entries.flatMap(([portalId, checksum]) => [PORTAL, portalId, checksum]);

    await pool.query(
      `INSERT INTO listing_checksums (portal, portal_id, checksum, last_seen_at)
       VALUES ${values.join(', ')}
       ON CONFLICT (portal, portal_id)
       DO UPDATE SET
         checksum = EXCLUDED.checksum,
         last_seen_at = EXCLUDED.last_seen_at`,
      params
    );

    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Saved checksums to database', count: checksums.size }));
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to save checksums to database', err: (error as Error).message }));
  }
}

/**
 * Detect which listings have changed since last run
 * Returns array of hash IDs that need detail fetching
 */
export async function detectChangedListings(listings: any[]): Promise<{
  newListings: number[];
  changedListings: number[];
  unchangedListings: number[];
  totalNew: number;
  totalChanged: number;
  totalUnchanged: number;
}> {
  const portalIds = listings.map(l => `${PORTAL}-${l.hash_id}`);
  const previousChecksums = await loadChecksums(portalIds);
  const currentChecksums = new Map<string, string>();

  const newListings: number[] = [];
  const changedListings: number[] = [];
  const unchangedListings: number[] = [];

  for (const listing of listings) {
    const hashId = listing.hash_id;
    const portalId = `${PORTAL}-${hashId}`;
    const currentChecksum = calculateListingChecksum(listing);

    currentChecksums.set(portalId, currentChecksum);

    const previousChecksum = previousChecksums.get(portalId);

    if (!previousChecksum) {
      // New listing
      newListings.push(hashId);
    } else if (previousChecksum !== currentChecksum) {
      // Changed listing
      changedListings.push(hashId);
    } else {
      // Unchanged listing
      unchangedListings.push(hashId);
    }
  }

  // Save current checksums for next run
  await saveChecksums(currentChecksums);

  return {
    newListings,
    changedListings,
    unchangedListings,
    totalNew: newListings.length,
    totalChanged: changedListings.length,
    totalUnchanged: unchangedListings.length
  };
}

/**
 * Clear checksums for this portal (for manual control)
 * Usage: await clearChecksumsCache()
 */
export async function clearChecksumsCache(): Promise<number> {
  try {
    const result = await pool.query(
      'DELETE FROM listing_checksums WHERE portal = $1',
      [PORTAL]
    );
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Cleared checksums', count: result.rowCount, portal: PORTAL }));
    return result.rowCount || 0;
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to clear checksums cache', err: (error as Error).message }));
    return 0;
  }
}

/**
 * Cleanup old checksums (older than N days)
 * Usage: await cleanupOldChecksums(30) // Delete checksums older than 30 days
 */
export async function cleanupOldChecksums(daysOld: number = 30): Promise<number> {
  try {
    const result = await pool.query(
      'SELECT cleanup_old_checksums($1, $2)',
      [PORTAL, daysOld]
    );
    const deletedCount = result.rows[0].cleanup_old_checksums;
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Cleaned up old checksums', count: deletedCount, daysOld }));
    return deletedCount;
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to cleanup old checksums', err: (error as Error).message }));
    return 0;
  }
}

/**
 * Close database pool (call on shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
