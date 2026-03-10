"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRealityChecksumFields = extractRealityChecksumFields;
exports.createRealityChecksum = createRealityChecksum;
exports.batchCreateRealityChecksums = batchCreateRealityChecksums;
exports.extractListItemChecksumFields = extractListItemChecksumFields;
exports.createListItemChecksum = createListItemChecksum;
exports.batchCreateListItemChecksums = batchCreateListItemChecksums;
const core_1 = require("@landomo/core");
/**
 * Extract checksum fields from a full Reality.cz detail listing.
 * Used when we already have a fully-fetched RealityListing.
 */
function extractRealityChecksumFields(listing) {
    const disposition = listing.information.find(i => i.key === 'Dispozice')?.value ?? null;
    const sqmStr = listing.information.find(i => i.key === 'Plocha' || i.key === 'Užitná plocha')?.value;
    const sqm = sqmStr ? parseFloat(sqmStr.replace(/[^\d.,]/g, '').replace(',', '.')) || null : null;
    const floorStr = listing.information.find(i => i.key === 'Podlaží' || i.key === 'Patro')?.value;
    const floor = floorStr ? parseInt(floorStr) || null : null;
    return {
        price: listing.price ?? null,
        title: listing.title ?? null,
        description: listing.description ?? null,
        sqm,
        disposition,
        floor,
    };
}
function createRealityChecksum(listing) {
    const portalId = listing.id;
    if (!portalId)
        throw new Error('Listing missing id');
    return (0, core_1.createListingChecksum)('reality', portalId, listing, extractRealityChecksumFields);
}
function batchCreateRealityChecksums(listings) {
    return listings.map(createRealityChecksum);
}
/**
 * Extract checksum fields from a search result (RealityApiListItem).
 *
 * The search result already contains: id, type (encodes disposition + sqm),
 * place, and price — enough to detect any meaningful change without fetching
 * the detail page. This is the key to Phase 1 speed.
 */
function extractListItemChecksumFields(item) {
    const price = item.price?.sale?.price ?? item.price?.rent?.price ?? null;
    return {
        price,
        title: item.type ?? null, // "byt 2+1, 62 m², panel, osobní" - encodes disposition+sqm
        description: item.place ?? null,
        sqm: null,
        disposition: null,
        floor: null,
    };
}
function createListItemChecksum(item) {
    if (!item.id)
        throw new Error('ListItem missing id');
    return (0, core_1.createListingChecksum)('reality', item.id, item, extractListItemChecksumFields);
}
function batchCreateListItemChecksums(items) {
    return items.map(createListItemChecksum);
}
