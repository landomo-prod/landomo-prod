"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformOther = transformOther;
const itemsParser_1 = require("../../utils/itemsParser");
const srealityHelpers_1 = require("../../utils/srealityHelpers");
const czech_value_mappings_1 = require("../../../../shared/czech-value-mappings");
/**
 * Transform SReality "other" listing (category 5) to OtherPropertyTierI
 *
 * Subcategories:
 * - 34: Garáže (Garages)
 * - 36: Specifický typ (Specific/Misc type)
 * - 52: Garážová stání (Parking spaces)
 * - 53: Mobilheimy (Mobile homes)
 */
function transformOther(listing) {
    const parser = new itemsParser_1.SRealityItemsParser(listing.items || []);
    const titleString = (0, srealityHelpers_1.getStringOrValue)(listing.name) || '';
    // Determine subtype from subcategory and title
    const subCategoryId = listing.seo?.category_sub_cb;
    const property_subtype = detectOtherSubtype(subCategoryId, titleString);
    // Area extraction
    const sqm_total = parser.getAreaOr(itemsParser_1.FIELD_NAMES.TOTAL_AREA, itemsParser_1.FIELD_NAMES.LIVING_AREA, itemsParser_1.FIELD_NAMES.LIVING_AREA_TRUNCATED, itemsParser_1.FIELD_NAMES.BUILT_UP_AREA, itemsParser_1.FIELD_NAMES.BUILT_UP_AREA_ALT, itemsParser_1.FIELD_NAMES.AREA) || (0, srealityHelpers_1.extractAreaFromTitle)(titleString) || 0;
    // Amenities
    const has_electricity = (0, srealityHelpers_1.ensureBoolean)(parser.getBoolean(itemsParser_1.FIELD_NAMES.ELECTRICITY) ||
        isPositiveField(parser.getString(itemsParser_1.FIELD_NAMES.ELECTRICITY)));
    const has_parking = (0, srealityHelpers_1.ensureBoolean)(property_subtype === 'garage' || property_subtype === 'parking_space' ||
        parser.getBoolean(itemsParser_1.FIELD_NAMES.PARKING) ||
        parser.getBoolean(itemsParser_1.FIELD_NAMES.GARAGE));
    const has_water_connection = parser.getBoolean('Voda') ??
        parser.getBoolean(itemsParser_1.FIELD_NAMES.WATER) ??
        undefined;
    const has_heating = parser.getBoolean(itemsParser_1.FIELD_NAMES.HEATING) ??
        isPositiveField(parser.getString(itemsParser_1.FIELD_NAMES.HEATING)) ??
        undefined;
    // Parking spaces count
    const parkingStr = parser.getString(itemsParser_1.FIELD_NAMES.PARKING);
    const parking_spaces = parkingStr ? extractNumber(parkingStr) : undefined;
    // Condition
    const conditionRaw = parser.getString(itemsParser_1.FIELD_NAMES.CONDITION);
    const condition = mapOtherCondition((0, czech_value_mappings_1.normalizeCondition)(conditionRaw));
    // Construction type
    const constructionRaw = parser.getStringOr(itemsParser_1.FIELD_NAMES.BUILDING_TYPE, itemsParser_1.FIELD_NAMES.CONSTRUCTION);
    const construction_type = mapOtherConstructionType((0, czech_value_mappings_1.normalizeConstructionType)(constructionRaw));
    // Year built
    const year_built = extractYearBuilt(parser);
    // Hash ID
    const hashId = listing.hash_id ?? (0, srealityHelpers_1.extractHashIdFromUrl)(listing._links?.self?.href);
    // Images
    const images = (0, srealityHelpers_1.extractImages)(listing);
    // Media URLs
    const virtualTourUrl = (0, srealityHelpers_1.extractVirtualTourUrl)(listing);
    const videoUrl = (0, srealityHelpers_1.extractVideoUrl)(listing);
    // Features
    const features = buildFeaturesList(parser, property_subtype, has_electricity, has_water_connection, has_heating);
    // Seller info
    const sellerInfo = (0, srealityHelpers_1.extractSellerInfo)(listing._embedded);
    return {
        property_category: 'other',
        // Core
        title: titleString || 'Unknown',
        price: listing.price_czk?.value_raw || listing.price || 0,
        currency: 'CZK',
        transaction_type: listing.seo?.category_type_cb === 2 ? 'rent' : listing.seo?.category_type_cb === 3 ? 'auction' : 'sale',
        // Location
        location: {
            city: (0, srealityHelpers_1.extractCity)((0, srealityHelpers_1.getStringOrValue)(listing.locality) || ''),
            country: 'cz',
            coordinates: (listing.gps?.lat && listing.gps?.lon) ? {
                lat: listing.gps.lat,
                lon: listing.gps.lon
            } : (listing.map?.lat && listing.map?.lon) ? {
                lat: listing.map.lat,
                lon: listing.map.lon
            } : undefined
        },
        // Classification
        property_subtype,
        // Other-specific
        sqm_total,
        has_parking,
        has_electricity,
        parking_spaces,
        has_water_connection: has_water_connection ?? undefined,
        has_heating: has_heating ?? undefined,
        // Building context
        year_built,
        construction_type,
        condition,
        // Media
        media: images.length > 0 ? {
            images: images.map(img => img.preview || img.full || img.thumbnail).filter(Boolean),
            total_images: listing.advert_images_count
        } : undefined,
        images: images.length > 0 ? images.map(img => img.preview || img.full || img.thumbnail).filter(Boolean) : undefined,
        videos: videoUrl ? [videoUrl] : undefined,
        agent: sellerInfo?.agent_name ? {
            name: sellerInfo.agent_name,
            phone: sellerInfo.agent_phone,
            email: sellerInfo.agent_email,
            agency: sellerInfo.agent_agency,
            agency_logo: sellerInfo.logo_url,
        } : undefined,
        // Description
        description: listing.text?.value,
        // Features
        features,
        // Tier II: Country-specific
        country_specific: {
            czech: {
                condition: (0, czech_value_mappings_1.normalizeCondition)(conditionRaw),
                construction_type: (0, czech_value_mappings_1.normalizeConstructionType)(constructionRaw)
            }
        },
        // Tier III: Portal metadata
        portal_metadata: {
            sreality: {
                hash_id: hashId,
                name: (0, srealityHelpers_1.getStringOrValue)(listing.name),
                locality: (0, srealityHelpers_1.getStringOrValue)(listing.locality),
                price_czk: listing.price_czk?.value_raw,
                price_note: listing.price_czk?.name,
                category_main_cb: listing.seo?.category_main_cb,
                category_sub_cb: listing.seo?.category_sub_cb,
                category_type_cb: listing.seo?.category_type_cb,
                advert_images_count: listing.advert_images_count,
                labels: listing.labels,
                new: listing.new,
                region_tip: listing.region_tip,
                exclusively_at_rk: listing.exclusively_at_rk === 1,
                has_floor_plan: listing.has_floor_plan === 1,
                has_video: listing.has_video === 1,
                has_panorama: listing.has_panorama === 1,
                is_auction: listing.is_auction,
                auction_price: listing.is_auction ? listing.auctionPrice : undefined,
                virtual_tour_url: virtualTourUrl && virtualTourUrl !== 'available' ? virtualTourUrl : undefined,
                video_url: videoUrl
            }
        },
        // Portal & Lifecycle
        source_url: (0, srealityHelpers_1.extractSourceUrl)(listing, hashId),
        source_platform: 'sreality',
        portal_id: `sreality-${hashId}`,
        status: 'active'
    };
}
/**
 * Detect other property subtype from subcategory ID and title
 */
