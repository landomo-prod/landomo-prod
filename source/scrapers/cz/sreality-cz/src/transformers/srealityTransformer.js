"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformSRealityToStandard = transformSRealityToStandard;
const czech_value_mappings_1 = require("../../../shared/czech-value-mappings");
function extractSellerInfo(seller) {
    if (!seller)
        return undefined;
    return {
        company: seller.company,
        phone: seller.phone,
        email: seller.email,
        rating: seller.rating && seller.rating > 0 ? seller.rating : undefined,
        reviews: seller.reviews && seller.reviews > 0 ? seller.reviews : undefined,
        website: seller.website,
        logo_url: seller.logo?._links?.self?.href,
        specialization: seller.specialization ? {
            sales: seller.specialization.sales || undefined,
            rentals: (seller.specialization.rentals || 0) + (seller.specialization.rentals_residential || 0)
        } : undefined
    };
}
/**
 * Transform SReality listing to StandardProperty format
 */
function transformSRealityToStandard(listing) {
    const sqm = extractSqm(listing.items);
    const sellerInfo = extractSellerInfo(listing._embedded?.seller);
    return {
        // Basic info
        title: listing.name?.value || listing.locality?.value || 'Unknown',
        price: listing.price_czk?.value_raw || listing.price || 0,
        currency: 'CZK',
        property_type: mapPropertyType(listing.seo?.category_main_cb),
        transaction_type: listing.seo?.category_type_cb === 1 ? 'sale' : 'rent',
        source_url: `https://www.sreality.cz/detail/${listing.hash_id}`,
        source_platform: 'sreality',
        // Agent/Seller information
        agent: sellerInfo ? {
            name: sellerInfo.company || 'Unknown',
            phone: sellerInfo.phone,
            email: sellerInfo.email,
            agency: sellerInfo.company
        } : undefined,
        // Location
        location: {
            address: listing.locality?.value,
            city: extractCity(listing.locality?.value || ''),
            region: listing.locality?.value,
            country: 'Czech Republic',
            coordinates: listing.map?.lon && listing.map?.lat ? {
                lat: listing.map.lat,
                lon: listing.map.lon
            } : listing.gps?.lon && listing.gps?.lat ? {
                lat: listing.gps.lat,
                lon: listing.gps.lon
            } : undefined
        },
        // Details
        details: {
            bedrooms: extractBedrooms(listing.items),
            bathrooms: extractBathrooms(listing.items),
            sqm: sqm,
            floor: extractFloor(listing.items),
            rooms: extractRooms(listing.items)
        },
        // Financial details
        price_per_sqm: listing.price && sqm ? Math.round(listing.price / sqm) : undefined,
        // Portal metadata (SReality-specific fields)
        portal_metadata: {
            sreality: {
                hash_id: listing.hash_id,
                locality_id: listing.locality_id,
                gps_lat: listing.gps?.lat || listing.map?.lat,
                gps_lon: listing.gps?.lon || listing.map?.lon,
                seo_locality: listing.seo?.locality,
                price_note: listing.price_czk?.name,
                category_main_cb: listing.seo?.category_main_cb,
                category_type_cb: listing.seo?.category_type_cb,
                advert_images_count: listing.advert_images_count,
                // Seller/Broker information
                seller_company: sellerInfo?.company,
                seller_rating: sellerInfo?.rating,
                seller_reviews: sellerInfo?.reviews,
                seller_website: sellerInfo?.website,
                seller_logo_url: sellerInfo?.logo_url,
                seller_phone: sellerInfo?.phone,
                seller_email: sellerInfo?.email,
                seller_specialization: sellerInfo?.specialization
            }
        },
        // Country-specific fields (Czech Republic) - TIER 2
        country_specific: {
            // Normalized Czech fields
            czech_disposition: (0, czech_value_mappings_1.normalizeDisposition)(extractDisposition(listing)),
            czech_ownership: (0, czech_value_mappings_1.normalizeOwnership)(extractOwnership(listing.items)),
            condition: (0, czech_value_mappings_1.normalizeCondition)(extractCondition(listing.items)),
            furnished: (0, czech_value_mappings_1.normalizeFurnished)(extractFurnished(listing.items)),
            energy_rating: (0, czech_value_mappings_1.normalizeEnergyRating)(extractEnergyRating(listing.items)),
            heating_type: (0, czech_value_mappings_1.normalizeHeatingType)(extractHeatingType(listing.items)),
            construction_type: (0, czech_value_mappings_1.normalizeConstructionType)(extractBuildingType(listing.items)),
            // Czech-specific raw values
            building_type: extractBuildingType(listing.items),
            // Building structure (if available from items)
            total_floors: extractTotalFloors(listing.items),
            // Phase 1: Area and Year fields (40-50% availability for areas, 15-25% for year)
            area_total: extractTotalArea(listing.items),
            area_plot: extractPlotArea(listing.items),
            year_built: extractYearBuilt(listing.items),
            // Infrastructure fields (Phase 2b - raw values for normalization)
            water_supply: extractWaterSupply(listing.items),
            sewage_type: extractSewageType(listing.items),
            gas_supply: extractGasSupply(listing.items),
            recently_renovated: extractRenovated(listing.items),
            // Area fields (Phase 3 enrichment - 15-30% availability)
            area_balcony: extractBalconyArea(listing.items),
            area_terrace: extractTerraceArea(listing.items),
            area_garden: extractGardenArea(listing.items),
            area_cellar: extractCellarArea(listing.items),
            area_loggia: extractLoggiaArea(listing.items),
            // Images (for Czech storage)
            image_urls: listing._links?.images?.map(img => img.href) || [],
            image_count: listing.advert_images_count
        },
        // Amenities - extracted from items array
        amenities: {
            ...extractAmenitiesFromItems(listing.items),
            has_hot_water: extractHotWater(listing.items),
        },
        // Media (enhanced)
        media: {
            images: listing._links?.images?.map(img => img.href) || [],
            total_images: listing.advert_images_count,
            // Virtual tour URL (may be available in _links, _embedded.matterport_url, or items array)
            virtual_tour_url: extractVirtualTourUrl(listing._links, listing._embedded, listing.items),
            // Tour 360 URL (extracted from items if available)
            tour_360_url: extractTour360Url(listing.items),
            // Video tour URL (extracted from items if available)
            video_tour_url: extractVideoTourUrl(listing.items),
            // Floor plan URLs (extracted from items if available)
            floor_plan_urls: extractFloorPlanUrls(listing.items)
        },
        // Backward compatibility
        images: listing._links?.images?.map(img => img.href) || [],
        description: listing.text?.value,
        description_language: 'cs',
        // Status
        status: 'active'
    };
}
/**
 * Extract water supply type
 * Detects: "Voda", "Vodovod", "Přípojka vody", "Přípojka vodovodu", "Connected", "Water supply"
 * Supports multiple field name variants for improved detection
 * Returns raw value for normalization later
 */
