"use strict";
/**
 * Bazos Checksum Extractor
 *
 * Generates checksums from Bazos listing titles to prevent
 * redundant LLM extractions on unchanged listings.
 *
 * Key difference from other scrapers:
 * - Bazos only has title text (no description in API response)
 * - LLM extraction is costly ($0.000634/listing)
 * - Checksum prevents re-extraction when title unchanged
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBazosChecksumFields = extractBazosChecksumFields;
exports.createBazosChecksum = createBazosChecksum;
exports.batchCreateBazosChecksums = batchCreateBazosChecksums;
const core_1 = require("@landomo/core");
/**
 * Extract checksum fields from Bazos listing
 *
 * Only uses title since that's all we have for LLM extraction
 */
function extractBazosChecksumFields(listing) {
    return {
        title: listing.title ?? null,
        // Note: Bazos API doesn't provide description in list endpoint
        // LLM extracts all property details from title alone
    };
}
/**
 * Create checksum for single Bazos listing
 *
 * @param listing - Bazos ad from API
 * @returns Checksum object with portal_id and hash
 * @throws Error if listing.id is missing
 */
function createBazosChecksum(listing) {
    const portalId = listing.id;
    if (!portalId) {
        throw new Error('Bazos listing missing id field');
    }
    return (0, core_1.createListingChecksum)('bazos', portalId, listing, extractBazosChecksumFields);
}
/**
 * Batch create checksums for multiple Bazos listings
 *
 * @param listings - Array of Bazos ads
 * @returns Array of checksums
 */
function batchCreateBazosChecksums(listings) {
    return listings
        .filter(listing => listing.id) // Skip listings without ID
        .map(createBazosChecksum);
}
