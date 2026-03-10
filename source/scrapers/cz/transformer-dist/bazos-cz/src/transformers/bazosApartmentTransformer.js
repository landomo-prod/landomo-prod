"use strict";
/**
 * Bazos Apartment Transformer
 *
 * Category-specific transformer for apartment properties.
 * Uses focused LLM extraction for 80%+ field population (vs 40% generic).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformBazosApartment = transformBazosApartment;
const apartmentExtractionPrompt_1 = require("../prompts/apartmentExtractionPrompt");
const azureClient_1 = require("../services/azureClient");
const czech_value_mappings_1 = require("../../../shared/czech-value-mappings");
/**
 * Extract apartment data using focused LLM prompt
 */
async function extractApartmentData(listingText) {
    try {
        const azureClient = (0, azureClient_1.getAzureOpenAIClient)();
        const messages = [
            {
                role: 'system',
                content: apartmentExtractionPrompt_1.APARTMENT_EXTRACTION_PROMPT,
            },
            {
                role: 'user',
                content: `Extract apartment data from this Czech listing:\n\n${listingText}`,
            },
        ];
        const result = await azureClient.executeWithRetry(async () => {
            return await azureClient.createChatCompletion({
                messages,
                temperature: 0.1, // Low temperature for factual extraction
                max_tokens: 1500,
                response_format: { type: 'json_object' },
            });
        }, 'Apartment LLM extraction');
        const content = result.choices[0]?.message?.content;
        if (!content)
            return null;
        return JSON.parse(content);
    }
    catch (error) {
        console.error('[ApartmentTransformer] LLM extraction failed:', error.message);
        return null;
    }
}
/**
 * Calculate bedrooms from Czech disposition
 * Formula: "1+kk" = 0 bedrooms, "2+kk" = 1 bedroom, "3+1" = 2 bedrooms
 */
function calculateBedroomsFromDisposition(disposition) {
    const match = disposition.match(/^(\d+)\+/);
    if (!match)
        return undefined;
    const rooms = parseInt(match[1], 10);
    if (rooms === 1)
        return 0; // Studio
    return rooms - 1; // Bedrooms = rooms - 1 (living room)
}
/**
 * Extract disposition from title (fallback)
 */
function extractDisposition(title) {
    const dispositionRegex = /(\d+)\s*\+\s*(kk|1)/i;
    const match = title.match(dispositionRegex);
    if (match) {
        const rooms = match[1];
        const kitchen = match[2].toLowerCase();
        return `${rooms}+${kitchen}`;
    }
    return undefined;
}
/**
 * Parse price from formatted string
 */