function extractWaterSupply(items) {
    if (!items)
        return undefined;
    const waterItem = items.find(i => {
        const name = String(i.name || '').toLowerCase();
        return name === 'voda' ||
            name === 'vodovod' ||
            name === 'water supply' ||
            name === 'přípojka vody' ||
            name === 'pripojka vody' ||
            name === 'přípojka vodovodu' ||
            name === 'pripojka vodovodu' ||
            name === 'water' ||
            name.includes('voda') ||
            name.includes('water');
    });
    if (!waterItem?.value)
        return undefined;
    // Return raw value for normalization later (handles both strings and complex values)
    const rawValue = getItemValueAsString(waterItem.value);
    return rawValue || undefined;
}
/**
 * Extract sewage type
 * Detects: "Kanalizace", "Odkanalizace", "Odpad", "Jímka", "Septic"
 * Returns raw value for normalization later
 */
function extractSewageType(items) {
    if (!items)
        return undefined;
    const sewageItem = items.find(i => {
        const name = String(i.name || '').toLowerCase();
        return name.includes('kanalizace') ||
            name.includes('odkanalizace') ||
            name.includes('odpad') ||
            name.includes('jímka') ||
            name.includes('sewage') ||
            name.includes('wastewater');
    });
    if (!sewageItem?.value)
        return undefined;
    // Return raw value for normalization later (handles both strings and complex values)
    const rawValue = getItemValueAsString(sewageItem.value);
    return rawValue || undefined;
}
/**
 * Extract gas supply availability
 * Detects: "Plyn", "Plynovod", "Přípojka plynu", "Plynové topení", "Přípojka plynovodu", "Gas"
 * Supports multiple field name variants for improved detection
 * Returns boolean (true if gas supply is available)
 */
function extractGasSupply(items) {
    if (!items)
        return undefined;
    const gasItem = items.find(i => {
        const name = String(i.name || '').toLowerCase();
        return name === 'plyn' ||
            name === 'plynovod' ||
            name === 'plynové topení' ||
            name === 'plynovate topeni' ||
            name === 'gas supply' ||
            name === 'gas' ||
            name === 'přípojka plynu' ||
            name === 'pripojka plynu' ||
            name === 'přípojka plynovodu' ||
            name === 'pripojka plynovodu' ||
            name.includes('plyn') ||
            name.includes('gas');
    });
    if (!gasItem?.value)
        return undefined;
    // Check for affirmative responses (Czech and English)
    const value = getItemValueAsString(gasItem.value).toLowerCase().trim();
    return value === 'ano' || value === 'yes' || value === 'connected' || value === 'připojena' || value === 'pripojena';
}
/**
 * Extract renovation status
 * Detects: "Rekonstrukce", "Renovace", "Po opravě", "Renovováno", "Ano"
 * Returns boolean (true if property has been recently renovated)
 */
