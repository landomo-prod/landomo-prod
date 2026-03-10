"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBezrealitkyChecksumFields = extractBezrealitkyChecksumFields;
exports.createBezrealitkyChecksum = createBezrealitkyChecksum;
exports.batchCreateBezrealitkyChecksums = batchCreateBezrealitkyChecksums;
const core_1 = require("@landomo/core");
/**
 * Extract checksum fields from BezRealitky listing data
 *
 * This extracts ONLY the fields that should trigger a re-fetch when changed:
 * - price (main trigger for updates)
 * - title (property name changes)
 * - description (rare but possible)
 * - sqm (surface area changes)
 * - disposition (Czech room layout like "2+kk", "3+1")
 * - floor (floor level changes)
 *
 * Other fields like images, agent info, metadata, etc. don't warrant re-fetching
 */
function extractBezrealitkyChecksumFields(listing) {
    return {
        price: listing.price ?? null,
        title: listing.title ?? null,
        description: listing.description ?? null,
        sqm: listing.surface ?? null,
        // Use custom fields for Czech-specific data (disposition is string like "2+kk")
        disposition: listing.disposition ?? null,
        floor: listing.floor ?? null,
    };
}
/**
 * Create checksum from BezRealitky listing
 *
 * @param listing - Raw BezRealitky listing from GraphQL API
 * @returns ListingChecksum ready to send to ingest API
 *
 * @example
 * const checksum = createBezrealitkyChecksum(listing);
 * // { portal: 'bezrealitky', portalId: '12345', contentHash: 'abc...' }
 */
function createBezrealitkyChecksum(listing) {
    const portalId = listing.id;
    if (!portalId) {
        throw new Error('Listing missing id');
    }
    return (0, core_1.createListingChecksum)('bezrealitky', portalId, listing, extractBezrealitkyChecksumFields);
}
/**
 * Batch create checksums from BezRealitky listings
 *
 * @param listings - Array of raw BezRealitky listings
 * @returns Array of checksums ready for comparison
 *
 * @example
 * const listings = await fetchAllListingPages();
 * const checksums = batchCreateBezrealitkyChecksums(listings);
 * const comparison = await checksumClient.compareChecksums(checksums);
 */
function batchCreateBezrealitkyChecksums(listings) {
    return listings.map(createBezrealitkyChecksum);
}
