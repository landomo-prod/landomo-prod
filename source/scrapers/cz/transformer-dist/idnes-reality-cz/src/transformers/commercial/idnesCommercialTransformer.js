"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformIdnesCommercial = transformIdnesCommercial;
const czech_value_mappings_1 = require("../../../../shared/czech-value-mappings");
const idnesHelpers_1 = require("../../utils/idnesHelpers");
/**
 * Transform Idnes Commercial listing to CommercialPropertyTierI
 */
function transformIdnesCommercial(listing) {
    const title = listing.title || 'Untitled';
    const price = listing.price ?? null;
    const currency = 'CZK';
    const transaction_type = (0, idnesHelpers_1.mapTransactionType)(listing.transactionType);
    const city = listing.location?.city || listing.location?.district || 'Unknown';
    const location = {
        address: listing.location?.address,
        city,
        region: listing.location?.region || listing.location?.district,
        country: 'Czech Republic',
        coordinates: listing.coordinates ? {
            lat: listing.coordinates.lat,
            lon: listing.coordinates.lng
        } : undefined
    };
    const sqm_total = listing.area ?? null;
    const amenities = (0, idnesHelpers_1.parseAmenitiesFromAttrs)(listing._attributes);
    const has_elevator = amenities.has_elevator;
    const has_parking = amenities.has_parking;
    const parking_spaces = (0, idnesHelpers_1.parseParkingSpacesFromAttrs)(listing._attributes);
    const commission = (0, idnesHelpers_1.extractCommissionFromAttrs)(listing._attributes);
    const normalizedCondition = listing.condition ? (0, czech_value_mappings_1.normalizeCondition)(listing.condition) : undefined;
    const heating_type = listing.heatingType ? (0, czech_value_mappings_1.normalizeHeatingType)(listing.heatingType) : undefined;
    // Detect subtype from propertyType / title
    const comm_property_subtype = detectCommercialSubtype(listing.propertyType, listing.title);
    // Year built & price per sqm
    const year_built = (0, idnesHelpers_1.parseYearBuiltFromAttrs)(listing._attributes);
    const price_per_sqm = (price && sqm_total) ? Math.round(price / sqm_total) : undefined;
    // Additional fields
    const floor = (0, idnesHelpers_1.parseFloorFromAttrs)(listing._attributes);
    const total_floors = (0, idnesHelpers_1.parseTotalFloorsFromAttrs)(listing._attributes);
    const construction_type = listing.constructionType ? (0, czech_value_mappings_1.normalizeConstructionType)(listing.constructionType) : undefined;
    const renovation_year = (0, idnesHelpers_1.extractRenovationYearFromAttrs)(listing._attributes);
    const deposit = (0, idnesHelpers_1.extractDepositFromAttrs)(listing._attributes);
    const furnished = listing.furnished ? (0, czech_value_mappings_1.normalizeFurnished)(listing.furnished) : undefined;
    const available_from = (0, idnesHelpers_1.extractAvailableFromAttrs)(listing._attributes);
    const has_disabled_access = listing._attributes?.['bezbariérový přístup']?.toLowerCase().trim() === 'ano' ? true : undefined;
    // Agent
    const agent = listing.realtor?.name ? {
        name: listing.realtor.name,
        phone: listing.realtor.phone,
        email: listing.realtor.email,
    } : undefined;
    const media = {
        images: listing.images || [],
        main_image: listing.images?.[0],
    };
    return ({
        property_category: 'commercial',
        property_type: classifyCommercialPropertyType(title),
        title,
        price,
        currency,
        transaction_type,
        location,
        sqm_total,
        has_elevator,
        has_parking,
        parking_spaces,
        has_bathrooms: undefined,
        property_subtype: comm_property_subtype,
        condition: normalizedCondition,
        heating_type,
        construction_type,
        energy_class: listing.energyRating ? (0, czech_value_mappings_1.normalizeEnergyRating)(listing.energyRating) : undefined,
        year_built,
        renovation_year,
        floor,
        total_floors,
        price_per_sqm,
        deposit,
        furnished,
        available_from,
        has_disabled_access,
        is_commission: commission?.is_commission,
        commission_note: commission?.commission_note,
        published_date: listing.metadata?.published || undefined,
        media,
        agent,
        source_url: listing.url,
        source_platform: 'idnes-reality',
        portal_id: `idnes-${listing.id}`,
        status: 'active',
        description: listing.description || listing.title || '',
        features: listing.features || [],
        // Top-level images (required by ingest API)
        images: listing.images || [],
    });
}
/**
 * Classify commercial property_type from Czech title
 */
function classifyCommercialPropertyType(title) {
    const t = title.toLowerCase();
    if (t.includes('kancelář') || t.includes('kancelar'))
        return 'office';
    if (t.includes('sklad'))
        return 'warehouse';
    if (t.includes('obchod'))
        return 'retail';
    if (t.includes('výrob') || t.includes('hal'))
        return 'production';
    if (t.includes('restaur'))
        return 'restaurant';
    if (t.includes('ubytovací') || t.includes('hotel') || t.includes('penzion'))
        return 'accommodation';
    if (t.includes('činžovní'))
        return 'apartment_building';
    if (t.includes('ordinac'))
        return 'medical_office';
    if (t.includes('zemědělský'))
        return 'agricultural';
    return 'other';
}
function detectCommercialSubtype(propertyType, title) {
    const text = `${propertyType || ''} ${title || ''}`.toLowerCase();
    if (text.includes('kancelář') || text.includes('kancelar') || text.includes('office'))
        return 'office';
    if (text.includes('sklad') || text.includes('warehouse'))
        return 'warehouse';
    if (text.includes('obchod') || text.includes('retail') || text.includes('prodejna'))
        return 'retail';
    if (text.includes('výroba') || text.includes('industrial') || text.includes('hala'))
        return 'industrial';
    if (text.includes('restaurace') || text.includes('restaurant'))
        return 'restaurant';
    if (text.includes('hotel'))
        return 'hotel';
    return undefined;
}
