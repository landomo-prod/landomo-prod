"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformCommercial = transformCommercial;
const propertyDetailsMapper_1 = require("./propertyDetailsMapper");
const czech_value_mappings_1 = require("../../../shared/czech-value-mappings");
/**
 * Detect commercial subtype from title and description
 */
function detectCommercialSubtype(title, description) {
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    if (/kancel[aá]ř/.test(text))
        return 'office';
    if (/obchod|prodejna|obchodní prostor/.test(text))
        return 'retail';
    if (/sklad|skladov/.test(text))
        return 'warehouse';
    if (/výrobn[íi]|průmyslov|hala/.test(text))
        return 'industrial';
    if (/hotel|penzion|ubytov/.test(text))
        return 'hotel';
    if (/restaurac|hospoda|kavárna|bar\b|gastro/.test(text))
        return 'restaurant';
    if (/ordinace|lékař|zdravot|klinik/.test(text))
        return 'medical';
    if (/showroom|autosalon|výstav/.test(text))
        return 'showroom';
    return undefined;
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
/**
 * Classify floor location from floor number and total floors (for commercial)
 */
function classifyFloorLocation(floor, totalFloors) {
    if (floor === undefined || floor === null)
        return undefined;
    if (floor < 0)
        return 'basement';
    if (floor === 0)
        return 'ground_floor';
    if (totalFloors !== undefined && totalFloors !== null && floor >= totalFloors) {
        return 'top_floor';
    }
    return 'middle_floor';
}
function transformCommercial(jsonLd, sourceUrl, htmlData) {
    const offers = jsonLd.offers || {};
    const address = offers.areaServed?.address || {};
    // Extract sqm from name
    let sqmTotal;
    const sqmMatch = jsonLd.name?.match(/([\d\s]+)\s*m[²2]/i);
    if (sqmMatch) {
        sqmTotal = parseInt(sqmMatch[1].replace(/\s/g, ''));
    }
    // Map property details from HTML
    const mappedDetails = htmlData?.propertyDetails
        ? (0, propertyDetailsMapper_1.mapPropertyDetails)(htmlData.propertyDetails)
        : {};
    // Extract features from description and mapped details
    const description = jsonLd.description?.toLowerCase() || '';
    const hasElevator = /výtah|elevator/i.test(description);
    const hasParking = /parkování|parking|garáž|garage/i.test(description) || !!mappedDetails.parking;
    const hasBathrooms = /koupelna|wc|bathroom|toilet/i.test(description) || !!mappedDetails.bathrooms;
    const property = {
        property_category: 'commercial',
        property_type: classifyCommercialPropertyType(jsonLd.name || ''),
        source_url: sourceUrl,
        source_platform: 'ceskereality',
        status: 'active',
        // Required core fields
        title: jsonLd.name || 'Untitled',
        price: offers?.price ?? null,
        currency: offers?.priceCurrency || 'CZK',
        transaction_type: sourceUrl.includes('/pronajem/') ? 'rent' : 'sale',
        // Czech country fields
        country_specific: {
            czech_ownership: mappedDetails.ownership ? (0, czech_value_mappings_1.normalizeOwnership)(mappedDetails.ownership) : undefined,
        },
        // Required location
        location: {
            city: address?.addressLocality || undefined,
            country: 'Czech Republic',
            address: address?.streetAddress,
            postal_code: address?.postalCode,
            region: address?.addressRegion,
            ...(htmlData?.coordinates && { coordinates: htmlData.coordinates })
        },
        // Commercial subtype and classification
        property_subtype: detectCommercialSubtype(jsonLd.name, jsonLd.description),
        floor_location: classifyFloorLocation(mappedDetails.floor, mappedDetails.totalFloors),
        // Required commercial fields
        sqm_total: mappedDetails.sqm ?? sqmTotal ?? null,
        has_elevator: hasElevator || undefined,
        has_parking: hasParking || undefined,
        has_bathrooms: hasBathrooms || undefined,
        // Price per sqm
        price_per_sqm: (offers?.price && (mappedDetails.sqm || sqmTotal))
            ? Math.round(offers.price / (mappedDetails.sqm || sqmTotal))
            : undefined,
        // Optional fields from mapped details
        bathroom_count: mappedDetails.bathrooms,
        parking_spaces: mappedDetails.parkingSpaces,
        construction_type: (0, czech_value_mappings_1.normalizeConstructionType)(mappedDetails.constructionType),
        condition: (0, czech_value_mappings_1.normalizeCondition)(mappedDetails.condition),
        year_built: mappedDetails.yearBuilt,
        renovation_year: mappedDetails.renovationYear,
        heating_type: (0, czech_value_mappings_1.normalizeHeatingType)(mappedDetails.heating),
        energy_class: mappedDetails.energyClass,
        furnished: (0, czech_value_mappings_1.normalizeFurnished)(mappedDetails.furnished),
        published_date: mappedDetails.publishedDate,
        available_from: mappedDetails.availableFrom,
        deposit: mappedDetails.deposit,
        is_commission: mappedDetails.priceExcludes?.toLowerCase().includes('provize') ? true : undefined,
        commission_note: mappedDetails.priceExcludes || undefined,
        // Description
        description: jsonLd.description,
        // Images
        images: htmlData?.images && htmlData.images.length > 0 ? htmlData.images : (jsonLd.image ? [jsonLd.image] : undefined),
        // Media (structured format for ingest)
        media: {
            images: htmlData?.images && htmlData.images.length > 0
                ? htmlData.images
                : (jsonLd.image ? [jsonLd.image] : [])
        },
        // Contact
        portal_metadata: {
            agent_name: offers?.offeredby?.name,
            agent_phone: offers?.offeredby?.telephone,
            property_id: mappedDetails.propertyId,
            ownership: mappedDetails.ownership,
            hoa_fees: mappedDetails.hoaFees,
            original_details: htmlData?.propertyDetails
        }
    };
    const agentName = offers?.offeredby?.name?.trim();
    property.agent_name = agentName || undefined;
    property.agent_phone = offers?.offeredby?.telephone?.trim() || undefined;
    property.agent = agentName ? {
        name: agentName,
        phone: offers?.offeredby?.telephone?.trim(),
    } : undefined;
    return property;
}
