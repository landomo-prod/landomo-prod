"use strict";
/**
 * Reality.cz API types
 * Based on actual API responses (APK v3.1.4)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiDetailToListing = apiDetailToListing;
// ============ Helper to convert API detail to RealityListing ============
/**
 * Convert API detail response to internal RealityListing format
 */
function apiDetailToListing(detail, transactionType) {
    // Extract price from structured price object
    const priceObj = transactionType === 'sale' ? detail.price?.sale : detail.price?.rent;
    // Build image URLs from photo paths
    const images = (detail.photos || [])
        .map(p => `https://api.reality.cz${p.name}`);
    // Use type as title fallback since title is often empty
    const title = detail.title || detail.type || detail.place || 'Unknown';
    return {
        id: detail.id,
        title,
        api_type: detail.type,
        transaction_type: transactionType,
        place: detail.place,
        description: detail.description,
        url: detail.id ? `https://reality.cz/${detail.id}/` : '',
        price: priceObj?.price,
        currency: priceObj?.unit === 'Kc' || priceObj?.unit === 'Kč' ? 'CZK' : (priceObj?.unit || 'CZK'),
        price_note: detail.price?.note || undefined,
        previous_price: detail.price?.previous_price,
        has_commission: detail.price?.commission ?? false,
        gps: detail.location?.gps,
        information: detail.information || [],
        images,
        contact: detail.contact,
        created_at: detail.created_at,
        modified_at: detail.modified_at,
        outdated: false,
        scraped_at: new Date().toISOString(),
        custom_id: detail.custom_id,
    };
}
