"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformSRealityToStandard = transformSRealityToStandard;
const categoryDetection_1 = require("../utils/categoryDetection");
const apartmentTransformer_1 = require("./apartments/apartmentTransformer");
const houseTransformer_1 = require("./houses/houseTransformer");
const landTransformer_1 = require("./land/landTransformer");
const commercialTransformer_1 = require("./commercial/commercialTransformer");
const otherTransformer_1 = require("./other/otherTransformer");
/**
 * Main SReality transformer with category detection
 * Routes to category-specific transformer based on listing type
 *
 * Fully implemented category-specific transformers:
 * - Apartments: ✅ Category-specific transformer (Tier I)
 * - Houses: ✅ Category-specific transformer (Tier I)
 * - Land: ✅ Category-specific transformer (Tier I)
 * - Commercial: ✅ Category-specific transformer (Tier I)
 * - Other: ✅ Category-specific transformer (Tier I)
 *
 * All transformers output type-safe Tier I types compliant with
 * the category-partitioned three-tier data model.
 */
function transformSRealityToStandard(listing) {
    const category = (0, categoryDetection_1.detectCategoryFromSreality)(listing);
    switch (category) {
        case 'apartment':
            return (0, apartmentTransformer_1.transformApartment)(listing);
        case 'house':
            return (0, houseTransformer_1.transformHouse)(listing);
        case 'land':
            return (0, landTransformer_1.transformLand)(listing);
        case 'commercial':
            return (0, commercialTransformer_1.transformCommercial)(listing);
        case 'other':
            return (0, otherTransformer_1.transformOther)(listing);
        default:
            // This should never happen due to detectCategoryFromSreality throwing
            throw new Error(`Unsupported category: ${category}. This indicates a bug in category detection.`);
    }
}
