"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRealingoOthers = transformRealingoOthers;
const fieldMappers_1 = require("../shared/fieldMappers");
function transformRealingoOthers(offer) {
    const detail = offer.detail;
    const title = offer.category || 'Other';
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
        property_category: 'other',
        title,
        price,
        currency,
        transaction_type,
        location,
        property_subtype: 'other',
        sqm_total: (offer.area?.main ?? offer.area?.floor ?? offer.area?.built ?? null),
        has_parking: detail?.parking != null,
        has_electricity: detail?.electricity != null,
        media,
        source_url,
        source_platform: 'realingo',
        portal_id: `realingo-${offer.id}`,
        status: 'active',
        description: detail?.description ?? undefined,
        features: [],
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
                is_auction: detail?.isAuction,
            },
        },
        country_specific: {
            czech: {},
        },
    };
}
