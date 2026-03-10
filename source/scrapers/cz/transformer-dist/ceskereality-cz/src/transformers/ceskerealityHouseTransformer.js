"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformHouse = transformHouse;
const propertyDetailsMapper_1 = require("./propertyDetailsMapper");
const czech_value_mappings_1 = require("../../../shared/czech-value-mappings");
/**
 * Detect house subtype from URL, title, and description
 */
function detectHouseSubtype(sourceUrl, title, description) {
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    // URL-based: cottages category
    if (sourceUrl.includes('/chaty-chalupy/'))
        return 'cottage';
    if (/chalupa|chata|rekreační/.test(text))
        return 'cottage';
    if (/vila|villa/.test(text))
        return 'villa';
    if (/řadov[ýáé]|řadový dům/.test(text))
        return 'terraced';
    if (/dvojdomek|dvoj[gG]eneračn|polovina/.test(text))
        return 'semi_detached';
    if (/usedlost|statek|farma|zemědělsk/.test(text))
        return 'farmhouse';
    if (/bungalov/.test(text))
        return 'bungalow';
    if (/rodinný dům|rodinné domy/.test(text))
        return 'detached';
    return undefined;
}
function transformHouse(jsonLd, sourceUrl, htmlData) {
    const offers = jsonLd.offers || {};
    const address = offers.areaServed?.address || {};
    // Extract bedroom count from name (e.g., "5+1" → 4, "4+kk" → 3)
    let bedrooms;
    const dispositionMatch = jsonLd.name?.match(/(\d+\+(?:kk|\d))/i);
    const nameMatch = dispositionMatch;
    if (nameMatch) {
        bedrooms = parseInt(nameMatch[1]) - 1;
    }
    // Fallback: extract bedrooms from description
    const description = jsonLd.description || '';
    if (!bedrooms) {
        const bedroomMatch = description.match(/(\d+)\s*(?:ložnic|ložník)/i);
        if (bedroomMatch) {
            bedrooms = parseInt(bedroomMatch[1]);
        }
        else {
            const roomMatch = description.match(/(\d+)\s*(?:pokojů|pokoje|pokoj)/i);
            if (roomMatch) {
                bedrooms = Math.max(parseInt(roomMatch[1]) - 1, 0);
            }
            else {
                const dispMatch = description.match(/(\d+)\+(?:kk|\d)/i);
                if (dispMatch) {
                    bedrooms = parseInt(dispMatch[1]) - 1;
                }
            }
        }
    }
    // Extract sqm from name
    let sqmLiving;
    let sqmPlot;
    const sqmMatch = jsonLd.name?.match(/([\d\s]+)\s*m[²2]/i);
    if (sqmMatch) {
        sqmLiving = parseInt(sqmMatch[1].replace(/\s/g, ''));
    }
    // Try to extract plot size from description (multiple patterns, handle space-separated numbers)
    const plotPatterns = [
        /pozemek[^\d]*([\d\s]+)\s*m[²2]/i,
        /pozemku\s*o?\s*(?:výměře|rozloze|celkové)?\s*([\d\s]+)\s*m[²2]/i,
        /zahrada[^\d]*([\d\s]+)\s*m[²2]/i,
        /plocha\s*pozemku[^\d]*([\d\s]+)\s*m[²2]/i
    ];
    for (const pattern of plotPatterns) {
        const plotMatch = description.match(pattern);
        if (plotMatch) {
            sqmPlot = parseInt(plotMatch[1].replace(/\s/g, ''));
            break;
        }
    }
    // Map property details from HTML
    const mappedDetails = htmlData?.propertyDetails
        ? (0, propertyDetailsMapper_1.mapPropertyDetails)(htmlData.propertyDetails)
        : {};
    // Extract features from description and mapped details
    const descLower = description.toLowerCase();
    const hasGarden = /zahrada|garden/i.test(descLower);
    const hasGarage = /garáž|garage/i.test(descLower) || !!mappedDetails.garageCount;
    const hasParking = /parkování|parking/i.test(descLower) || !!mappedDetails.parking;
    const hasBasement = /sklep|basement|cellar/i.test(descLower) || !!mappedDetails.cellarArea;
    const property = {
        property_category: 'house',
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
            czech_disposition: dispositionMatch ? (0, czech_value_mappings_1.normalizeDisposition)(dispositionMatch[1]) : undefined,
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
        // House subtype
        property_subtype: detectHouseSubtype(sourceUrl, jsonLd.name, jsonLd.description),
        // Required house fields - fallback to rooms from HTML details
        bedrooms: bedrooms ?? (mappedDetails.rooms ? Math.max(mappedDetails.rooms - 1, 0) : null),
        sqm_living: mappedDetails.sqmLiving ?? sqmLiving ?? null,
        sqm_plot: mappedDetails.sqmPlot ?? sqmPlot ?? null,
        has_garden: hasGarden || undefined,
        has_garage: hasGarage || undefined,
        has_parking: hasParking || undefined,
        has_basement: hasBasement || undefined,
        // Optional area/feature fields
        cellar_area: mappedDetails.cellarArea,
        terrace_area: mappedDetails.terraceArea,
        balcony_area: mappedDetails.balconyArea,
        has_terrace: mappedDetails.hasTerrace || !!mappedDetails.terraceArea || undefined,
        has_balcony: mappedDetails.hasBalcony || !!mappedDetails.balconyArea || undefined,
        // Optional fields from mapped details
        rooms: mappedDetails.rooms,
        bathrooms: mappedDetails.bathrooms ?? 1,
        stories: mappedDetails.totalFloors,
        garage_count: mappedDetails.garageCount,
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
        sqm_total: mappedDetails.sqmBuilt || undefined,
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
            water: mappedDetails.water,
            sewage: mappedDetails.sewage,
            electricity: mappedDetails.electricity,
            gas: mappedDetails.gas,
            parking_info: mappedDetails.parking,
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
