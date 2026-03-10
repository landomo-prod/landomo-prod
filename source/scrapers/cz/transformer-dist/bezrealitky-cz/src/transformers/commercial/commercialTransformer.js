"use strict";
/**
 * Commercial Property Transformer
 *
 * Transforms Bezrealitky commercial properties (GARAZ, KANCELAR, NEBYTOVY_PROSTOR)
 * to CommercialPropertyTierI schema
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformBezrealitkyCommercial = transformBezrealitkyCommercial;
const czech_value_mappings_1 = require("../../../../shared/czech-value-mappings");
const bezrealitkyHelpers_1 = require("../../utils/bezrealitkyHelpers");
/**
 * Map PropertyCondition values to CommercialPropertyTierI condition type
 */
function mapConditionToCommercial(condition) {
    if (!condition)
        return undefined;
    switch (condition) {
        case 'new':
            return 'new';
        case 'excellent':
        case 'very_good': // Map very_good → excellent
            return 'excellent';
        case 'good':
        case 'after_renovation': // Map after_renovation → good
            return 'good';
        case 'before_renovation': // Map before_renovation → fair
            return 'fair';
        case 'requires_renovation':
            return 'requires_renovation';
        case 'project': // Not applicable for active commercial listings
        case 'under_construction': // Not applicable for active commercial listings
        default:
            return undefined;
    }
}
/**
 * Map ConstructionType values to CommercialPropertyTierI construction_type
 */
function mapConstructionTypeToCommercial(constructionType) {
    if (!constructionType)
        return undefined;
    switch (constructionType) {
        case 'panel': // Panel buildings are prefabricated
            return 'prefab';
        case 'brick':
            return 'brick';
        case 'stone': // Stone buildings similar to brick
            return 'brick';
        case 'concrete':
            return 'concrete';
        case 'mixed':
            return 'mixed';
        case 'wood': // Rare for commercial, no good mapping
        case 'other':
        default:
            return undefined;
    }
}
/**
 * Transform Bezrealitky commercial listing to CommercialPropertyTierI
 */
