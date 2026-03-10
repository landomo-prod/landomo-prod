"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRealingoToStandard = transformRealingoToStandard;
const realingoApartmentTransformer_1 = require("./apartments/realingoApartmentTransformer");
const realingoHouseTransformer_1 = require("./houses/realingoHouseTransformer");
const realingoLandTransformer_1 = require("./land/realingoLandTransformer");
const realingoCommercialTransformer_1 = require("./commercial/realingoCommercialTransformer");
const realingoOthersTransformer_1 = require("./others/realingoOthersTransformer");
/**
 * Main Realingo transformer with category detection
 * Routes to category-specific transformer based on listing type
 *
 * Current status:
 * - Apartments: ✅ Category-specific transformer (Tier I)
 * - Houses: ✅ Category-specific transformer (Tier I)
 * - Land: ✅ Category-specific transformer (Tier I)
 * - Commercial: ✅ Category-specific transformer (Tier I)
 * - Others: ✅ Category-specific transformer (Tier I)
 */
function transformRealingoToStandard(offer) {
    // Route based on property type directly for COMMERCIAL and OTHERS
    if (offer.property === 'COMMERCIAL') {
        return (0, realingoCommercialTransformer_1.transformRealingoCommercial)(offer);
    }
    if (offer.property === 'OTHERS') {
        return (0, realingoOthersTransformer_1.transformRealingoOthers)(offer);
    }
    // For FLAT, HOUSE, LAND, use category detection
    const category = detectPropertyCategory(offer.property, offer.category);
    switch (category) {
        case 'apartment':
            return (0, realingoApartmentTransformer_1.transformRealingoApartment)(offer);
        case 'house':
            return (0, realingoHouseTransformer_1.transformRealingoHouse)(offer);
        case 'land':
            return (0, realingoLandTransformer_1.transformRealingoLand)(offer);
        default:
            throw new Error(`Unsupported category: ${category}`);
    }
}
/**
 * Detect property category for routing to category-specific tables
 * Returns: 'apartment' | 'house' | 'land'
 */
function detectPropertyCategory(propertyType, category) {
    const searchText = `${propertyType || ''} ${category || ''}`.toLowerCase();
    // Land detection
    if (propertyType === 'LAND' || searchText.includes('land') || searchText.includes('pozemek')) {
        return 'land';
    }
    // House detection
    if (propertyType === 'HOUSE' || searchText.includes('house') || searchText.includes('family')) {
        return 'house';
    }
    // Apartment detection (default for most Czech listings)
    if (searchText.includes('apartment') || searchText.includes('byt') || searchText.includes('flat') ||
        searchText.includes('flat') || /\d\+(?:kk|1)/.test(searchText)) {
        return 'apartment';
    }
    // Default to apartment (most common in Czech Republic)
    return 'apartment';
}
