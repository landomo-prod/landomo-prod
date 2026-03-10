"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractUlovDomovChecksumFields = extractUlovDomovChecksumFields;
exports.createUlovDomovChecksum = createUlovDomovChecksum;
exports.batchCreateUlovDomovChecksums = batchCreateUlovDomovChecksums;
const core_1 = require("@landomo/core");
function extractUlovDomovChecksumFields(offer) {
    const price = offer.rentalPrice?.value ?? null;
    const location = [offer.village?.title, offer.villagePart?.title].filter(Boolean).join(', ') || null;
    return {
        price,
        title: offer.title ?? null,
        description: location,
        sqm: offer.area ?? null,
        disposition: offer.disposition ?? null,
        floor: offer.floorLevel ?? null,
    };
}
function createUlovDomovChecksum(offer) {
    if (!offer.id)
        throw new Error('Offer missing id');
    return (0, core_1.createListingChecksum)('ulovdomov', String(offer.id), offer, extractUlovDomovChecksumFields);
}
function batchCreateUlovDomovChecksums(offers) {
    return offers.map(createUlovDomovChecksum);
}