function transformBezrealitkyCommercial(listing) {
    // ============ Determine Commercial Subtype ============
    const property_subtype = detectCommercialSubtype(listing);
    // ============ Extract Core Fields ============
    const title = listing.title || 'Untitled Commercial Property';
    const price = listing.price ?? 0;
    const currency = listing.currency || 'CZK';
    const transaction_type = listing.offerType === 'PRONAJEM' ? 'rent' : 'sale';
    // ============ Location ============
    const location = {
        address: listing.address || '',
        city: listing.city || '',
        region: listing.region?.name || '',
        country: 'Czech Republic',
        postal_code: listing.zip,
        coordinates: listing.gps
            ? { lat: listing.gps.lat, lon: listing.gps.lng }
            : undefined,
    };
    // ============ Size Metrics ============
    const sqm_total = listing.surface ?? 0;
    const sqm_usable = listing.surface; // Use surface as usable for commercial
    const sqm_plot = listing.surfaceLand;
    // ============ Building Details ============
    const total_floors = listing.totalFloors;
    const floor = listing.floor ? parseInt(listing.floor) : undefined;
    const ceiling_height = undefined; // Not available in BezRealitky data
    // ============ Amenities (booleans) ============
    const has_elevator = listing.lift ?? false;
    const has_parking = listing.parking ?? listing.garage ?? false;
    const parking_spaces = undefined; // Count not available
    const has_bathrooms = false; // Bezrealitky doesn't provide bathroom info — required boolean field
    const bathroom_count = undefined; // Count not available
    // Commercial-specific amenities
    const has_hvac = listing.heating != null ? true : undefined;
    const has_air_conditioning = undefined; // Not available
    const has_security_system = undefined; // Not available
    const has_disabled_access = listing.barrierFree ?? undefined;
    const has_kitchen = undefined; // Not available
    // ============ Building Context ============
    const year_built = listing.age ? new Date().getFullYear() - listing.age : undefined;
    // Map PropertyCondition to CommercialPropertyTierI condition type
    const rawCondition = (0, czech_value_mappings_1.normalizeCondition)(listing.condition);
    const condition = mapConditionToCommercial(rawCondition);
    const energy_class = (0, czech_value_mappings_1.normalizeEnergyRating)(listing.penb);
    const heating_type = (0, czech_value_mappings_1.normalizeHeatingType)(listing.heating);
    // Map ConstructionType to CommercialPropertyTierI construction_type
    const rawConstructionType = (0, czech_value_mappings_1.normalizeConstructionType)(listing.construction);
    const construction_type = mapConstructionTypeToCommercial(rawConstructionType);
    // ============ Financials ============
    const monthly_rent = transaction_type === 'rent' ? price : undefined;
    const price_per_sqm = sqm_total > 0 ? Math.round(price / sqm_total) : undefined;
    const operating_costs = undefined; // Not available
    const service_charges = listing.serviceCharges ?? listing.charges;
    const utility_costs = listing.utilityCharges;
    const deposit = listing.deposit;
    // ============ Rental-Specific Fields ============
    // Convert Unix epoch timestamp to ISO 8601 string
    const available_from = listing.availableFrom
        ? new Date(parseInt(listing.availableFrom) * 1000).toISOString()
        : undefined;
    // ============ Tier 1 Universal Fields ============
    const furnished = (0, czech_value_mappings_1.normalizeFurnished)(listing.equipped);
    const renovation_year = (0, bezrealitkyHelpers_1.parseRenovationYear)(listing.reconstruction);
    const published_date = listing.timeActivated
        ? new Date(parseInt(listing.timeActivated) * 1000).toISOString()
        : undefined;
    // ============ Media ============
    const richImages = (listing.publicImages || []).map((img) => ({
        url: img.url,
        order: img.order,
        is_main: img.main || undefined,
        filename: img.filename,
        image_id: img.id,
    }));
    const imageUrls = richImages.map(img => img.url);
    const media = richImages.length
        ? {
            images: richImages,
            virtual_tour_url: listing.tour360,
            tour_360_url: listing.tour360,
        }
        : undefined;
    // ============ Agent ============
    const agent = undefined; // Agent info not available in BezRealitky listing data
    // ============ Features ============
    const features = [];
    if (listing.garage)
        features.push('garage');
    if (listing.balcony)
        features.push('balcony');
    if (listing.terrace)
        features.push('terrace');
    if (listing.frontGarden != null && listing.frontGarden > 0)
        features.push('garden');
    if (listing.barrierFree)
        features.push('barrier_free');
    if (listing.petFriendly)
        features.push('pet_friendly');
    if (listing.tour360)
        features.push('virtual_tour');
    // ============ Portal Metadata ============
    const portal_metadata = {
        bezrealitky: {
            id: listing.id,
            estate_type: listing.estateType,
            offer_type: listing.offerType,
            active: listing.active,
            highlighted: listing.highlighted,
            is_new: listing.isNew,
            visit_count: listing.visitCount,
            conversation_count: listing.conversationCount,
            reserved: listing.reserved,
            original_price: listing.originalPrice,
            is_discounted: listing.isDiscounted,
        },
    };
    // ============ Country-Specific Fields ============
    const country_specific = {
        city_district: listing.cityDistrict,
        is_prague: listing.isPrague,
        is_brno: listing.isBrno,
        is_prague_west: listing.isPragueWest,
        is_prague_east: listing.isPragueEast,
        ruian_id: listing.ruianId,
        water_supply: listing.water,
        sewage_type: listing.sewage,
        service_charges_note: listing.serviceChargesNote,
        utility_charges_note: listing.utilityChargesNote,
    };
    // ============ Assemble CommercialPropertyTierI ============
    return {
        // Category
        property_category: 'commercial',
        // Core
        title,
        price,
        currency,
        transaction_type,
        // Location
        location,
        // Classification
        property_subtype,
        // Country-specific
        country_specific,
        // Size
        sqm_total,
        sqm_usable,
        sqm_plot,
        // Building
        total_floors,
        floor,
        ceiling_height,
        // Amenities (required booleans)
        has_elevator,
        has_parking,
        has_bathrooms,
        // Amenities (optional)
        parking_spaces,
        bathroom_count,
        has_hvac,
        has_air_conditioning,
        has_security_system,
        has_disabled_access,
        has_kitchen,
        // Building context
        year_built,
        renovation_year,
        condition,
        energy_class,
        heating_type,
        construction_type,
        // Financials
        monthly_rent,
        price_per_sqm,
        operating_costs,
        service_charges,
        utility_costs,
        deposit,
        is_commission: listing.fee !== undefined && listing.fee > 0,
        commission_note: listing.fee !== undefined && listing.fee > 0 ? `Agency fee: ${listing.fee} CZK` : undefined,
        // Tier 1 Universal Fields
        furnished,
        published_date,
        // Rental-Specific
        available_from,
        // Media & Agent
        media,
        agent,
        // Features
        features,
        // Description
        description: listing.description,
        // Legacy media
        images: imageUrls,
        videos: [],
        // Portal metadata
        portal_metadata,
        // Portal & lifecycle
        source_url: listing.uri ? `https://www.bezrealitky.cz/nemovitosti-byty-domy/${listing.uri.startsWith('/') ? listing.uri.slice(1) : listing.uri}` : `https://www.bezrealitky.cz/detail/${listing.id}`,
        source_platform: 'bezrealitky',
        portal_id: `bezrealitky-${listing.id}`,
        status: (listing.active ? 'active' : 'removed'),
    };
}
/**
 * Detect commercial subtype from estate type
 */
