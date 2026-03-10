"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformLand = transformLand;
const propertyDetailsMapper_1 = require("./propertyDetailsMapper");
const czech_value_mappings_1 = require("../../../shared/czech-value-mappings");
/**
 * Detect land subtype from title and description
 */
function detectLandSubtype(title, description) {
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    if (/stavební|stavba|zastavitelný/.test(text))
        return 'building_plot';
    if (/les|lesní/.test(text))
        return 'forest';
    if (/vinice|vinohrad/.test(text))
        return 'vineyard';
    if (/sad(?:\s|,|$)|ovocný/.test(text))
        return 'orchard';
    if (/rekreač|zahrad/.test(text))
        return 'recreational';
    if (/průmyslov|komerční|skladov/.test(text))
        return 'industrial';
    if (/orná|zemědělsk|pole/.test(text))
        return 'agricultural';
    return undefined;
}
/**
 * Classify land property_type from Czech title
 */
function classifyLandPropertyType(title) {
    const t = title.toLowerCase();
    if (t.includes('stavební'))
        return 'building_plot';
    if (t.includes('pole') || t.includes('orná'))
        return 'field';
    if (t.includes('zahrad'))
        return 'garden';
    if (t.includes('les'))
        return 'forest';
    if (t.includes('komerční'))
        return 'commercial_plot';
    if (t.includes('louk'))
        return 'meadow';
    if (t.includes('sad') || t.includes('vinic'))
        return 'orchard';
    if (t.includes('rybník') || t.includes('vodní'))
        return 'water';
    return 'other';
}
function mapRoadAccess(value) {
    if (!value)
        return undefined;
    const lower = value.toLowerCase();
    if (lower.includes('asfalt'))
        return 'paved';
    if (lower.includes('šotolina') || lower.includes('štěrk'))
        return 'gravel';
    if (lower.includes('polní') || lower.includes('nezpevněná'))
        return 'dirt';
    return undefined;
}
function transformLand(jsonLd, sourceUrl, htmlData) {
    const offers = jsonLd.offers || {};
    const address = offers.areaServed?.address || {};
    // Extract plot area from name or description
    let areaPlotSqm;
    // Try name first (handle space-separated numbers like "2 510 m²")
    const nameMatch = jsonLd.name?.match(/([\d\s]+)\s*m[²2]/i);
    if (nameMatch) {
        areaPlotSqm = parseInt(nameMatch[1].replace(/\s/g, ''));
    }
    // If not in name, try description
    if (!areaPlotSqm) {
        const description = jsonLd.description || '';
        const descMatch = description.match(/([\d\s]+)\s*m[²2]/i);
        if (descMatch) {
            areaPlotSqm = parseInt(descMatch[1].replace(/\s/g, ''));
        }
    }
    // Map property details from HTML
    const mappedDetails = htmlData?.propertyDetails
        ? (0, propertyDetailsMapper_1.mapPropertyDetails)(htmlData.propertyDetails)
        : {};
    const roadAccessRaw = htmlData?.propertyDetails?.['Příjezdy'] || htmlData?.propertyDetails?.['Prijezdy'];
    const property = {
        property_category: 'land',
        property_type: classifyLandPropertyType(jsonLd.name || ''),
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
        // Land subtype
        property_subtype: detectLandSubtype(jsonLd.name, jsonLd.description),
        // Required land field
        area_plot_sqm: mappedDetails.sqmPlot ?? areaPlotSqm ?? null,
        // Utilities (mapped from propertyDetails)
        water_supply: mapWaterSupply(mappedDetails.water),
        sewage: mapSewage(mappedDetails.sewage),
        electricity: mapElectricity(mappedDetails.electricity),
        gas: mapGas(mappedDetails.gas),
        road_access: mapRoadAccess(roadAccessRaw),
        // Commission
        is_commission: mappedDetails.priceExcludes?.toLowerCase().includes('provize') ? true : undefined,
        commission_note: mappedDetails.priceExcludes || undefined,
        // Optional fields from mapped details
        published_date: mappedDetails.publishedDate,
        available_from: mappedDetails.availableFrom,
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
/**
 * Map Czech water supply string to LandPropertyTierI water_supply enum
 */
function mapWaterSupply(value) {
    if (!value)
        return undefined;
    const lower = value.toLowerCase();
    if (lower.includes('vodovod') || lower.includes('veřejný') || lower.includes('obecní'))
        return 'mains';
    if (lower.includes('studna') || lower.includes('studně') || lower.includes('vrt'))
        return 'well';
    if (lower.includes('možnost') || lower.includes('přípojka'))
        return 'connection_available';
    if (lower.includes('bez') || lower.includes('není') || lower.includes('ne'))
        return 'none';
    return undefined;
}
/**
 * Map Czech sewage string to LandPropertyTierI sewage enum
 */
function mapSewage(value) {
    if (!value)
        return undefined;
    const lower = value.toLowerCase();
    if (lower.includes('kanalizace') || lower.includes('veřejná') || lower.includes('obecní'))
        return 'mains';
    if (lower.includes('septik') || lower.includes('jímka') || lower.includes('žumpa'))
        return 'septic';
    if (lower.includes('možnost') || lower.includes('přípojka'))
        return 'connection_available';
    if (lower.includes('bez') || lower.includes('není') || lower.includes('ne'))
        return 'none';
    return undefined;
}
/**
 * Map Czech electricity string to LandPropertyTierI electricity enum
 */
function mapElectricity(value) {
    if (!value)
        return undefined;
    const lower = value.toLowerCase();
    if (lower.includes('ano') || lower.includes('230') || lower.includes('400') || lower.includes('připojen'))
        return 'connected';
    if (lower.includes('možnost') || lower.includes('přípojka'))
        return 'connection_available';
    if (lower.includes('bez') || lower.includes('není') || lower.includes('ne'))
        return 'none';
    return undefined;
}
/**
 * Map Czech gas string to LandPropertyTierI gas enum
 */
function mapGas(value) {
    if (!value)
        return undefined;
    const lower = value.toLowerCase();
    if (lower.includes('ano') || lower.includes('připojen') || lower.includes('plynovod'))
        return 'connected';
    if (lower.includes('možnost') || lower.includes('přípojka'))
        return 'connection_available';
    if (lower.includes('bez') || lower.includes('není') || lower.includes('ne'))
        return 'none';
    return undefined;
}
