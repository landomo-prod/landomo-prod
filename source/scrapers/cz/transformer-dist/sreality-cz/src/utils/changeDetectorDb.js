"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateListingChecksum = calculateListingChecksum;
exports.detectChangedListings = detectChangedListings;
exports.clearChecksumsCache = clearChecksumsCache;
exports.cleanupOldChecksums = cleanupOldChecksums;
exports.closePool = closePool;
const crypto = __importStar(require("crypto"));
const pg_1 = require("pg");
// Database connection pool
const pool = new pg_1.Pool({
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
function calculateListingChecksum(listing) {
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
async function loadChecksums(portalIds) {
    try {
        const result = await pool.query(`SELECT portal_id, checksum
       FROM listing_checksums
       WHERE portal = $1 AND portal_id = ANY($2)`, [PORTAL, portalIds]);
        const map = new Map();
        result.rows.forEach((row) => {
            map.set(row.portal_id, row.checksum);
        });
        console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Loaded cached checksums from database', count: map.size }));
        return map;
    }
    catch (error) {
        console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to load checksums from database', err: error.message }));
        return new Map();
    }
}
/**
 * Save checksums to database (UPSERT)
 */
async function saveChecksums(checksums) {
    if (checksums.size === 0)
        return;
    try {
        // Batch UPSERT for performance
        const values = [];
        const entries = Array.from(checksums.entries());
        entries.forEach(([portalId, checksum], index) => {
            const offset = index * 3;
            values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, NOW())`);
        });
        const params = entries.flatMap(([portalId, checksum]) => [PORTAL, portalId, checksum]);
        await pool.query(`INSERT INTO listing_checksums (portal, portal_id, checksum, last_seen_at)
       VALUES ${values.join(', ')}
       ON CONFLICT (portal, portal_id)
       DO UPDATE SET
         checksum = EXCLUDED.checksum,
         last_seen_at = EXCLUDED.last_seen_at`, params);
        console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Saved checksums to database', count: checksums.size }));
    }
    catch (error) {
        console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to save checksums to database', err: error.message }));
    }
}
/**
 * Detect which listings have changed since last run
 * Returns array of hash IDs that need detail fetching
 */
async function detectChangedListings(listings) {
    const portalIds = listings.map(l => `${PORTAL}-${l.hash_id}`);
    const previousChecksums = await loadChecksums(portalIds);
    const currentChecksums = new Map();
    const newListings = [];
    const changedListings = [];
    const unchangedListings = [];
    for (const listing of listings) {
        const hashId = listing.hash_id;
        const portalId = `${PORTAL}-${hashId}`;
        const currentChecksum = calculateListingChecksum(listing);
        currentChecksums.set(portalId, currentChecksum);
        const previousChecksum = previousChecksums.get(portalId);
        if (!previousChecksum) {
            // New listing
            newListings.push(hashId);
        }
        else if (previousChecksum !== currentChecksum) {
            // Changed listing
            changedListings.push(hashId);
        }
        else {
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
async function clearChecksumsCache() {
    try {
        const result = await pool.query('DELETE FROM listing_checksums WHERE portal = $1', [PORTAL]);
        console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Cleared checksums', count: result.rowCount, portal: PORTAL }));
        return result.rowCount || 0;
    }
    catch (error) {
        console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to clear checksums cache', err: error.message }));
        return 0;
    }
}
/**
 * Cleanup old checksums (older than N days)
 * Usage: await cleanupOldChecksums(30) // Delete checksums older than 30 days
 */
async function cleanupOldChecksums(daysOld = 30) {
    try {
        const result = await pool.query('SELECT cleanup_old_checksums($1, $2)', [PORTAL, daysOld]);
        const deletedCount = result.rows[0].cleanup_old_checksums;
        console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Cleaned up old checksums', count: deletedCount, daysOld }));
        return deletedCount;
    }
    catch (error) {
        console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to cleanup old checksums', err: error.message }));
        return 0;
    }
}
/**
 * Close database pool (call on shutdown)
 */
async function closePool() {
    await pool.end();
}