function extractRenovated(items) {
    if (!items)
        return undefined;
    const renovationItem = items.find(i => i.name === 'Rekonstrukce' ||
        i.name === 'Renovace' ||
        i.name === 'Po opravě' ||
        i.name === 'Renovovanost' ||
        i.name === 'Renovated' ||
        (i.name && i.name.toLowerCase().includes('rekonstruk')) ||
        (i.name && i.name.toLowerCase().includes('renovat')) ||
        (i.name && i.name.toLowerCase().includes('oprava')));
    if (!renovationItem?.value)
        return undefined;
    // Check for affirmative responses
    const value = getItemValueAsString(renovationItem.value).toLowerCase().trim();
    return (value === 'ano' ||
        value === 'yes' ||
        value === 'renovováno' ||
        value === 'renovovano' ||
        value === 'rekonstruováno' ||
        value === 'rekonstruovano' ||
        value === 'po rekonstrukci' ||
        value === 'po rekonstrukci');
}
/**
 * Map SReality category to standard property type
 */
function mapPropertyType(categoryMainCb) {
    const typeMap = {
        1: 'apartment',
        2: 'house',
        3: 'land',
        4: 'commercial',
        5: 'other'
    };
    return categoryMainCb ? (typeMap[categoryMainCb] || 'other') : 'other';
}
/**
 * Extract city from locality string
 * Example: "Praha 6 - Dejvice, Podbaba" → "Praha"
 */
function extractCity(locality) {
    if (!locality)
        return 'Unknown';
    // Extract city from "Praha 6 - Dejvice, Podbaba" → "Praha"
    const cityMatch = locality.match(/^([^,-\d]+)/);
    return cityMatch ? cityMatch[1].trim() : locality.split(/[-,]/)[0]?.trim() || locality;
}
/**
 * Extract Czech disposition (e.g., "2+kk", "3+1")
 */
function extractDisposition(listing) {
    const dispItem = listing.items?.find(i => i.name === 'Dispozice');
    if (!dispItem?.value)
        return undefined;
    // Common Czech dispositions: "1+kk", "2+1", "3+kk", etc.
    const match = dispItem.value.match(/(\d\+(?:kk|1))/i);
    return match ? match[1] : undefined;
}
/**
 * Extract bedroom count from disposition or items
 */
function extractBedrooms(items) {
    if (!items)
        return undefined;
    const disposition = items.find(i => i.name === 'Dispozice')?.value;
    if (!disposition)
        return undefined;
    // Extract number from "2+kk" or "3+1"
    const match = disposition.match(/^(\d)/);
    return match ? parseInt(match[1]) : undefined;
}
/**
 * Extract bathroom count from items or default to 1
 */
