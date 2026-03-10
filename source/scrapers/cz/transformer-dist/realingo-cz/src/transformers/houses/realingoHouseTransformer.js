"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRealingoHouse = transformRealingoHouse;
const categoryParser_1 = require("../../utils/categoryParser");
const fieldMappers_1 = require("../shared/fieldMappers");
function buildHouseFeatures(detail) {
    const features = [];
    if (detail?.isBarrierFree)
        features.push('barrier_free');
    if (detail?.garret)
        features.push('garret');
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
function transformRealingoHouse(offer) {
    const categoryInfo = (0, categoryParser_1.parseDisposition)(offer.category);
    const detail = offer.detail;
    const title = categoryInfo.subtype || offer.category || 'House';
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
    const sqm_living = (offer.area?.main ?? offer.area?.floor ?? offer.area?.built ?? null);
    const sqm_plot = (offer.area?.plot ?? null);
    const bedrooms = (detail?.roomCount ? Math.max(detail.roomCount - 1, 1) : null);
    const imageUrl = offer.photos?.main ? `https://www.realingo.cz/static/images/${offer.photos.main}.jpg` : undefined;
    const galleryUrls = (offer.photos?.list || []).map(img => `https://www.realingo.cz/static/images/${img}.jpg`);
    const allImages = imageUrl ? [imageUrl, ...galleryUrls] : galleryUrls;
    const media = { images: allImages, main_image: imageUrl, virtual_tour_url: undefined };
    const realingo_url = offer.url ? `https://www.realingo.cz${offer.url}` : `https://www.realingo.cz/nemovitost/${offer.id}`;
    const source_url = detail?.externalUrl || realingo_url;
    return {
        property_category: 'house',
        title,
        price,
        currency,
        transaction_type,
        location,
        property_subtype: (detail?.houseType?.toLowerCase() ?? undefined),
        bedrooms,
        bathrooms: 1,
        sqm_living,
        sqm_total: offer.area?.built ?? undefined,
        sqm_plot,
        rooms: detail?.roomCount ?? undefined,
        stories: detail?.floorTotal ?? undefined,
        has_basement: detail?.cellar ?? (offer.area?.cellar ? offer.area.cellar > 0 : false),
        cellar_area: offer.area?.cellar ?? undefined,
        has_parking: detail?.parking != null,
        has_garage: detail?.garages ? detail.garages > 0 : false,
        terrace_area: offer.area?.terrace ?? undefined,
        balcony_area: offer.area?.balcony ?? undefined,
        garage_count: detail?.garages ?? undefined,
        has_garden: offer.area?.garden ? offer.area.garden > 0 : false,
        garden_area: offer.area?.garden ?? undefined,
        has_terrace: detail?.terrace ?? (offer.area?.terrace ? offer.area.terrace > 0 : false),
        has_balcony: detail?.balcony ?? (offer.area?.balcony ? offer.area.balcony > 0 : false),
        parking_spaces: detail?.parkingPlaces ?? undefined,
        condition: (0, fieldMappers_1.mapCondition)(detail?.buildingStatus),
        heating_type: (0, fieldMappers_1.mapHeating)(detail?.heating),
        construction_type: (0, fieldMappers_1.mapBuildingType)(detail?.buildingType),
        energy_class: (0, fieldMappers_1.mapEnergyClass)(detail?.energyPerformance),
        year_built: detail?.yearBuild ?? undefined,
        roof_type: undefined,
        furnished: (0, fieldMappers_1.mapFurnished)(detail?.furniture),
        renovation_year: detail?.yearReconstructed ?? undefined,
        published_date: offer.createdAt ? offer.createdAt.split('T')[0] : undefined,
        hoa_fees: undefined,
        deposit: undefined,
        utility_charges: undefined,
        service_charges: undefined,
        available_from: detail?.availableFromDate ?? undefined,
        min_rent_days: undefined,
        max_rent_days: undefined,
        media,
        source_url,
        source_platform: 'realingo',
        portal_id: `realingo-${offer.id}`,
        status: 'active',
        description: detail?.description ?? undefined,
        features: buildHouseFeatures(detail),
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
                is_barrier_free: detail?.isBarrierFree,
                is_auction: detail?.isAuction,
                building_position: detail?.buildingPosition,
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
                construction_type: detail?.buildingType ?? undefined,
                energy_rating: detail?.energyPerformance ?? undefined,
                furnished: detail?.furniture ?? undefined,
                flood_risk: detail?.floodRisk ?? undefined,
                flood_active_zone: detail?.floodActiveZone ?? undefined,
                sewage: detail?.gully ?? undefined,
                telecommunication: detail?.telecommunication ?? undefined,
            },
        },
    };
}
