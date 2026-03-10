"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformIdnesHouse = transformIdnesHouse;
const czech_value_mappings_1 = require("../../../../shared/czech-value-mappings");
const idnesHelpers_1 = require("../../utils/idnesHelpers");
/**
 * Transform Idnes House to HousePropertyTierI
 *
 * House-specific fields:
 * - sqm_living, sqm_plot (plot area is critical!)
 * - has_garden, garden_area
 * - has_garage, has_parking
 * - stories
 */
function transformIdnesHouse(listing) {
    // Core
    const title = listing.title || 'Untitled';
    const price = listing.price ?? null;
    const currency = 'CZK';
    const transaction_type = (0, idnesHelpers_1.mapTransactionType)(listing.transactionType);
    // Location
    const city = listing.location?.city || (0, idnesHelpers_1.extractCityFromLocation)(listing.location) || 'Unknown';
    const location = {
        address: listing.location?.address,
        city: city,
        region: listing.location?.region || listing.location?.district,
        country: 'Czech Republic',
        coordinates: listing.coordinates ? {
            lat: listing.coordinates.lat,
            lon: listing.coordinates.lng
        } : undefined
    };
    // House Areas
    const sqm_living = listing.area ?? (0, idnesHelpers_1.extractAreaFromAttrs)(listing._attributes, ['užitná plocha', 'plocha bytu']) ?? null;
    const sqm_plot = listing.plotArea ?? (0, idnesHelpers_1.extractAreaFromAttrs)(listing._attributes, ['plocha pozemku']) ?? null;
    const bedrooms = (0, idnesHelpers_1.extractBedroomsFromDisposition)(listing.rooms) ?? null;
    const bathrooms = (0, idnesHelpers_1.parseBathroomsFromAttrs)(listing._attributes);
    const rooms = (0, idnesHelpers_1.parseRooms)(listing.rooms);
    // Amenities (from _attributes, not features[] which is empty for idnes)
    const amenities = (0, idnesHelpers_1.parseAmenitiesFromAttrs)(listing._attributes);
    // Building
    const normalizedCondition = listing.condition ? (0, czech_value_mappings_1.normalizeCondition)(listing.condition) : undefined;
    const condition = normalizedCondition === 'very_good' ? 'excellent' :
        normalizedCondition === 'before_renovation' ? 'requires_renovation' :
            normalizedCondition === 'project' ? 'new' :
                normalizedCondition === 'under_construction' ? 'new' :
                    normalizedCondition;
    const heating_type = listing.heatingType ? (0, czech_value_mappings_1.normalizeHeatingType)(listing.heatingType) : undefined;
    const construction_type = listing.constructionType ? (0, czech_value_mappings_1.normalizeConstructionType)(listing.constructionType) : undefined;
    const energy_class = listing.energyRating ? (0, czech_value_mappings_1.normalizeEnergyRating)(listing.energyRating) : undefined;
    // Year built & HOA fees
    const year_built = (0, idnesHelpers_1.parseYearBuiltFromAttrs)(listing._attributes);
    const hoa_fees = (0, idnesHelpers_1.parseMoneyFromAttrs)(listing._attributes, ['poplatky', 'měsíční náklady', 'náklady na bydlení', 'poplatky za služby']);
    // Agent
    const agent = listing.realtor?.name ? {
        name: listing.realtor.name,
        phone: listing.realtor.phone,
        email: listing.realtor.email,
    } : undefined;
    // Media
    const media = {
        images: listing.images || [],
        main_image: listing.images?.[0],
        virtual_tour_url: undefined
    };
    // Portal
    const source_url = listing.url;
    const source_platform = 'idnes-reality';
    const portal_id = `idnes-${listing.id}`;
    const status = 'active';
    return ({
        property_category: 'house',
        title,
        price,
        currency,
        transaction_type,
        location,
        // Czech country fields
        country_specific: {
            czech_disposition: (0, czech_value_mappings_1.normalizeDisposition)(listing.rooms || listing._attributes?.['počet místností']),
            czech_ownership: (0, czech_value_mappings_1.normalizeOwnership)(listing.ownership || listing._attributes?.['vlastnictví']),
        },
        property_subtype: mapHouseSubtype(listing._attributes?.['poloha domu']),
        bedrooms,
        bathrooms: bathrooms ?? 1,
        sqm_living,
        sqm_plot,
        sqm_total: (0, idnesHelpers_1.extractAreaFromAttrs)(listing._attributes, ['zastavěná plocha']),
        rooms,
        has_garden: amenities.has_garden,
        garden_area: (0, idnesHelpers_1.extractAreaFromAttrs)(listing._attributes, ['plocha zahrady']),
        has_garage: amenities.has_garage ?? (0, idnesHelpers_1.checkGarageFromParking)(listing._attributes),
        garage_count: (amenities.has_garage ?? (0, idnesHelpers_1.checkGarageFromParking)(listing._attributes)) ? 1 : undefined,
        has_parking: amenities.has_parking,
        parking_spaces: (0, idnesHelpers_1.parseParkingSpacesFromAttrs)(listing._attributes) ?? (amenities.has_parking ? 1 : undefined),
        has_basement: amenities.has_basement,
        cellar_area: undefined,
        has_pool: (0, idnesHelpers_1.parseBooleanFromAttr)(listing._attributes?.['bazén']),
        has_terrace: amenities.has_terrace,
        terrace_area: undefined,
        has_fireplace: undefined,
        has_balcony: amenities.has_balcony,
        balcony_area: undefined,
        stories: (0, idnesHelpers_1.extractAreaFromAttrs)(listing._attributes, ['počet podlaží']),
        year_built,
        renovation_year: (0, idnesHelpers_1.extractRenovationYearFromAttrs)(listing._attributes),
        furnished: listing.furnished ? (0, czech_value_mappings_1.normalizeFurnished)(listing.furnished) : undefined,
        published_date: listing.metadata?.published || undefined,
        condition,
        heating_type,
        construction_type,
        energy_class,
        roof_type: undefined,
        property_tax: undefined,
        hoa_fees,
        deposit: (0, idnesHelpers_1.extractDepositFromAttrs)(listing._attributes),
        utility_charges: undefined,
        service_charges: undefined,
        is_commission: (0, idnesHelpers_1.extractCommissionFromAttrs)(listing._attributes)?.is_commission,
        commission_note: (0, idnesHelpers_1.extractCommissionFromAttrs)(listing._attributes)?.commission_note,
        available_from: (0, idnesHelpers_1.extractAvailableFromAttrs)(listing._attributes),
        min_rent_days: undefined,
        max_rent_days: undefined,
        media,
        agent,
        source_url,
        source_platform,
        portal_id,
        status,
        description: listing.description || listing.title || '',
        features: listing.features || [],
        // Top-level images (required by ingest API)
        images: listing.images || [],
    });
}
function mapHouseSubtype(polohaDomu) {
    if (!polohaDomu)
        return undefined;
    const lower = polohaDomu.toLowerCase().trim();
    if (lower === 'samostatný')
        return 'detached';
    if (lower === 'řadový')
        return 'terraced';
    if (lower === 'rohový')
        return 'semi_detached';
    if (lower === 'v bloku')
        return 'terraced';
    return undefined;
}