function extractBathrooms(items) {
    if (!items)
        return 1;
    // Look for bathroom count in items
    const bathroomItem = items.find(i => i.name === 'Počet koupelen' ||
        i.name === 'Koupelen' ||
        i.name === 'Bathrooms' ||
        i.name?.toLowerCase().includes('koupel'));
    if (bathroomItem?.value) {
        // Extract first number from "2 koupelny", "2x Koupelna", etc.
        const match = bathroomItem.value.match(/(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
    }
    // Default to 1 for apartments/houses if not specified
    return 1;
}
/**
 * Extract square meters (living area)
 */
function extractSqm(items) {
    if (!items)
        return undefined;
    const sqmItem = items.find(i => i.name === 'Užitná plocha' ||
        i.name === 'Plocha');
    if (!sqmItem?.value)
        return undefined;
    // Extract number from "75 m²" or "75"
    const match = sqmItem.value.replace(/\s/g, '').match(/(\d+)/);
    return match ? parseFloat(match[1]) : undefined;
}
/**
 * Extract floor number
 */
function extractFloor(items) {
    if (!items)
        return undefined;
    const floorItem = items.find(i => i.name === 'Podlaží');
    if (!floorItem?.value)
        return undefined;
    // Extract number from "3. podlaží" or "přízemí"
    if (floorItem.value.toLowerCase().includes('přízemí')) {
        return 0;
    }
    const match = floorItem.value.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
}
/**
 * Extract total room count
 */
function extractRooms(items) {
    if (!items)
        return undefined;
    const disposition = items.find(i => i.name === 'Dispozice')?.value;
    if (!disposition)
        return undefined;
    // Extract total from "2+kk" = 2 rooms + kitchenette = 3 total
    const match = disposition.match(/^(\d)\+(\d|kk)/i);
    if (!match)
        return undefined;
    const baseRooms = parseInt(match[1]);
    const additional = match[2].toLowerCase() === 'kk' ? 0 : 1; // +kk = kitchenette (part of room), +1 = separate kitchen
    return baseRooms + additional;
}
/**
 * Extract ownership type (Czech-specific)
 */
function extractOwnership(items) {
    if (!items)
        return undefined;
    return items.find(i => i.name === 'Vlastnictví')?.value;
}
/**
 * Extract building type
 */
function extractBuildingType(items) {
    if (!items)
        return undefined;
    return items.find(i => i.name === 'Typ budovy')?.value ||
        items.find(i => i.name === 'Stavba')?.value;
}
/**
 * Extract property condition
 */
function extractCondition(items) {
    if (!items)
        return undefined;
    return items.find(i => i.name === 'Stav objektu')?.value;
}
/**
 * Extract furnished status
 */
function extractFurnished(items) {
    if (!items)
        return undefined;
    return items.find(i => i.name === 'Vybavení')?.value;
}
/**
 * Extract energy rating (PENB - Czech standard)
 */
function extractEnergyRating(items) {
    if (!items)
        return undefined;
    return items.find(i => i.name === 'Třída PENB')?.value;
}
/**
 * Extract heating type
 * Detects: "Vytápění", "Vytopeni", "Heating", "Topení", "Heating type"
 * Supports multiple field name variants for improved detection
 */
function extractHeatingType(items) {
    if (!items)
        return undefined;
    const heatingItem = items.find(i => {
        const name = String(i.name || '').toLowerCase();
        return name === 'vytápění' ||
            name === 'vytopeni' ||
            name === 'heating' ||
            name === 'heating type' ||
            name === 'topení' ||
            name === 'topeni' ||
            name.includes('vytápění') ||
            name.includes('vytopeni') ||
            name.includes('heating');
    });
    return heatingItem?.value;
}
/**
 * Extract total floors from items
 */
function extractTotalFloors(items) {
    if (!items)
        return undefined;
    const floorsItem = items.find(i => i.name === 'Počet podlaží' ||
        i.name === 'Počet pater' ||
        i.name === 'Pater v domě');
    if (!floorsItem?.value)
        return undefined;
    const match = floorsItem.value.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
}
/**
/**
 * Extract virtual tour URL from multiple sources:
 * 1. _links (common virtual tour link keys)
 * 2. _embedded.matterport_url (Matterport 3D tour)
 * 3. items array (Czech field names for video tours)
 */
function extractVirtualTourUrl(links, embedded, items) {
    // Priority 1: Check _embedded.matterport_url (direct Matterport URL)
    if (embedded?.matterport_url) {
        return embedded.matterport_url;
    }
    // Priority 2: Check _links for common virtual tour link keys
    if (links) {
        const tourLink = links['virtual-tour'] ||
            links['virtualni-prohlídka'] ||
            links['matterport'] ||
            links['tour-360'] ||
            links['360tour'];
        if (tourLink?.href) {
            return tourLink.href;
        }
    }
    // Priority 3: Check items array for "Videopřehlídka" (video tour) as fallback
    if (items) {
        const videoTourItem = items.find(i => i.name === 'Videopřehlídka' ||
            i.name === 'Video tour');
        if (videoTourItem?.value && typeof videoTourItem.value === 'string') {
            const valueStr = getItemValueAsString(videoTourItem.value);
            if (valueStr && valueStr.startsWith('http')) {
                return valueStr;
            }
        }
    }
    return undefined;
}
/**
 * Extract 360-degree tour URL from items array
 * Looks for: "360", "360°", "360° prohlídka", "Prohlídka"
 */
function extractTour360Url(items) {
    if (!items)
        return undefined;
    const tour360Item = items.find(i => {
        const name = i.name?.toLowerCase() || '';
        return name.includes('360') ||
            name === 'prohlídka' ||
            name === 'tour' ||
            name === '360-degree' ||
            name === '360°';
    });
    if (tour360Item?.value && typeof tour360Item.value === 'string') {
        const valueStr = getItemValueAsString(tour360Item.value);
        if (valueStr && valueStr.startsWith('http')) {
            return valueStr;
        }
    }
    return undefined;
}
/**
 * Extract video tour URL from items array
 * Looks for: "Videopřehlídka", "Video tour", "Video"
 */
function extractVideoTourUrl(items) {
    if (!items)
        return undefined;
    const videoTourItem = items.find(i => {
        const name = i.name?.toLowerCase() || '';
        return name.includes('videopřehlídka') ||
            name.includes('video') ||
            (name.includes('tour') && name.includes('video'));
    });
    if (videoTourItem?.value && typeof videoTourItem.value === 'string') {
        const valueStr = getItemValueAsString(videoTourItem.value);
        if (valueStr && valueStr.startsWith('http')) {
            return valueStr;
        }
    }
    return undefined;
}
function extractFloorPlanUrls(items) {
    if (!items)
        return undefined;
    const floorPlans = [];
    // Look for floor plan items
    items.forEach(item => {
        if (item.name?.toLowerCase().includes('půdorys') ||
            item.name?.toLowerCase().includes('floor plan') ||
            item.name?.toLowerCase().includes('dispozice')) {
            // If value is a URL
            if (item.value?.startsWith('http')) {
                floorPlans.push(item.value);
            }
        }
    });
    return floorPlans.length > 0 ? floorPlans : undefined;
}
/**
 * Extract amenities from items array by looking for Czech amenity terms
 * Phase 2a: Enhanced extraction with 6 targeted fields for +15-20% enrichment
 */
function extractAmenitiesFromItems(items) {
    if (!items)
        return {};
    const amenities = {};
    // Use dedicated extractors for each amenity type
    amenities.has_ac = extractAC(items);
    amenities.has_security = extractSecurity(items);
    amenities.has_fireplace = extractFireplace(items);
    amenities.has_balcony = extractBalcony(items);
    amenities.has_terrace = extractTerrace(items);
    amenities.has_elevator = extractElevator(items);
    // Accessibility - maps to is_barrier_free
    amenities.is_barrier_free = extractAccessibility(items);
    // Legacy amenities
    amenities.has_parking = extractParking(items);
    amenities.has_garage = extractGarage(items);
    amenities.has_basement = extractBasement(items);
    amenities.has_hot_water = extractHotWater(items);
    return amenities;
}
/**
 * Extract AC/Air Conditioning amenity
 * Czech terms: "Klimatizace", "Klimatizace v bytě", "Klimatizační jednotka"
 * English terms: "Air conditioning", "AC"
 * Expected values: "Ano", "ano", "Yes", "yes", "Connected", "true", or numeric values
 * Availability target: 25-35%
 */
function extractAC(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const name = item.name?.toLowerCase() || '';
        // Check item name for AC-related keywords
        if (name.includes('klimatizace') || name.includes('air condition') || name.includes('ac')) {
            // Check value for positive indicators (handles both numeric and string values)
            // Pass raw value to isPositiveValue to handle numeric values
            if (isPositiveValue(item.value)) {
                return true;
            }
        }
    }
    return undefined;
}
/**
 * Extract Security System amenity
 * Czech terms: "Bezpečnostní systém", "Alarm", "Kamera", "Bezpečnost"
 * English terms: "Security system", "Alarm", "Camera"
 * Expected values: "Ano", "ano", "Yes", "yes", "Connected", "true", or numeric values
 * Availability target: 20-30%
 */
function extractSecurity(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const name = item.name?.toLowerCase() || '';
        // Check item name for security-related keywords
        if (name.includes('bezpečnostní') ||
            name.includes('alarm') ||
            name.includes('kamera') ||
            name.includes('bezpečnost') ||
            name.includes('security') ||
            name.includes('camera')) {
            // Check value for positive indicators (handles both numeric and string values)
            // Pass raw value to isPositiveValue to handle numeric values
            if (isPositiveValue(item.value)) {
                return true;
            }
        }
    }
    return undefined;
}
/**
 * Extract Fireplace amenity
 * Czech terms: "Krb", "Krbová kamna", "Krby"
 * English terms: "Fireplace"
 * Expected values: "Ano", "ano", "Yes", "yes", "Connected", "true", or numeric values
 * Availability target: 10-15%
 */
