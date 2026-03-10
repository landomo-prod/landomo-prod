"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformCommercial = transformCommercial;
const itemsParser_1 = require("../../utils/itemsParser");
const srealityHelpers_1 = require("../../utils/srealityHelpers");
const czech_value_mappings_1 = require("../../../../shared/czech-value-mappings");
/**
 * Transform SReality commercial listing to CommercialPropertyTierI
 *
 * Commercial-specific fields:
 * - sqm_total (CRITICAL - required field)
 * - property_subtype (office, retail, warehouse, etc.)
 * - has_elevator, has_parking, has_bathrooms
 * - ceiling_height (for warehouses/industrial)
 * - parking_spaces, office_rooms
 */
function transformCommercial(listing) {
    // Initialize type-safe parser (single O(n) pass)
    const parser = new itemsParser_1.SRealityItemsParser(listing.items || []);
    // Extract title
    const titleString = (0, srealityHelpers_1.getStringOrValue)(listing.name) || '';
    // Extract floor info
    const floorInfo = (0, srealityHelpers_1.extractFloorInfo)(parser.getString(itemsParser_1.FIELD_NAMES.FLOOR));
    // Extract amenities using parser (ensures boolean, never undefined)
    const has_elevator = (0, srealityHelpers_1.ensureBoolean)(parser.getBoolean(itemsParser_1.FIELD_NAMES.ELEVATOR));
    const has_parking = (0, srealityHelpers_1.ensureBoolean)(parser.getBooleanOr(itemsParser_1.FIELD_NAMES.PARKING, itemsParser_1.FIELD_NAMES.GARAGE));
    // Extract bathrooms — check parser for bathroom fields, default to undefined if unknown
    const bathroomFields = ['Počet koupelen', 'Koupelen', 'Koupelna'];
    let has_bathrooms = false;
    for (const field of bathroomFields) {
        if (parser.getBoolean(field)) {
            has_bathrooms = true;
            break;
        }
    }
    // If no explicit bathroom field, leave unknown — but type requires boolean
    // Check WC field as well
    if (!has_bathrooms) {
        has_bathrooms = parser.getBoolean('WC');
    }
    // Extract areas - commercial properties use various area field names
    // Priority: TOTAL_AREA > LIVING_AREA > BUILT_UP_AREA > title extraction
    const sqm_total = parser.getAreaOr(itemsParser_1.FIELD_NAMES.TOTAL_AREA, itemsParser_1.FIELD_NAMES.LIVING_AREA, itemsParser_1.FIELD_NAMES.LIVING_AREA_TRUNCATED, itemsParser_1.FIELD_NAMES.BUILT_UP_AREA, itemsParser_1.FIELD_NAMES.BUILT_UP_AREA_ALT, itemsParser_1.FIELD_NAMES.AREA) ?? (0, srealityHelpers_1.extractAreaFromTitle)(titleString);
    const sqm_usable = parser.getArea(itemsParser_1.FIELD_NAMES.LIVING_AREA) || parser.getArea(itemsParser_1.FIELD_NAMES.LIVING_AREA_TRUNCATED);
    const sqm_plot = parser.getArea(itemsParser_1.FIELD_NAMES.PLOT_AREA);
    // Determine property subtype from title or commercial type field
    const commercialType = parser.getString(itemsParser_1.FIELD_NAMES.COMMERCIAL_TYPE);
    const commercialSubtype = parser.getString(itemsParser_1.FIELD_NAMES.COMMERCIAL_SUBTYPE);
    const property_subtype = detectCommercialSubtype(titleString, commercialType, commercialSubtype);
    // Extract parking count if available
    const parkingStr = parser.getString(itemsParser_1.FIELD_NAMES.PARKING);
    const parking_spaces = parkingStr ? extractNumberFromString(parkingStr) : undefined;
    // Extract city from locality field (extractCity expects a string parameter)
    const localityString = (0, srealityHelpers_1.getStringOrValue)(listing.locality) || '';
    const city = (0, srealityHelpers_1.extractCity)(localityString);
    // Determine transaction type from title or price field
    const transaction_type = detectTransactionType(listing, titleString);
    // Extract additional details
    const condition = parser.getString(itemsParser_1.FIELD_NAMES.CONDITION);
    const heating = parser.getString(itemsParser_1.FIELD_NAMES.HEATING) ||
        parser.getString(itemsParser_1.FIELD_NAMES.HEATING_ALT) ||
        parser.getString(itemsParser_1.FIELD_NAMES.HEATING_EN);
    // === B. Energy class — use item.value_type (letter A-G) directly ===
    const energyItem = (listing.items || []).find((i) => i.type === 'energy_efficiency_rating');
    const energy_rating = energyItem?.value_type
        || parser.getStringOr(itemsParser_1.FIELD_NAMES.ENERGY_CLASS, itemsParser_1.FIELD_NAMES.ENERGY_RATING);
    const construction_type = parser.getString(itemsParser_1.FIELD_NAMES.BUILDING_TYPE) ||
        parser.getString(itemsParser_1.FIELD_NAMES.CONSTRUCTION);
    // === F. Seller contact — from _embedded.seller (detail API) ===
    const sellerInfo = (0, srealityHelpers_1.extractSellerInfo)(listing._embedded);
    // Cache images (called twice below)
    const images = (0, srealityHelpers_1.extractImages)(listing);
    // Extract hash_id from URL or use listing.hash_id
    const hash_id = (0, srealityHelpers_1.extractHashIdFromUrl)(listing._links?.self?.href) || listing.hash_id;
    const portal_id = hash_id ? `sreality-${hash_id}` : `sreality-${Date.now()}`;
    // Property type from category_sub_cb
    const property_type = mapCommercialPropertyType(typeof listing.seo?.category_sub_cb === 'number' ? listing.seo.category_sub_cb : undefined);
    // Build the commercial property object
    const commercial = {
        // Category
        property_category: 'commercial',
        property_subtype: property_type,
        // Core fields
        title: titleString,
        price: listing.price_czk?.value_raw ?? listing.price,
        currency: 'CZK',
        transaction_type,
        // Location
        location: {
            city: city || 'Unknown',
            country: 'cz',
            coordinates: (listing.gps?.lat && listing.gps?.lon) ? {
                lat: listing.gps.lat,
                lon: listing.gps.lon
            } : (listing.map?.lat && listing.map?.lon) ? {
                lat: listing.map.lat,
                lon: listing.map.lon
            } : undefined
        },
        // Commercial-specific metrics
        sqm_total: sqm_total,
        sqm_usable,
        sqm_plot,
        floor: floorInfo.floor,
        total_floors: floorInfo.total_floors,
        // Financials
        price_per_sqm: (listing.price_czk?.value_raw || listing.price) && sqm_total
            ? Math.round((listing.price_czk?.value_raw ?? listing.price ?? 0) / sqm_total)
            : undefined,
        ...(0, srealityHelpers_1.extractCommissionInfo)(listing.price_czk?.name),
        // Amenities (required booleans)
        has_elevator,
        has_parking,
        has_bathrooms,
        parking_spaces,
        // Building context
        year_built: extractYearBuilt(parser),
        // Additional amenities (optional)
        has_air_conditioning: parser.getBoolean(itemsParser_1.FIELD_NAMES.KLIMATIZACE),
        has_security_system: undefined,
        has_reception: undefined,
        has_kitchen: undefined,
        // Lease & Availability
        available_from: (0, srealityHelpers_1.parseAvailableFrom)(parser.getStringOr(itemsParser_1.FIELD_NAMES.AVAILABLE_FROM_ALT, itemsParser_1.FIELD_NAMES.AVAILABLE_FROM)),
        // Tier 1 Universal Fields
        furnished: (0, czech_value_mappings_1.normalizeFurnished)(parser.getRaw(itemsParser_1.FIELD_NAMES.FURNISHED)?.value),
        renovation_year: extractRenovationYear(parser),
        published_date: parser.getString(itemsParser_1.FIELD_NAMES.AKTUALIZACE),
        // Ceiling height (important for warehouses/industrial)
        ceiling_height: parser.getNumberOr(itemsParser_1.FIELD_NAMES.VYSKA_STROPU, itemsParser_1.FIELD_NAMES.VYSKA_MISTNOSTI),
        // Building characteristics
        condition: condition ? mapCommercialCondition((0, czech_value_mappings_1.normalizeCondition)(condition)) : undefined,
        heating_type: heating ? (0, czech_value_mappings_1.normalizeHeatingType)(heating) : undefined,
        energy_class: energy_rating ? (0, czech_value_mappings_1.normalizeEnergyRating)(energy_rating) : undefined,
        construction_type: construction_type ? mapCommercialConstructionType((0, czech_value_mappings_1.normalizeConstructionType)(construction_type)) : undefined,
        // === F. Seller contact (from _embedded.seller detail API fields) ===
        ...(sellerInfo ? {
            agent_name: sellerInfo.agent_name,
            agent_phone: sellerInfo.agent_phone,
            agent_email: sellerInfo.agent_email,
            agent_agency: sellerInfo.agent_agency,
        } : {}),
        agent: sellerInfo?.agent_name ? {
            name: sellerInfo.agent_name,
            phone: sellerInfo.agent_phone,
            email: sellerInfo.agent_email,
            agency: sellerInfo.agent_agency,
            agency_logo: sellerInfo.logo_url,
        } : undefined,
        // Description
        description: listing.text?.value,
        // Images and media (using cached images)
        images: images.map(img => img.preview || img.full || img.thumbnail).filter(Boolean),
        media: (() => {
            const vtUrl = (0, srealityHelpers_1.extractVirtualTourUrl)(listing);
            return {
                images: images.map((img, i) => ({
                    url: img.full || img.preview || img.thumbnail || '',
                    thumbnail_url: img.thumbnail,
                    order: i,
                    ...(i === 0 ? { is_main: true } : {}),
                })).filter(img => img.url),
                total_images: listing.advert_images_count,
                virtual_tour_url: vtUrl && vtUrl !== 'available' ? vtUrl : undefined,
                video_tour_url: (0, srealityHelpers_1.extractVideoUrl)(listing),
            };
        })(),
        // Source tracking
        source_url: (0, srealityHelpers_1.extractSourceUrl)(listing, hash_id),
        source_platform: 'sreality',
        portal_id,
        status: 'active',
        // Tier III: Portal metadata
        portal_metadata: {
            sreality: {
                hash_id: hash_id || 0,
                category_main_cb: 4, // Commercial
                category_sub_cb: listing.seo?.category_sub_cb,
                category_type_cb: transaction_type === 'sale' ? 1 : transaction_type === 'rent' ? 2 : 3,
                has_floor_plan: listing.has_floor_plan === 1,
                has_video: listing.has_video === 1,
                has_panorama: listing.has_panorama === 1,
                labels: listing.labels || [],
                is_auction: listing.is_auction || false,
                auction_price: listing.auctionPrice,
                advert_images_count: listing.advert_images_count,
                exclusively_at_rk: listing.exclusively_at_rk || false,
                price_czk: listing.price_czk,
                price_note: listing.price_note,
                name: listing.name,
                locality: listing.locality
            }
        }
    };
    return commercial;
}
/**
 * Extract year built using parser
 *
 * SReality API primarily uses 'Rok kolaudace' (occupancy certificate year) rather
 * than 'Rok postavení' or 'Rok výstavby'. All three are checked for completeness.
 */
