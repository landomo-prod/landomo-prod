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
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CACHE_FILE = path.join(__dirname, '../../.listing-checksums.json');
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
function loadChecksums() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf-8');
            const checksums = JSON.parse(data);
            const map = new Map();
            checksums.forEach(item => {
                map.set(item.hashId, item.checksum);
            });
            console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Loaded cached checksums from file', count: map.size, cacheFile: CACHE_FILE }));
            return map;
        }
    }
    catch (error) {
        console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to load checksums cache', err: error.message }));
    }
    return new Map();
}
/**
 * Save checksums to disk for next run
 */
function saveChecksums(checksums) {
    try {
        const data = Array.from(checksums.entries()).map(([hashId, checksum]) => ({
            hashId,
            checksum,
            lastSeen: new Date().toISOString()
        }));
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
        console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Saved checksums to file', count: data.length, cacheFile: CACHE_FILE }));
    }
    catch (error) {
        console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to save checksums cache', err: error.message }));
    }
}
/**
 * Detect which listings have changed since last run
 * Returns array of hash IDs that need detail fetching
 */
function detectChangedListings(listings) {
    const previousChecksums = loadChecksums();
    const currentChecksums = new Map();
    const newListings = [];
    const changedListings = [];
    const unchangedListings = [];
    for (const listing of listings) {
        const hashId = listing.hash_id;
        const currentChecksum = calculateListingChecksum(listing);
        currentChecksums.set(hashId, currentChecksum);
        const previousChecksum = previousChecksums.get(hashId);
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
function clearChecksumsCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            fs.unlinkSync(CACHE_FILE);
            console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Cleared checksums cache' }));
        }
    }
    catch (error) {
        console.warn(JSON.stringify({ level: 'warn', service: 'sreality-scraper', msg: 'Failed to clear checksums cache', err: error.message }));
    }
}
