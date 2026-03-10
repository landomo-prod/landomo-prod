import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple change detection using checksums
 * Stores last-seen checksums in a JSON file for persistence
 */

interface ListingChecksum {
  hashId: number;
  checksum: string;
  lastSeen: string;
}

const CACHE_FILE = path.join(__dirname, '../../.listing-checksums.json');

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
    // Include key attributes that would indicate a real change
    seo: listing.seo?.locality,
  };

  return crypto
    .createHash('md5')
    .update(JSON.stringify(relevantData))
    .digest('hex');
}

/**
 * Load previously seen checksums from disk
 */
function loadChecksums(): Map<number, string> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      const checksums: ListingChecksum[] = JSON.parse(data);

      const map = new Map<number, string>();
      checksums.forEach(item => {
        map.set(item.hashId, item.checksum);
      });

      console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Loaded cached checksums from file', count: map.size, cacheFile: CACHE_FILE }));
      return map;
    }
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to load checksums cache', err: (error as Error).message }));
  }

  return new Map();
}

/**
 * Save checksums to disk for next run
 */
function saveChecksums(checksums: Map<number, string>): void {
  try {
    const data: ListingChecksum[] = Array.from(checksums.entries()).map(
      ([hashId, checksum]) => ({
        hashId,
        checksum,
        lastSeen: new Date().toISOString()
      })
    );

    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Saved checksums to file', count: data.length, cacheFile: CACHE_FILE }));
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to save checksums cache', err: (error as Error).message }));
  }
}

/**
 * Detect which listings have changed since last run
 * Returns array of hash IDs that need detail fetching
 */
export function detectChangedListings(listings: any[]): {
  newListings: number[];
  changedListings: number[];
  unchangedListings: number[];
  totalNew: number;
  totalChanged: number;
  totalUnchanged: number;
} {
  const previousChecksums = loadChecksums();
  const currentChecksums = new Map<number, string>();

  const newListings: number[] = [];
  const changedListings: number[] = [];
  const unchangedListings: number[] = [];

  for (const listing of listings) {
    const hashId = listing.hash_id;
    const currentChecksum = calculateListingChecksum(listing);

    currentChecksums.set(hashId, currentChecksum);

    const previousChecksum = previousChecksums.get(hashId);

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
  saveChecksums(currentChecksums);

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
 * Clear the checksums cache (for testing or full rescrape)
 */
export function clearChecksumsCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Cleared checksums cache' }));
    }
  } catch (error) {
    console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to clear checksums cache', err: (error as Error).message }));
  }
}