function extractFireplace(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const name = item.name?.toLowerCase() || '';
        // Check item name for fireplace-related keywords
        if (name.includes('krb') || name.includes('fireplace')) {
            // Check value for positive indicators (handles both numeric and string values)
            // Pass raw value to isPositiveValue to handle numeric values
            if (isPositiveValue(item.value)) {
                return true;
            }
        }
    }
    return undefined;
}
/**
 * Extract Balcony amenity (improved)
 * Czech terms: "Balkón", "Balkón v bytě", "Terasa, balkón"
 * English terms: "Balcony"
 * Expected values: "Ano", "ano", "Yes", "yes", "Connected", "true", or numeric area values (3, 13, etc.)
 * Availability target: 40-50% -> ~70% with numeric value support
 */
function extractBalcony(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const name = item.name?.toLowerCase() || '';
        // Check item name for balcony-related keywords
        if (name.includes('balkón') || name.includes('balcony')) {
            // Check value for positive indicators (handles both numeric and string values)
            // Pass raw value to isPositiveValue to handle numeric area values (3, 13, etc.)
            if (isPositiveValue(item.value)) {
                return true;
            }
        }
    }
    return undefined;
}
/**
 * Extract Terrace amenity (improved)
 * Czech terms: "Terasa", "Terasa v bytě", "Zahrada"
 * English terms: "Terrace", "Patio"
 * Expected values: "Ano", "ano", "Yes", "yes", "Connected", "true", or numeric area values (3, 13, etc.)
 * Availability target: 40-50% -> ~70% with numeric value support
 */
