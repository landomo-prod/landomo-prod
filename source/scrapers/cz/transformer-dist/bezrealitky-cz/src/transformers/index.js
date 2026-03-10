"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCategory = void 0;
exports.transformBezRealitkyToStandard = transformBezRealitkyToStandard;
const categoryDetector_1 = require("../utils/categoryDetector");
Object.defineProperty(exports, "detectCategory", { enumerable: true, get: function () { return categoryDetector_1.detectCategory; } });
const apartmentTransformer_1 = require("./apartments/apartmentTransformer");
const houseTransformer_1 = require("./houses/houseTransformer");
const landTransformer_1 = require("./land/landTransformer");
const commercialTransformer_1 = require("./commercial/commercialTransformer");
/**
 * Main Transformer Entry Point
 *
 * Routes to category-specific transformers based on estateType
 */
function transformBezRealitkyToStandard(listing) {
    const category = (0, categoryDetector_1.detectCategory)(listing);
    let result;
    switch (category) {
        case 'apartment':
            result = (0, apartmentTransformer_1.transformBezrealitkyApartment)(listing);
            break;
        case 'house':
            result = (0, houseTransformer_1.transformBezrealitkyHouse)(listing);
            break;
        case 'land':
            result = (0, landTransformer_1.transformBezrealitkyLand)(listing);
            break;
        case 'commercial':
            // Commercial properties (GARAZ, KANCELAR, NEBYTOVY_PROSTOR) → commercial partition
            result = (0, commercialTransformer_1.transformBezrealitkyCommercial)(listing);
            break;
        case 'recreational':
            // Recreational (cottages, cabins) are buildings with land → house partition
            result = (0, houseTransformer_1.transformBezrealitkyHouse)(listing);
            break;
        default:
            throw new Error(`Unknown category: ${category}`);
    }
    return result;
}
