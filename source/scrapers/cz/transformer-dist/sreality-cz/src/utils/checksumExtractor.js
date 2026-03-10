"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSRealityChecksumFields = extractSRealityChecksumFields;
exports.createSRealityChecksum = createSRealityChecksum;
exports.batchCreateSRealityChecksums = batchCreateSRealityChecksums;
const core_1 = require("@landomo/core");
/**
 * Extract checksum fields from SReality listing page data
 *
 * This extracts ONLY the fields that should trigger a re-fetch when changed:
 * - price (main trigger for updates)
 * - title (property name changes)
 * - description (rare but possible)
 * - bedrooms/bathrooms (size changes)
 * - sqm (area changes)
 *
 * Other fields like images, agent info, etc. don't warrant re-fetching
 */
function extractSRealityChecksumFields(listing) {
    return {
        price: listing.price_czk?.value_raw ?? null,
        title: listing.name ?? null,
        description: listing.text?.value ?? null,
        bedrooms: listing.items?.find((i) => i.name === 'number_of_rooms')?.value ?? null,
        bathrooms: listing.items?.find((i) => i.name === 'number_of_bathrooms')?.value ?? null,
        sqm: listing.usable_area ?? null,
    };
}
/**
 * Create checksum from SReality listing
 *
 * @param listing - Raw SReality listing from API
 * @returns ListingChecksum ready to send to ingest API
 *
 * @example
 * const checksum = createSRealityChecksum(listing);
 * // { portal: 'sreality', portalId: '12345', contentHash: 'abc...' }
 */
function createSRealityChecksum(listing) {
    const rawId = listing.hash_id?.toString() ?? listing._id?.toString();
    if (!rawId) {
        throw new Error('Listing missing hash_id and _id');
    }
    // Must match transformer portal_id format: `sreality-${hashId}`
    const portalId = `sreality-${rawId}`;
    return (0, core_1.createListingChecksum)('sreality', portalId, listing, extractSRealityChecksumFields);
}
/**
 * Batch create checksums from SReality listings
 *
 * @param listings - Array of raw SReality listings
 * @returns Array of checksums ready for comparison
 *
 * @example
 * const listings = await fetchAllListingPages(category);
 * const checksums = batchCreateSRealityChecksums(listings);
 * const comparison = await checksumClient.compareChecksums(checksums);
 */
function batchCreateSRealityChecksums(listings) {
    return listings.map(createSRealityChecksum);
}