function extractTerrace(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const name = item.name?.toLowerCase() || '';
        // Check item name for terrace-related keywords
        if (name.includes('terasa') || name.includes('terrace') || name.includes('patio')) {
            // Check value for positive indicators (handles both numeric and string values)
            // Pass raw value to isPositiveValue to handle numeric area values (3, 13, etc.)
            if (isPositiveValue(item.value)) {
                return true;
            }
        }
    }
    return undefined;
}
/**
 * Extract Elevator amenity (improved)
 * Czech terms: "Výtah", "Ascensor", "Výtah v domě"
 * English terms: "Elevator", "Lift"
 * Expected values: "Ano", "ano", "Yes", "yes", "Connected", "true", or numeric values
 * Availability target: 35-45%
 */
function extractElevator(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const name = item.name?.toLowerCase() || '';
        // Check item name for elevator-related keywords
        if (name.includes('výtah') || name.includes('ascensor') || name.includes('elevator') || name.includes('lift')) {
            // Check value for positive indicators (handles both numeric and string values)
            // Pass raw value to isPositiveValue to handle numeric values
            if (isPositiveValue(item.value)) {
                return true;
            }
        }
    }
    return undefined;
}
/**
 * Extract Parking amenity (improved)
 */
function extractParking(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const name = item.name?.toLowerCase() || '';
        // Check item name for parking-related keywords
        if (name.includes('parkování') || name.includes('parking')) {
            // Check value for positive indicators (handles both numeric and string values)
            if (isPositiveValue(item.value)) {
                return true;
            }
        }
    }
    return undefined;
}
/**
 * Extract Garage amenity (improved)
 */
function extractGarage(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const value = getItemValueAsString(item.value).toLowerCase();
        // Check value for garage-related keywords
        if (value.includes('garáž') || value.includes('garage')) {
            return true;
        }
    }
    return undefined;
}
/**
 * Extract Basement amenity (improved)
 */
function extractBasement(items) {
    if (!items)
        return undefined;
    for (const item of items) {
        const value = getItemValueAsString(item.value).toLowerCase();
        // Check value for basement-related keywords
        if (value.includes('sklep') || value.includes('basement')) {
            return true;
        }
    }
    return undefined;
}
/**
 * Helper function to safely convert item value to string
 * Handles numeric values, undefined, null, string values, and complex objects/arrays
 * For arrays: extracts value from first item if it has a value property
 * For objects: returns as-is for further processing
 */
function getItemValueAsString(value) {
    if (value === null || value === undefined)
        return '';
    if (typeof value === 'string')
        return value;
    // Handle array of objects (e.g., [{ name: 'Voda', value: 'Vodovod' }])
    if (Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        if (typeof firstItem === 'object' && firstItem !== null && 'value' in firstItem) {
            return getItemValueAsString(firstItem.value);
        }
        if (typeof firstItem === 'string') {
            return firstItem;
        }
    }
    return String(value);
}
/**
 * Helper function to determine if a value is positive
 * Handles numeric values > 0 (areas, counts, etc.) and string indicators
 * Czech: "Ano", "ano", "Yes", "yes", "Connected", "true"
 * English: "Yes", "yes", "true"
 */
function isPositiveValue(value) {
    if (value === undefined || value === null)
        return false;
    // Numeric values > 0 are positive (areas, counts, etc.)
    if (typeof value === 'number') {
        return value > 0;
    }
    // String values
    const str = String(value).toLowerCase().trim();
    if (str === '' || str === 'ne' || str === 'no' || str === 'false') {
        return false;
    }
    // Check for positive indicators
    return str.includes('ano') ||
        str.includes('yes') ||
        str.includes('true') ||
        str.includes('máme') ||
        str.includes('je') ||
        str.includes('existuje') ||
        str.includes('connected');
}
/**
 * Extract total area (Celková plocha)
 * Phase 1: Parses numeric value from items like "150 m²", "150m²", "150,5 m²"
 * Handles both dot and comma as decimal separators
 * Availability target: 40-50%
 */
function extractTotalArea(items) {
    if (!items)
        return undefined;
    const areaItem = items.find(i => i.name === 'Celková plocha' ||
        i.name === 'Plocha' ||
        i.name === 'Celková area' ||
        i.name === 'Total area');
    if (!areaItem?.value)
        return undefined;
    // Remove spaces and normalize: "150 m²" or "150,5 m²" → "150" or "150,5"
    const valueStr = getItemValueAsString(areaItem.value);
    const normalized = valueStr
        .replace(/\s+/g, '')
        .replace(/m²|m2/gi, '')
        .trim();
    // Handle both dot and comma as decimal separator
    const number = normalized.replace(',', '.');
    const parsed = parseFloat(number);
    return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}