function parsePrice(priceFormatted) {
    if (!priceFormatted)
        return undefined;
    const cleaned = priceFormatted
        .replace(/[Kč€zł]/g, '')
        .replace(/\s+/g, '')
        .replace(/,/g, '');
    const parsed = parseInt(cleaned, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}
/**
 * Extract sqm from title/description using regex (fallback when LLM unavailable)
 * Handles: "54 m²", "54 m2", "54m²", "plocha 54", "výměra 54 m2"
 */
function extractSqmFromText(title, description = '') {
    const text = `${title}\n${description}`;
    // Pattern 1: "XX m²" or "XX m2" (most common in titles)
    const sqmPattern = /(\d[\d\s.,]*)\s*m[²2]/gi;
    const matches = [...text.matchAll(sqmPattern)];
    if (matches.length > 0) {
        // For apartments, take the first (smallest) area mentioned in title, or first in description
        // Title pattern is most reliable
        const titleMatch = title.match(/(\d[\d\s.,]*)\s*m[²2]/i);
        if (titleMatch) {
            const val = parseFloat(titleMatch[1].replace(/\s/g, '').replace(',', '.'));
            // Apartment sqm is typically 15-300
            if (val >= 15 && val <= 300)
                return val;
        }
        // Fallback: use first reasonable match from full text
        for (const m of matches) {
            const val = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
            if (val >= 15 && val <= 300)
                return val;
        }
    }
    return undefined;
}
/**
 * Transform Bazos apartment listing to ApartmentPropertyTierI
 *
 * @param listing - Bazos ad data
 * @param country - Country code (default: 'cz')
 * @returns ApartmentPropertyTierI with focused extraction
 */
async function transformBazosApartment(listing, country = 'cz') {
    console.log(`[ApartmentTransformer] Processing ${listing.id}`);
    // Build listing text for LLM
    const listingText = `${listing.title}\n${listing.description || ''}`;
    // Extract using focused LLM prompt
    const extracted = await extractApartmentData(listingText);
    // Fallback values from listing
    const fallbackPrice = parsePrice(listing.price_formatted);
    const fallbackDisposition = extractDisposition(listing.title);
    // Regex-based sqm fallback when LLM fails
    const fallbackSqm = extractSqmFromText(listing.title, listing.description || '');
    // Smart price selection: Use fallback if LLM returned 0 or nothing
    const finalPrice = (extracted?.price && extracted.price > 0)
        ? extracted.price
        : (fallbackPrice ?? 0);
    // Calculate bedrooms from disposition (most reliable)
    const finalDisposition = extracted?.czech_disposition || fallbackDisposition;
    const calculatedBedrooms = finalDisposition
        ? calculateBedroomsFromDisposition(finalDisposition)
        : extracted?.bedrooms;
    // Smart city extraction from locality
    const extractCityFromLocality = (locality) => {
        if (!locality)
            return undefined;
        // Handle formats: "Praha 2 - Vinohrady" → "Praha"
        const parts = locality.split(/[-,]/)[0]?.trim();
        // Remove number suffixes: "Praha 2" → "Praha", "Brno 4" → "Brno"
        return parts?.replace(/\s+\d+$/, '').trim();
    };
    // Build location with better fallbacks
    const lat = listing.detail_latitude ? parseFloat(listing.detail_latitude) : undefined;
    const lon = listing.detail_longitude ? parseFloat(listing.detail_longitude) : undefined;
    const location = {
        address: extracted?.location?.street || listing.locality,
        city: extracted?.location?.city || extractCityFromLocality(listing.locality) || listing.locality?.split(/[-,]/)[0]?.trim(),
        region: listing.locality,
        postal_code: extracted?.location?.postal_code || listing.detail_zip_code,
        district: extracted?.location?.district,
        street: extracted?.location?.street,
        country: mapCountryName(country),
        coordinates: lat && lon ? { lat, lon } : undefined,
    };
    // Map to ApartmentPropertyTierI
    return {
        // Category
        property_category: 'apartment',
        // Core identification
        title: listing.title,
        price: finalPrice,
        currency: extracted?.currency || 'CZK',
        transaction_type: extracted?.transaction_type || 'sale',
        // Location
        location,
        // Classification
        property_subtype: mapPropertySubtype(extracted?.property_subtype),
        // Apartment-specific details
        bedrooms: calculatedBedrooms ?? 0,
        bathrooms: extracted?.bathrooms ?? 1,
        sqm: extracted?.sqm || fallbackSqm || 0,
        floor: extracted?.floor,
        total_floors: extracted?.total_floors,
        floor_location: calculateFloorLocation(extracted?.floor, extracted?.total_floors),
        rooms: extracted?.rooms,
        // Apartment amenities (boolean, not nullable)
        has_elevator: extracted?.has_elevator ?? false,
        has_balcony: extracted?.has_balcony ?? false,
        has_parking: extracted?.has_parking ?? false,
        has_basement: extracted?.has_basement ?? false,
        has_garage: extracted?.has_garage,
        has_loggia: extracted?.has_loggia,
        has_terrace: extracted?.has_terrace,
        // Optional areas
        balcony_area: extracted?.balcony_area,
        cellar_area: extracted?.cellar_area,
        terrace_area: extracted?.terrace_area,
        loggia_area: extracted?.loggia_area,
        // Building context
        year_built: extracted?.year_built,
        construction_type: mapConstructionType(extracted?.construction_type),
        condition: mapCondition(extracted?.condition),
        heating_type: extracted?.heating_type ? (0, czech_value_mappings_1.normalizeHeatingType)(extracted.heating_type) : undefined,
        energy_class: extracted?.energy_class ? (0, czech_value_mappings_1.normalizeEnergyRating)(extracted.energy_class) : undefined,
        // Tier 1 universal fields
        furnished: normalizeFurnished(extracted?.furnished),
        renovation_year: extracted?.renovation_year,
        published_date: listing.from ? new Date(listing.from).toISOString() : undefined,
        // Financials
        hoa_fees: extracted?.hoa_fees,
        deposit: extracted?.deposit,
        utility_charges: extracted?.utility_charges,
        // Images - use detail API images if available, fallback to thumbnail
        images: listing.detail_images?.length > 0
            ? listing.detail_images
            : (listing.image_thumbnail ? [listing.image_thumbnail] : []),
        // Media - use detail API images if available, fallback to thumbnail
        media: {
            images: listing.detail_images?.length > 0
                ? listing.detail_images
                : (listing.image_thumbnail ? [listing.image_thumbnail] : []),
            total_images: listing.detail_images?.length > 0
                ? listing.detail_images.length
                : (listing.image_thumbnail ? 1 : 0),
        },
        // Portal & lifecycle
        source_url: listing.url || '',
        source_platform: 'bazos',
        portal_id: listing.id,
        status: 'active',
        // Description
        description: listing.description || '',
        // Features (from amenities)
        features: buildFeatures(extracted),
        // Tier II: Country-specific (Czech Republic)
        country_specific: {
            czech: {
                disposition: finalDisposition,
                ownership: extracted?.czech_ownership,
            }
        },
        // Tier III: Portal metadata
        portal_metadata: {
            bazos: {
                ad_id: listing.id,
                country,
                views: listing.views,
                posted_date: listing.from,
                topped: listing.topped,
                favourite: listing.favourite,
                image_width: listing.image_thumbnail_width,
                image_height: listing.image_thumbnail_height,
                thumbnail_url: listing.image_thumbnail,
            }
        },
    };
}
/**
 * Calculate floor_location from floor and total_floors
 */
function calculateFloorLocation(floor, totalFloors) {
    if (floor === undefined || floor === null)
        return undefined;
    if (floor === 0 || floor === 1)
        return 'ground_floor';
    if (totalFloors !== undefined && totalFloors !== null && floor >= totalFloors)
        return 'top_floor';
    if (floor > 1)
        return 'middle_floor';
    return undefined;
}
/**
 * Map property subtype to standard values
 */
function mapPropertySubtype(subtype) {
    if (!subtype)
        return undefined;
    const normalized = subtype.toLowerCase();
    if (normalized === 'standard')
        return 'standard';
    if (normalized === 'penthouse')
        return 'penthouse';
    if (normalized === 'loft')
        return 'loft';
    if (normalized === 'atelier')
        return 'atelier';
    if (normalized === 'maisonette' || normalized === 'mezonet')
        return 'maisonette';
    if (normalized === 'studio' || normalized === 'garsoniera')
        return 'studio';
    return undefined;
}
/**
 * Map construction type to standard values
 */
function mapConstructionType(type) {
    if (!type)
        return undefined;
    const normalized = type.toLowerCase();
    if (normalized.includes('panel'))
        return 'panel';
    if (normalized.includes('brick') || normalized.includes('cihl'))
        return 'brick';
    if (normalized.includes('concrete') || normalized.includes('beton'))
        return 'concrete';
    if (normalized.includes('mixed') || normalized.includes('smíšen'))
        return 'mixed';
    return undefined;
}
/**
 * Map condition to standard values
 */
function mapCondition(condition) {
    if (!condition)
        return undefined;
    const normalized = condition.toLowerCase();
    if (normalized.includes('new') || normalized.includes('nový'))
        return 'new';
    if (normalized.includes('excellent') || normalized.includes('výborný'))
        return 'excellent';
    if (normalized.includes('good') || normalized.includes('dobrý'))
        return 'good';
    if (normalized.includes('after_renovation') || normalized.includes('po rekonstrukci'))
        return 'after_renovation';
    if (normalized.includes('requires_renovation') || normalized.includes('k rekonstrukci'))
        return 'requires_renovation';
    return undefined;
}
/**
 * Build features array from amenities
 */
function buildFeatures(extracted) {
    if (!extracted)
        return [];
    const features = [];
    if (extracted.has_elevator)
        features.push('elevator');
    if (extracted.has_balcony)
        features.push('balcony');
    if (extracted.has_parking)
        features.push('parking');
    if (extracted.has_basement)
        features.push('basement');
    if (extracted.has_garage)
        features.push('garage');
    if (extracted.has_loggia)
        features.push('loggia');
    if (extracted.has_terrace)
        features.push('terrace');
    return features;
}
/**
 * Map country code to full name
 */
function normalizeFurnished(input) {
    if (!input)
        return undefined;
    const clean = input.toLowerCase().trim();
    if (['yes', 'ano', 'equipped', 'vybaveno', 'furnished'].includes(clean))
        return 'furnished';
    if (['partial', 'částečně', 'partially'].includes(clean))
        return 'partially_furnished';
    if (['no', 'ne', 'unfurnished', 'nevybaveno'].includes(clean))
        return 'not_furnished';
    return undefined;
}
function mapCountryName(country) {
    const countryMap = {
        cz: 'Czech Republic',
        sk: 'Slovakia',
        pl: 'Poland',
        at: 'Austria',
    };
    return countryMap[country] || 'Unknown';
}
