"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformIdnesApartment = transformIdnesApartment;
const czech_value_mappings_1 = require("../../../../shared/czech-value-mappings");
const idnesHelpers_1 = require("../../utils/idnesHelpers");
/**
 * Transform Idnes Apartment to ApartmentPropertyTierI
 *
 * Apartment-specific fields:
 * - bedrooms (from rooms)
 * - floor, total_floors
 * - has_elevator, has_balcony, has_basement
 * - floor_location (ground/middle/top)
 */
function transformIdnesApartment(listing) {
    // ============ Core Identification ============
    const title = listing.title || 'Untitled';
    const price = listing.price ?? null;
    const currency = 'CZK';
    const transaction_type = (0, idnesHelpers_1.mapTransactionType)(listing.transactionType);
    // ============ Location ============
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
    // ============ Apartment-Specific Details ============
    const bedrooms = (0, idnesHelpers_1.extractBedroomsFromDisposition)(listing.rooms) ?? null;
    const bathrooms = (0, idnesHelpers_1.parseBathroomsFromAttrs)(listing._attributes);
    const sqm = listing.area ?? null;
    const floor = listing.floor ?? (0, idnesHelpers_1.parseFloorFromAttrs)(listing._attributes);
    const total_floors = (0, idnesHelpers_1.parseTotalFloorsFromAttrs)(listing._attributes);
    const rooms = (0, idnesHelpers_1.parseRooms)(listing.rooms);
    // ============ Area Breakdowns (from _attributes, keys are lowercase) ============
    const balcony_area = (0, idnesHelpers_1.parseAreaFromAttrs)(listing._attributes, ['plocha balkonu', 'balkón', 'balkon']);
    const loggia_area = (0, idnesHelpers_1.parseAreaFromAttrs)(listing._attributes, ['plocha lodžie', 'lodžie']);
    const terrace_area = (0, idnesHelpers_1.parseAreaFromAttrs)(listing._attributes, ['plocha terasy', 'terasa']);
    const cellar_area = (0, idnesHelpers_1.parseAreaFromAttrs)(listing._attributes, ['plocha sklepa', 'sklep']);
    // ============ Amenities (from _attributes, not features[] which is empty for idnes) ============
    const amenities = (0, idnesHelpers_1.parseAmenitiesFromAttrs)(listing._attributes);
    const has_elevator = amenities.has_elevator;
    const has_balcony = amenities.has_balcony ?? (balcony_area !== undefined ? true : undefined);
    const has_basement = amenities.has_basement ?? (cellar_area !== undefined ? true : undefined);
    const has_parking = amenities.has_parking;
    const parking_spaces = (0, idnesHelpers_1.parseParkingSpacesFromAttrs)(listing._attributes);
    const has_garage = amenities.has_garage ?? (0, idnesHelpers_1.checkGarageFromParking)(listing._attributes);
    // ============ Building Context ============
    const normalizedCondition = listing.condition ? (0, czech_value_mappings_1.normalizeCondition)(listing.condition) : undefined;
    const condition = normalizedCondition === 'very_good' ? 'excellent' :
        normalizedCondition === 'before_renovation' ? 'requires_renovation' :
            normalizedCondition === 'project' ? 'new' :
                normalizedCondition === 'under_construction' ? 'new' :
                    normalizedCondition;
    const heating_type = listing.heatingType ? (0, czech_value_mappings_1.normalizeHeatingType)(listing.heatingType) : undefined;
    const construction_type = listing.constructionType ? (0, czech_value_mappings_1.normalizeConstructionType)(listing.constructionType) : undefined;
    const energy_class = listing.energyRating ? (0, czech_value_mappings_1.normalizeEnergyRating)(listing.energyRating) : undefined;
    // Floor location
    const floor_location = (0, idnesHelpers_1.extractFloorLocation)(floor, total_floors);
    // ============ Financials ============
    const deposit = (0, idnesHelpers_1.extractDepositFromAttrs)(listing._attributes);
    const hoa_fees = (0, idnesHelpers_1.parseMoneyFromAttrs)(listing._attributes, ['poplatky', 'měsíční náklady', 'náklady na bydlení', 'poplatky za služby']);
    const year_built = (0, idnesHelpers_1.parseYearBuiltFromAttrs)(listing._attributes);
    // ============ Agent ============
    const agent = listing.realtor?.name ? {
        name: listing.realtor.name,
        phone: listing.realtor.phone,
        email: listing.realtor.email,
    } : undefined;
    // ============ Tier 1 Universal Fields ============
    const furnished = listing.furnished ? (0, czech_value_mappings_1.normalizeFurnished)(listing.furnished) : undefined;
    const renovation_year = (0, idnesHelpers_1.extractRenovationYearFromAttrs)(listing._attributes);
    const published_date = listing.metadata?.published || undefined;
    // ============ Rental-Specific ============
    const available_from = (0, idnesHelpers_1.extractAvailableFromAttrs)(listing._attributes);
    // ============ Commission ============
    const commission = (0, idnesHelpers_1.extractCommissionFromAttrs)(listing._attributes);
    // ============ Media ============
    const media = {
        images: listing.images || [],
        main_image: listing.images?.[0],
        virtual_tour_url: undefined
    };
    // ============ Portal & Lifecycle ============
    const source_url = listing.url;
    const source_platform = 'idnes-reality';
    const portal_id = `idnes-${listing.id}`;
    const status = 'active';
    // ============ Description ============
    const description = listing.description || listing.title || '';
    // ============ Features ============
    const features = listing.features || [];
    // ============ Assemble ApartmentPropertyTierI ============
    return ({
        // Category
        property_category: 'apartment',
        // Core
        title,
        price,
        currency,
        transaction_type,
        // Location
        location,
        // Classification
        property_subtype: undefined,
        // Czech country fields
        country_specific: {
            czech_disposition: (0, czech_value_mappings_1.normalizeDisposition)(listing.rooms || listing._attributes?.['počet místností'] || (0, idnesHelpers_1.extractDispositionFromTitle)(listing.title)),
            czech_ownership: (0, czech_value_mappings_1.normalizeOwnership)(listing.ownership || listing._attributes?.['vlastnictví']),
        },
        // Apartment Details
        bedrooms,
        bathrooms: bathrooms ?? 1,
        sqm,
        floor,
        total_floors,
        rooms,
        // Amenities
        has_elevator,
        has_balcony,
        balcony_area,
        has_basement,
        cellar_area,
        has_parking,
        parking_spaces,
        has_loggia: amenities.has_loggia ?? (0, idnesHelpers_1.parseBooleanFromAttr)(listing._attributes?.['lodžie']) ?? (loggia_area !== undefined ? true : undefined),
        loggia_area,
        has_terrace: amenities.has_terrace ?? (terrace_area !== undefined ? true : undefined),
        terrace_area,
        has_garage,
        // Building
        condition,
        heating_type,
        construction_type,
        energy_class,
        floor_location,
        year_built,
        furnished,
        renovation_year,
        published_date,
        // Financials
        hoa_fees,
        deposit,
        utility_charges: undefined,
        service_charges: undefined,
        is_commission: commission?.is_commission,
        commission_note: commission?.commission_note,
        // Rental
        available_from,
        min_rent_days: undefined,
        max_rent_days: undefined,
        // Media & Agent
        media,
        agent,
        // Portal
        source_url,
        source_platform,
        portal_id,
        status,
        // Description & Features
        description,
        features,
        // Top-level images (required by ingest API)
        images: listing.images || [],
    });
}