/**
 * Extract plot area (Plocha pozemku)
 * Phase 1: Parses numeric value from items like "500 m²", "500,5 m²"
 * Handles both dot and comma as decimal separators
 * Availability target: 30-40%
 */
function extractPlotArea(items) {
    if (!items)
        return undefined;
    const plotItem = items.find(i => i.name === 'Plocha pozemku' ||
        i.name === 'Parcela' ||
        i.name === 'Plot area' ||
        i.name === 'Pozemek' ||
        i.name === 'Land area');
    if (!plotItem?.value)
        return undefined;
    // Remove spaces and normalize: "500 m²" or "500,5 m²" → "500" or "500,5"
    const valueStr = getItemValueAsString(plotItem.value);
    const normalized = valueStr
        .replace(/\s+/g, '')
        .replace(/m²|m2/gi, '')
        .trim();
    // Handle both dot and comma as decimal separator
    const number = normalized.replace(',', '.');
    const parsed = parseFloat(number);
    return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}
/**
 * Extract year built (Rok postavení/Rok výstavby)
 * Phase 1: Extracts 4-digit year from items
 * Validates year is within reasonable range (1800-2100)
 * Availability target: 15-25%
 */
function extractYearBuilt(items) {
    if (!items)
        return undefined;
    const yearItem = items.find(i => i.name === 'Rok postavení' ||
        i.name === 'Rok výstavby' ||
        i.name === 'Rok výstavby domu' ||
        i.name === 'Year built' ||
        i.name === 'Construction year');
    if (!yearItem?.value)
        return undefined;
    // Extract 4-digit year (1800-2100)
    const match = yearItem.value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
    const year = match ? parseInt(match[0]) : undefined;
    return year && year >= 1800 && year <= 2100 ? year : undefined;
} /**
 * Extract balcony area in square meters
 * Parses field names: "Plocha balkónu", "Balkón plocha", "Balkón (m²)"
 * Returns number (sqm) or undefined
 */
function extractBalconyArea(items) {
    if (!items)
        return undefined;
    const balconyItem = items.find(i => i.name === 'Balkón' || i.name === 'Plocha balkónu' ||
        i.name === 'Balkón plocha' ||
        i.name === 'Balkón (m²)' ||
        (i.name?.toLowerCase().includes('balkón') && i.name?.toLowerCase().includes('plocha')));
    if (!balconyItem?.value)
        return undefined;
    // Extract number from "15 m²", "15m²", "15", "15,5", "15.5"
    const valueStr = getItemValueAsString(balconyItem.value);
    const match = valueStr.replace(/\s/g, '').replace(',', '.').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : undefined;
}
/**
 * Extract terrace area in square meters
 * Parses field names: "Plocha terasy", "Terasa plocha", "Terasa (m²)"
 * Returns number (sqm) or undefined
 */
function extractTerraceArea(items) {
    if (!items)
        return undefined;
    const terraceItem = items.find(i => i.name === 'Terasa' || i.name === 'Plocha terasy' ||
        i.name === 'Terasa plocha' ||
        i.name === 'Terasa (m²)' ||
        (i.name?.toLowerCase().includes('terasa') && i.name?.toLowerCase().includes('plocha')));
    if (!terraceItem?.value)
        return undefined;
    // Extract number from "15 m²", "15m²", "15", "15,5", "15.5"
    const valueStr = getItemValueAsString(terraceItem.value);
    const match = valueStr.replace(/\s/g, '').replace(',', '.').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : undefined;
}
/**
 * Extract garden area in square meters
 * Parses field names: "Plocha zahrady", "Zahrada plocha", "Zahrada (m²)"
 * Returns number (sqm) or undefined
 */
function extractGardenArea(items) {
    if (!items)
        return undefined;
    const gardenItem = items.find(i => i.name === 'Zahrada' || i.name === 'Plocha zahrady' ||
        i.name === 'Zahrada plocha' ||
        i.name === 'Zahrada (m²)' ||
        (i.name?.toLowerCase().includes('zahrada') && i.name?.toLowerCase().includes('plocha')));
    if (!gardenItem?.value)
        return undefined;
    // Extract number from "15 m²", "15m²", "15", "15,5", "15.5"
    const valueStr = getItemValueAsString(gardenItem.value);
    const match = valueStr.replace(/\s/g, '').replace(',', '.').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : undefined;
}
/**
 * Extract cellar/basement area in square meters
 * Parses field names: "Plocha sklepa", "Sklep plocha", "Sklep (m²)"
 * Returns number (sqm) or undefined
 */
