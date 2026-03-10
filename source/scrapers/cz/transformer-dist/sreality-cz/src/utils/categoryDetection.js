"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCategoryFromSreality = detectCategoryFromSreality;
/**
 * Detect property category from SReality listing data
 *
 * Detection strategy:
 * 1. Primary: Use seo.category_main_cb (most reliable)
 * 2. Fallback: Parse title for Czech keywords
 * 3. Error: Throw if unable to determine
 */
function detectCategoryFromSreality(listing) {
    const categoryId = listing.seo?.category_main_cb;
    const subCategoryId = listing.seo?.category_sub_cb;
    // Primary detection: API category field
    if (categoryId === 1)
        return 'apartment'; // Byty
    if (categoryId === 2)
        return 'house'; // Domy
    if (categoryId === 3)
        return 'land'; // Pozemky
    // Category 4: Commercial properties (Komerční nemovitosti)
    if (categoryId === 4) {
        // Subcategories:
        // 25: Kanceláře (Offices) → commercial
        // 27: Výrobní haly (Industrial halls) → commercial
        // 28: Obchodní prostory (Retail spaces) → commercial
        // 29: Ubytovací zařízení (Hotels/Accommodation) → commercial
        // 31: Zemědělské objekty (Agricultural buildings) → commercial
        // 32: Komerční nemovitosti (General commercial) → commercial
        // 38: Činžovní domy (Apartment buildings) → commercial
        return 'commercial';
    }
    // Category 5: Other properties (Ostatní nemovitosti) - 1,240 listings
    if (categoryId === 5) {
        // Subcategories:
        // 34: Garáže (Garages) → other
        // 36: Specifický typ (Specific/Misc type) → other
        // 52: Garážová stání (Parking spaces) → other
        // 53: Mobilheimy (Mobile homes) → other (miscellaneous structures)
        return 'other';
    }
    // Fallback: Parse title for category keywords
    const titleStr = getStringOrValue(listing.name)?.toLowerCase() || '';
    // Land keywords: "pozemek", "parcela", "stavební pozemek"
    if (titleStr.includes('pozemek') || titleStr.includes('parcela')) {
        return 'land';
    }
    // House keywords: "dům", "rd" (rodinný dům), "vila"
    if (titleStr.includes('dům') || /\brd\b/.test(titleStr) || titleStr.includes('vila')) {
        return 'house';
    }
    // Apartment keywords: "byt", Czech disposition pattern (2+kk, 3+1)
    if (titleStr.includes('byt') || /\d\+(?:kk|1)/.test(titleStr)) {
        return 'apartment';
    }
    // Unable to detect - throw error with context
    throw new Error(`Unable to detect category for listing ${listing.hash_id}: ` +
        `category_main_cb=${categoryId}, category_sub_cb=${subCategoryId}, title="${titleStr}"`);
}
/**
 * Handle SReality fields that can be either a plain string or {value: string}
 */
function getStringOrValue(field) {
    if (!field)
        return undefined;
    if (typeof field === 'string')
        return field;
    if (typeof field === 'object' && field.value)
        return String(field.value);
    return undefined;
}
