"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformIdnesToStandard = transformIdnesToStandard;
const idnesApartmentTransformer_1 = require("./apartments/idnesApartmentTransformer");
const idnesHouseTransformer_1 = require("./houses/idnesHouseTransformer");
const idnesLandTransformer_1 = require("./land/idnesLandTransformer");
const idnesCommercialTransformer_1 = require("./commercial/idnesCommercialTransformer");
/**
 * Main Idnes transformer with category detection
 * Routes to category-specific transformer based on listing type
 */
function transformIdnesToStandard(listing) {
    const category = detectPropertyCategory(listing.propertyType, listing.title);
    switch (category) {
        case 'apartment':
            return (0, idnesApartmentTransformer_1.transformIdnesApartment)(listing);
        case 'house':
            return (0, idnesHouseTransformer_1.transformIdnesHouse)(listing);
        case 'land':
            return (0, idnesLandTransformer_1.transformIdnesLand)(listing);
        case 'commercial':
            return (0, idnesCommercialTransformer_1.transformIdnesCommercial)(listing);
        default:
            throw new Error(`Unsupported category: ${category}`);
    }
}
/**
 * Detect property category for routing to category-specific tables
 */
function detectPropertyCategory(propertyType, title) {
    const searchText = `${propertyType || ''} ${title || ''}`.toLowerCase();
    // Land detection
    if (searchText.includes('land') || searchText.includes('pozemek') || searchText.includes('parcela')) {
        return 'land';
    }
    // Commercial detection
    if (searchText.includes('commercial') || searchText.includes('komercni') || searchText.includes('komerční') ||
        searchText.includes('kancelář') || searchText.includes('kancelar') || searchText.includes('obchod') ||
        searchText.includes('sklad') || searchText.includes('prodejna') || searchText.includes('hala')) {
        return 'commercial';
    }
    // House detection (includes recreation/chata/chalupa)
    if (searchText.includes('house') || searchText.includes('dům') || searchText.includes('dum') ||
        searchText.includes('rodinný') || searchText.includes('rodinny') || /\brd\b/.test(searchText) ||
        searchText.includes('recreation') || searchText.includes('other') ||
        searchText.includes('chata') || searchText.includes('chalupa') || searchText.includes('rekreační')) {
        return 'house';
    }
    // Apartment detection (default for most Czech listings)
    if (searchText.includes('apartment') || searchText.includes('byt') || searchText.includes('flat') ||
        /\d\+(?:kk|1)/.test(searchText)) {
        return 'apartment';
    }
    // Default to apartment (most common in Czech Republic)
    return 'apartment';
}