function extractCellarArea(items) {
    if (!items)
        return undefined;
    const cellarItem = items.find(i => i.name === 'Sklep' || i.name === 'Plocha sklepa' ||
        i.name === 'Sklep plocha' ||
        i.name === 'Sklep (m²)' ||
        (i.name?.toLowerCase().includes('sklep') && i.name?.toLowerCase().includes('plocha')));
    if (!cellarItem?.value)
        return undefined;
    // Extract number from "15 m²", "15m²", "15", "15,5", "15.5"
    const valueStr = getItemValueAsString(cellarItem.value);
    const match = valueStr.replace(/\s/g, '').replace(',', '.').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : undefined;
}
/**
 * Extract loggia area in square meters
 * Parses field names: "Plocha lodžie", "Lodžie plocha", "Lodžie (m²)"
 * Returns number (sqm) or undefined
 */
function extractLoggiaArea(items) {
    if (!items)
        return undefined;
    const loggiaItem = items.find(i => i.name === 'Lodžie' || i.name === 'Plocha lodžie' ||
        i.name === 'Lodžie plocha' ||
        i.name === 'Lodžie (m²)' ||
        (i.name?.toLowerCase().includes('lodžie') && i.name?.toLowerCase().includes('plocha')));
    if (!loggiaItem?.value)
        return undefined;
    // Extract number from "15 m²", "15m²", "15", "15,5", "15.5"
    const valueStr = getItemValueAsString(loggiaItem.value);
    const match = valueStr.replace(/\s/g, '').replace(',', '.').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : undefined;
}
/**
 * Extract hot water availability
 * Detects: "Teplá voda", "Ohřev vody", "Hot water"
 * Looks for affirmative responses: "Ano", "yes", "Connected", "Připojená"
 * Returns boolean or undefined
 */
function extractHotWater(items) {
    if (!items)
        return undefined;
    const hotWaterItem = items.find(i => i.name === 'Teplá voda' ||
        i.name === 'Ohřev vody' ||
        i.name === 'Hot water' ||
        i.name?.toLowerCase().includes('teplá voda') ||
        i.name?.toLowerCase().includes('ohřev vody'));
    if (!hotWaterItem?.value)
        return undefined;
    // Check for affirmative responses (Czech and English)
    const value = getItemValueAsString(hotWaterItem.value).toLowerCase().trim();
    return (value === 'ano' ||
        value === 'yes' ||
        value === 'connected' ||
        value === 'připojená' ||
        value === 'pripojena' ||
        value === 'připojena');
}
/**
 * Extract built area (zastavěná plocha) in square meters
 * Parses field names: "Zastavěná plocha", "Zastavena plocha", "Built area", "Stavební plocha"
 * Handles field name variations with and without diacritics
 * Returns number (sqm) or undefined
 */
function extractBuiltArea(items) {
    if (!items)
        return undefined;
    const builtItem = items.find(i => {
        const name = String(i.name || '').toLowerCase();
        return name === 'zastavěná plocha' ||
            name === 'zastavena plocha' ||
            name === 'built area' ||
            name === 'stavební plocha' ||
            name === 'stavebni plocha' ||
            (name.includes('zastavěná') || name.includes('zastavena')) ||
            (name.includes('built') && name.includes('area')) ||
            (name.includes('staveb') && name.includes('plocha'));
    });
    if (!builtItem?.value)
        return undefined;
    // Extract number from "150 m²", "150m²", "150", "150,5", "150.5"
    const valueStr = getItemValueAsString(builtItem.value);
    const match = valueStr.replace(/\s/g, '').replace(',', '.').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : undefined;
}
/**
 * Extract wheelchair accessibility amenity
 * Czech terms: "Bezbariérový", "Bezbariérová", "Bez bariér", "Bezbariérový přístup"
 * English terms: "Wheelchair accessible", "Accessibility", "Barrier-free"
 * Expected values: "Ano", "ano", "Yes", "yes", "Connected", "true", or numeric values
 * Availability target: 10-15%
 */
function extractAccessibility(items) {
    if (!items)
        return undefined;
    const accessItem = items.find(i => {
        const name = String(i.name || '').toLowerCase();
        return name.includes('bezbariérový') ||
            name.includes('bezbariérová') ||
            name.includes('bez bariér') ||
            name.includes('bezbariér') ||
            name.includes('barrier') ||
            name.includes('wheelchair') ||
            name.includes('accessibility') ||
            name.includes('accessible');
    });
    if (!accessItem)
        return undefined;
    // Check value for positive indicators (handles both numeric and string values)
    // Use isPositiveValue() helper to handle various positive value formats
    return isPositiveValue(accessItem.value) ? true : undefined;
}
