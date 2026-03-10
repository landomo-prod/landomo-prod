"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRealingoCommercial = transformRealingoCommercial;
const fieldMappers_1 = require("../shared/fieldMappers");
function mapCommercialSubtype(category) {
    switch (category) {
        case 'COMMERCIAL_OFFICE': return 'office';
        case 'COMMERCIAL_STORAGE': return 'warehouse';
        case 'COMMERCIAL_BUSINESS': return 'retail';
        case 'COMMERCIAL_RESTAURANT': return 'restaurant';
        case 'COMMERCIAL_ACCOMMODATION': return 'hotel';
        case 'COMMERCIAL_MANUFACTURING': return 'industrial';
        case 'COMMERCIAL_AGRICULTURAL': return 'industrial';
        default: return undefined;
    }
}
function buildCommercialFeatures(detail) {
    const features = [];
    if (detail?.isBarrierFree)
        features.push('barrier_free');
    if (detail?.parking) {
        const p = String(detail.parking).toUpperCase();
        if (p === 'GARAGE' || p === 'GARAGE_PLACE')
            features.push('parking_garage');
        else if (p === 'OUTDOOR')
            features.push('parking_outdoor');
        else if (p === 'UNDERGROUND')
            features.push('parking_underground');
        else
            features.push('parking');
    }
    return features;
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
function transformRealingoCommercial(offer) {
    const detail = offer.detail;
    const title = offer.category || 'Commercial';
    const price = (offer.price?.total ?? null);
    const currency = offer.price?.currency || 'CZK';
    const transaction_type = offer.purpose === 'RENT' ? 'rent' : 'sale';
    const addressParts = (offer.location?.address || '').split(',').map(s => s.trim());
    const location = {
        address: offer.location?.address || undefined,
        city: addressParts[addressParts.length - 1] || undefined,
        region: addressParts.length > 1 ? addressParts[0] : undefined,
        country: 'Czech Republic',
        coordinates: offer.location?.latitude && offer.location?.longitude
            ? { lat: offer.location.latitude, lon: offer.location.longitude }
            : undefined,
    };
    const imageUrl = offer.photos?.main ? `https://www.realingo.cz/static/images/${offer.photos.main}.jpg` : undefined;
    const galleryUrls = (offer.photos?.list || []).map(img => `https://www.realingo.cz/static/images/${img}.jpg`);
    const allImages = imageUrl ? [imageUrl, ...galleryUrls] : galleryUrls;
    const media = { images: allImages, main_image: imageUrl, virtual_tour_url: undefined };
    const realingo_url = offer.url ? `https://www.realingo.cz${offer.url}` : `https://www.realingo.cz/nemovitost/${offer.id}`;
    const source_url = detail?.externalUrl || realingo_url;
    return {
        property_category: 'commercial',
        property_subtype: classifyCommercialPropertyType(title),
        title,
        price,
        currency,
        transaction_type,
        location,
        sqm_total: (offer.area?.main ?? offer.area?.floor ?? offer.area?.built ?? null),
        sqm_plot: offer.area?.plot ?? undefined,
        floor: detail?.floor ?? undefined,
        total_floors: detail?.floorTotal ?? undefined,
        floor_location: classifyFloorLocation(detail?.floor, detail?.floorTotal),
        ceiling_height: detail?.ceilingHeight ?? undefined,
        has_elevator: detail?.lift ?? false,
        has_bathrooms: detail != null ? true : false,
        has_parking: detail?.parking != null,
        parking_spaces: detail?.parkingPlaces ?? undefined,
        has_disabled_access: detail?.isBarrierFree ?? undefined,
        condition: (0, fieldMappers_1.mapCondition)(detail?.buildingStatus),
        heating_type: (0, fieldMappers_1.mapHeating)(detail?.heating),
        construction_type: (0, fieldMappers_1.mapBuildingType)(detail?.buildingType),
        energy_class: (0, fieldMappers_1.mapEnergyClass)(detail?.energyPerformance),
        year_built: detail?.yearBuild ?? undefined,
        furnished: (0, fieldMappers_1.mapFurnished)(detail?.furniture),
        renovation_year: detail?.yearReconstructed ?? undefined,
        published_date: offer.createdAt ? offer.createdAt.split('T')[0] : undefined,
        price_per_sqm: (price != null && price > 0 && (offer.area?.main || offer.area?.floor || offer.area?.built))
            ? Math.round(price / (offer.area?.main || offer.area?.floor || offer.area?.built || 1))
            : undefined,
        monthly_rent: undefined,
        deposit: undefined,
        service_charges: undefined,
        available_from: detail?.availableFromDate ?? undefined,
        media,
        source_url,
        source_platform: 'realingo',
        portal_id: `realingo-${offer.id}`,
        status: 'active',
        description: detail?.description ?? undefined,
        features: buildCommercialFeatures(detail),
        images: allImages,
        videos: undefined,
        agent: (0, fieldMappers_1.extractAgent)(detail),
        portal_metadata: {
            realingo: {
                id: offer.id,
                category: offer.category,
                property_type: offer.property,
                purpose: offer.purpose,
                url: offer.url,
                vat: offer.price?.vat,
                floor_area_sqm: offer.area?.floor,
                photo_main: offer.photos?.main,
                raw_address: offer.location?.address,
                external_url: detail?.externalUrl,
                parking_type: detail?.parking,
                parking_places: detail?.parkingPlaces,
                energy_performance_value: detail?.energyPerformanceValue,
                building_type: detail?.buildingType,
                is_auction: detail?.isAuction,
                flat_count: detail?.flatCount,
                flood_risk: detail?.floodRisk ?? undefined,
                flood_active_zone: detail?.floodActiveZone ?? undefined,
                floor_underground: detail?.floorUnderground ?? undefined,
                garret: detail?.garret ?? undefined,
            },
        },
        country_specific: {
            czech_ownership: (0, fieldMappers_1.mapOwnership)(detail?.ownership),
            czech: {
                ownership: detail?.ownership ?? undefined,
                condition: detail?.buildingStatus ?? undefined,
                heating_type: detail?.heating ?? undefined,
                energy_rating: detail?.energyPerformance ?? undefined,
                furnished: detail?.furniture ?? undefined,
                flood_risk: detail?.floodRisk ?? undefined,
                flood_active_zone: detail?.floodActiveZone ?? undefined,
                telecommunication: detail?.telecommunication ?? undefined,
            },
        },
    };
}
function classifyFloorLocation(floor, totalFloors) {
    if (floor == null)
        return undefined;
    if (floor < 0)
        return 'basement';
    if (floor === 0)
        return 'ground_floor';
    if (totalFloors != null) {
        if (floor === totalFloors || floor === totalFloors - 1)
            return 'top_floor';
        return 'middle_floor';
    }
    return 'middle_floor';
}