function detectOtherSubtype(subCategoryId, title) {
    // Primary: subcategory ID (can be number or string from API)
    const subId = typeof subCategoryId === 'string' ? parseInt(subCategoryId) : subCategoryId;
    if (subId === 34)
        return 'garage';
    if (subId === 52)
        return 'parking_space';
    if (subId === 53)
        return 'mobile_home';
    // Fallback: title keywords
    if (title) {
        const lower = title.toLowerCase();
        if (lower.includes('garáž') || lower.includes('garaz'))
            return 'garage';
        if (lower.includes('stání') || lower.includes('stani') || lower.includes('parking'))
            return 'parking_space';
        if (lower.includes('mobilheim') || lower.includes('mobilní') || lower.includes('mobilni') || lower.includes('karavan'))
            return 'mobile_home';
        if (lower.includes('sklad') || lower.includes('storage'))
            return 'storage';
    }
    return 'other';
}
/**
 * Check if a field string value is positive
 */
function isPositiveField(value) {
    if (!value)
        return undefined;
    const lower = value.toLowerCase();
    if (lower.includes('ano') || lower.includes('yes') || lower === '1')
        return true;
    if (lower.includes('ne') || lower.includes('no') || lower === '0')
        return false;
    return undefined;
}
/**
 * Extract first number from string
 */
function extractNumber(str) {
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
}
/**
 * Extract year built from parser
 */
function extractYearBuilt(parser) {
    const yearFields = ['Rok postavení', 'Rok výstavby', 'Year built'];
    for (const field of yearFields) {
        const value = parser.getString(field);
        if (value) {
            const match = value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
            const year = match ? parseInt(match[0]) : undefined;
            if (year && year >= 1800 && year <= 2100)
                return year;
        }
    }
    return undefined;
}
/**
 * Map condition to OtherPropertyTierI allowed values
 */
function mapOtherCondition(condition) {
    if (!condition)
        return undefined;
    const mapping = {
        'new': 'new',
        'excellent': 'excellent',
        'very_good': 'excellent',
        'good': 'good',
        'after_renovation': 'good',
        'before_renovation': 'fair',
        'requires_renovation': 'requires_renovation',
        'project': 'new',
        'under_construction': 'new'
    };
    return mapping[condition];
}
/**
 * Map construction type to OtherPropertyTierI allowed values
 */
function mapOtherConstructionType(constructionType) {
    if (!constructionType)
        return undefined;
    const mapping = {
        'brick': 'brick',
        'concrete': 'concrete',
        'steel': 'steel',
        'prefab': 'prefab',
        'wood': 'wood',
        'panel': 'prefab',
        'mixed': 'concrete',
        'other': undefined,
        'stone': 'brick'
    };
    return mapping[constructionType];
}
/**
 * Build features list for other properties
 */
function buildFeaturesList(parser, subtype, has_electricity, has_water, has_heating) {
    const features = [];
    if (subtype)
        features.push(subtype);
    if (has_electricity)
        features.push('electricity');
    if (has_water)
        features.push('water_connection');
    if (has_heating)
        features.push('heating');
    // Garage-specific features
    if (parser.getBoolean('Automatická vrata')) {
        features.push('automatic_door');
    }
    if (parser.getBoolean('Montážní jáma') || parser.getBoolean('Jáma')) {
        features.push('pit');
    }
    // Security
    const security = parser.getStringOr('Zabezpečení', 'Security', 'Alarm');
    if (security) {
        const lower = security.toLowerCase();
        if (lower.includes('alarm'))
            features.push('alarm');
        if (lower.includes('kamer') || lower.includes('camera'))
            features.push('camera');
    }
    return features;
}
