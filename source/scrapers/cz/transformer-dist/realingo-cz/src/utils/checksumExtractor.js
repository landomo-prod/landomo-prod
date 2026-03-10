"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRealingoChecksumFields = extractRealingoChecksumFields;
exports.createRealingoChecksum = createRealingoChecksum;
exports.batchCreateRealingoChecksums = batchCreateRealingoChecksums;
const core_1 = require("@landomo/core");
/**
 * Extract checksum fields from Realingo listing
 *
 * Working API fields for change detection:
 * - price.total (most frequent change)
 * - category (property type/disposition, e.g. "FLAT_2_KK")
 * - area.floor (usable area in sqm)
 * - price.note (price annotations)
 * - purpose (SELL/RENT)
 *
 * NON-EXISTENT fields (not in API): title, description, disposition,
 * bedrooms, bathrooms, features, location.city/district/coordinates
 */
function extractRealingoChecksumFields(offer) {
    return {
        price: offer.price?.total ?? null,
        title: offer.category ?? null,
        // updatedAt changes when the listing is modified on realingo
        description: offer.updatedAt ?? offer.url ?? null,
        sqm: offer.area?.floor ?? null,
        disposition: offer.category ?? null,
        purpose: offer.purpose ?? null,
    };
}
/**
 * Create checksum from Realingo offer
 */
function createRealingoChecksum(offer) {
    const rawId = offer.id;
    if (!rawId) {
        throw new Error('Offer missing id');
    }
    // Must match transformer portal_id format: `realingo-${offer.id}`
    const portalId = `realingo-${rawId}`;
    return (0, core_1.createListingChecksum)('realingo', portalId, offer, extractRealingoChecksumFields);
}
/**
 * Batch create checksum objects for multiple listings
 */
function batchCreateRealingoChecksums(offers) {
    return offers.map(createRealingoChecksum);
}
