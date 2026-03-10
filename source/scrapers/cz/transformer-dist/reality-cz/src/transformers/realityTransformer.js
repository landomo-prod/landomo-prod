"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRealityToStandard = transformRealityToStandard;
const apartmentTransformer_1 = require("./apartments/apartmentTransformer");
const houseTransformer_1 = require("./houses/houseTransformer");
const landTransformer_1 = require("./land/landTransformer");
const commercialTransformer_1 = require("./commercial/commercialTransformer");
/**
 * Main Reality.cz transformer with category detection
 * Routes to category-specific transformer based on API type field
 *
 * Current status:
 * - Apartments: Category-specific transformer (Tier I) ✅
 * - Houses: Category-specific transformer (Tier I) ✅
 * - Land: Category-specific transformer (Tier I) ✅
 * - Commercial: Category-specific transformer (Tier I) ✅
 */
function transformRealityToStandard(listing) {
    const category = detectPropertyCategory(listing.api_type, listing.title);
    switch (category) {
        case 'apartment':
            return (0, apartmentTransformer_1.transformRealityApartment)(listing);
        case 'house':
            return (0, houseTransformer_1.transformRealityHouse)(listing);
        case 'land':
            return (0, landTransformer_1.transformRealityLand)(listing);
        case 'commercial':
            return (0, commercialTransformer_1.transformRealityCommercial)(listing);
        default:
            throw new Error(`Unsupported category: ${category}`);
    }
}
/**
 * Detect property category from API type field
 * API types: "flat", "house", "land", "commercial", etc.
 * Falls back to title-based detection if type is unknown
 */
function detectPropertyCategory(apiType, title) {
    // Primary: use API type field (descriptive strings like "byt 2+1, 62 m², panel, osobní")
    if (apiType) {
        const t = apiType.toLowerCase();
        // Commercial keywords (check first - most specific)
        if (t.includes('kancelář') || t.includes('kancelar') || t.includes('office'))
            return 'commercial';
        if (t.includes('sklad') || t.includes('warehouse'))
            return 'commercial';
        if (t.includes('průmysl') || t.includes('industrial'))
            return 'commercial';
        if (t.includes('hotel') || t.includes('restaurant') || t.includes('restaurace'))
            return 'commercial';
        if (t.includes('obchod') || t.includes('retail'))
            return 'commercial';
        if (t.includes('bytový dům'))
            return 'commercial';
        // Apartment: "byt" or disposition pattern like "2+kk", "3+1"
        if (t.includes('byt') || /^\d\+(?:kk|\d)/.test(t))
            return 'apartment';
        // House: "dům", "rodinný", "chalupa", "chata", "vila", "venkovské stavení"
        if (t.includes('dům') || t.includes('dum') || t.includes('rodinný') || t.includes('rodinny') ||
            t.includes('chalupa') || t.includes('chata') || t.includes('vila') ||
            t.includes('venkovsk') || t.includes('rekreace') || t.includes('cottage'))
            return 'house';
        // Land: "pozemek", "parcela" (only if not already matched as house with plot)
        if (t.includes('pozemek') || t.includes('parcela'))
            return 'land';
    }
    // Fallback: title-based detection
    const searchText = (title || '').toLowerCase();
    if (searchText.includes('kancelář') || searchText.includes('kancelar') ||
        searchText.includes('sklad') || searchText.includes('výrob') ||
        searchText.includes('obchod') || searchText.includes('restaurace') ||
        searchText.includes('hotel')) {
        return 'commercial';
    }
    if (searchText.includes('byt') || /\d\+(?:kk|1)/.test(searchText)) {
        return 'apartment';
    }
    if (searchText.includes('dům') || searchText.includes('dum') ||
        searchText.includes('rodinný') || searchText.includes('rodinny')) {
        return 'house';
    }
    if (searchText.includes('pozemek') || searchText.includes('parcela')) {
        return 'land';
    }
    // Default to apartment (most common in Czech Republic)
    return 'apartment';
}