function extractYearBuilt(parser) {
    const yearFields = [
        itemsParser_1.FIELD_NAMES.YEAR_COMPLETED, // 'Rok kolaudace' — primary field the API actually returns
        itemsParser_1.FIELD_NAMES.YEAR_BUILT, // 'Rok postavení'
        itemsParser_1.FIELD_NAMES.YEAR_BUILT_ALT, // 'Rok výstavby'
    ];
    for (const field of yearFields) {
        const numericValue = parser.getNumber(field);
        if (numericValue && numericValue >= 1800 && numericValue <= 2100) {
            return numericValue;
        }
        const value = parser.getString(field);
        if (value) {
            const match = value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
            const year = match ? parseInt(match[0]) : undefined;
            if (year && year >= 1800 && year <= 2100) {
                return year;
            }
        }
    }
    return undefined;
}
/**
 * Extract renovation year using parser
 */
function extractRenovationYear(parser) {
    const numericValue = parser.getNumber(itemsParser_1.FIELD_NAMES.RENOVATION_YEAR);
    if (numericValue && numericValue >= 1800 && numericValue <= 2100) {
        return numericValue;
    }
    const value = parser.getString(itemsParser_1.FIELD_NAMES.RENOVATION_YEAR);
    if (value) {
        const match = value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
        const year = match ? parseInt(match[0]) : undefined;
        if (year && year >= 1800 && year <= 2100) {
            return year;
        }
    }
    return undefined;
}
/**
 * Detect commercial property subtype from title and metadata
 */