function detectCommercialSubtype(listing) {
    const estateType = listing.estateType;
    const title = listing.title?.toLowerCase() || '';
    const description = listing.description?.toLowerCase() || '';
    // GARAZ → warehouse/industrial (storage space)
    if (estateType === 'GARAZ') {
        if (title.includes('sklad') || description.includes('sklad')) {
            return 'warehouse';
        }
        return 'industrial'; // Garages are industrial/storage
    }
    // KANCELAR → office
    if (estateType === 'KANCELAR') {
        if (title.includes('retail') || title.includes('obchod') || description.includes('obchod')) {
            return 'retail';
        }
        if (title.includes('hotel') || description.includes('hotel')) {
            return 'hotel';
        }
        if (title.includes('restaurace') || title.includes('restaurant') || description.includes('restaurace')) {
            return 'restaurant';
        }
        return 'office'; // Default for KANCELAR
    }
    // NEBYTOVY_PROSTOR → various (analyze title/description)
    if (estateType === 'NEBYTOVY_PROSTOR') {
        // Retail
        if (title.includes('obchod') ||
            title.includes('prodejna') ||
            title.includes('retail') ||
            description.includes('obchod') ||
            description.includes('prodejna')) {
            return 'retail';
        }
        // Warehouse
        if (title.includes('sklad') ||
            title.includes('warehouse') ||
            description.includes('sklad')) {
            return 'warehouse';
        }
        // Industrial
        if (title.includes('výroba') ||
            title.includes('dílna') ||
            title.includes('hala') ||
            title.includes('industrial') ||
            description.includes('výroba') ||
            description.includes('průmysl')) {
            return 'industrial';
        }
        // Restaurant
        if (title.includes('restaurace') ||
            title.includes('restaurant') ||
            title.includes('hospoda') ||
            title.includes('bar') ||
            description.includes('restaurace')) {
            return 'restaurant';
        }
        // Hotel
        if (title.includes('hotel') || description.includes('hotel')) {
            return 'hotel';
        }
        // Medical
        if (title.includes('ordinace') ||
            title.includes('zdravotní') ||
            title.includes('medical') ||
            description.includes('ordinace') ||
            description.includes('zdravotní')) {
            return 'medical';
        }
        // Showroom
        if (title.includes('showroom') ||
            title.includes('výstavní') ||
            description.includes('showroom')) {
            return 'showroom';
        }
        // Office (fallback for non-residential space)
        if (title.includes('kancelář') || title.includes('office') || description.includes('kancelář')) {
            return 'office';
        }
        // Mixed use
        if (title.includes('smíšen') || title.includes('mixed') || description.includes('smíšen')) {
            return 'mixed_use';
        }
        // Default: industrial for generic non-residential
        return 'industrial';
    }
    return undefined;
}
