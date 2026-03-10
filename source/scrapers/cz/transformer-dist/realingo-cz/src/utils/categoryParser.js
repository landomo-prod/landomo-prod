"use strict";
/**
 * Parse Realingo category field to extract disposition and property details
 *
 * Examples:
 * - "FLAT4_KK" → { disposition: "4+kk", bedrooms: 3, rooms: 4 }
 * - "FLAT2_1" → { disposition: "2+1", bedrooms: 2, rooms: 3 }
 * - "HOUSE_FAMILY" → { subtype: "family" }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDisposition = parseDisposition;
exports.getPropertySubtype = getPropertySubtype;
/**
 * Extract disposition from category field
 * FLAT2_1 → 2+1, FLAT3_KK → 3+kk
 */
function parseDisposition(category) {
    if (!category)
        return {};
    const cat = category.toUpperCase();
    // FLAT6_AND_MORE → 6+kk (large apartments)
    const largeMatch = cat.match(/FLAT(\d+)_AND_MORE/);
    if (largeMatch) {
        const roomCount = parseInt(largeMatch[1]);
        return {
            disposition: `${roomCount}+kk`,
            rooms: roomCount + 1,
            bedrooms: roomCount
        };
    }
    // Apartment dispositions: FLAT2_1, FLAT21, FLAT3_KK, FLAT4_KK, FLAT51, etc.
    const flatMatch = cat.match(/FLAT(\d+?)_?(KK|1)$/);
    if (flatMatch) {
        const roomCount = parseInt(flatMatch[1]);
        const type = flatMatch[2];
        const disposition = type === 'KK' ? `${roomCount}+kk` : `${roomCount}+1`;
        return {
            disposition,
            rooms: roomCount + 1,
            bedrooms: roomCount
        };
    }
    // OTHERS_FLAT — generic flat without disposition
    if (cat === 'OTHERS_FLAT') {
        return { disposition: 'other' };
    }
    // House types: HOUSE_FAMILY, HOUSE_VILLA, etc.
    if (cat.startsWith('HOUSE_')) {
        const houseType = cat.replace('HOUSE_', '').toLowerCase();
        return {
            subtype: houseType
        };
    }
    // Land types: LAND_BUILDING, LAND_AGRICULTURAL, etc.
    if (cat.startsWith('LAND_')) {
        const landType = cat.replace('LAND_', '').toLowerCase();
        return {
            subtype: landType
        };
    }
    return {};
}
/**
 * Get property subtype from category
 */
function getPropertySubtype(category) {
    const info = parseDisposition(category);
    return info.subtype;
}