function detectCommercialSubtype(title, commercialType, commercialSubtype) {
    const titleLower = title.toLowerCase();
    const typeLower = (commercialType || '').toLowerCase();
    const subtypeLower = (commercialSubtype || '').toLowerCase();
    const combined = `${titleLower} ${typeLower} ${subtypeLower}`;
    // Office
    if (combined.match(/kancelář|kanceláře|office|administrativní/i)) {
        return 'office';
    }
    // Retail
    if (combined.match(/obchod|prodejna|retail|shop|butik/i)) {
        return 'retail';
    }
    // Warehouse
    if (combined.match(/sklad|warehouse|storage|hala/i)) {
        return 'warehouse';
    }
    // Industrial
    if (combined.match(/průmysl|výrob|industrial|továrn/i)) {
        return 'industrial';
    }
    // Hotel
    if (combined.match(/hotel|penzion|ubytování/i)) {
        return 'hotel';
    }
    // Restaurant
    if (combined.match(/restaurace|hostinec|kavárna|bistro|restaurant|café/i)) {
        return 'restaurant';
    }
    // Medical
    if (combined.match(/ordinace|lékařsk|medical|zdravotn/i)) {
        return 'medical';
    }
    // Showroom
    if (combined.match(/showroom|výstavní|prodejní plocha/i)) {
        return 'showroom';
    }
    // Mixed use
    if (combined.match(/polyfunkční|mixed|kombinovan/i)) {
        return 'mixed_use';
    }
    // Default - try to infer from most common patterns
    if (titleLower.includes('prostor')) {
        return 'office'; // Generic "space" often means office
    }
    return undefined; // Unable to determine
}
/**
 * Detect transaction type (sale vs rent) from listing data
 */
function detectTransactionType(listing, title) {
    const titleLower = title.toLowerCase();
    // Check category_type_cb first (most reliable)
    const categoryType = listing.seo?.category_type_cb;
    if (categoryType === 1 || categoryType === '1') {
        return 'sale';
    }
    if (categoryType === 2 || categoryType === '2') {
        return 'rent';
    }
    if (categoryType === 3 || categoryType === '3') {
        return 'auction';
    }
    // Fallback to title detection
    if (titleLower.includes('pronájem') || titleLower.includes('nájem')) {
        return 'rent';
    }
    if (titleLower.includes('dražb')) {
        return 'auction';
    }
    if (titleLower.includes('prodej')) {
        return 'sale';
    }
    // Default to sale if unclear
    return 'sale';
}
/**
 * Extract numeric value from string (e.g., "2 parking spaces" -> 2)
 */
function extractNumberFromString(str) {
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
}
/**
 * Map condition values to commercial property allowed values
 */
function mapCommercialCondition(condition) {
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
 * Map construction type to commercial property allowed values
 */
/**
 * Map SReality category_sub_cb to property_type for commercial
 */
function mapCommercialPropertyType(categorySubCb) {
    if (categorySubCb === undefined || categorySubCb === null)
        return undefined;
    const map = {
        25: 'office',
        26: 'warehouse',
        27: 'production',
        28: 'retail',
        29: 'accommodation',
        30: 'restaurant',
        31: 'agricultural',
        32: 'commercial_other',
        38: 'apartment_building',
        49: 'virtual_office',
        56: 'medical_office',
        57: 'other',
    };
    return map[categorySubCb] || 'other';
}
function mapCommercialConstructionType(constructionType) {
    if (!constructionType)
        return undefined;
    const mapping = {
        'brick': 'brick',
        'concrete': 'concrete',
        'steel': 'steel',
        'mixed': 'mixed',
        'prefab': 'prefab',
        'other': 'mixed',
        'panel': 'prefab',
        'stone': 'brick',
        'wood': 'mixed'
    };
    return mapping[constructionType];
}
