/**
 * Bazos House Transformer
 *
 * Category-specific transformer for house properties.
 * Uses focused LLM extraction for house-specific fields.
 */

import { HousePropertyTierI } from '@landomo/core';
import { BazosAd } from '../types/bazosTypes';
import { getAzureOpenAIClient } from '../services/azureClient';
import { HOUSE_EXTRACTION_PROMPT } from '../prompts/houseExtractionPrompt';
import { normalizeHeatingType, normalizeEnergyRating } from '../../../shared/czech-value-mappings';
/**
 * House-specific LLM extraction result
 */
interface HouseLLMExtraction {
  // Core
  title?: string;
  price?: number;
  currency?: string;
  transaction_type?: 'sale' | 'rent';

  // Location
  location?: {
    street?: string;
    postal_code?: string;
    city?: string;
    district?: string;
    region?: string;
  };

  // House dimensions
  sqm_living?: number;
  sqm_plot?: number;
  bedrooms?: number;
  bathrooms?: number;
  rooms?: number;
  stories?: number;

  // House amenities
  has_garden?: boolean;
  has_garage?: boolean;
  has_parking?: boolean;
  has_basement?: boolean;
  has_pool?: boolean;
  has_fireplace?: boolean;
  has_terrace?: boolean;
  has_balcony?: boolean;

  // Optional areas
  garden_area?: number;
  garage_count?: number;
  terrace_area?: number;
  cellar_area?: number;
  balcony_area?: number;

  // Building details
  year_built?: number;
  renovation_year?: number;
  condition?: string;
  construction_type?: string;
  roof_type?: string;

  // Furnishing
  furnished?: string;

  // Czech-specific
  property_subtype?: string;
  czech_disposition?: string;

  // Financials
  deposit?: number;
  utility_charges?: number;
  property_tax?: number;

  // Energy & heating
  heating_type?: string;
  energy_class?: string;

  // Commission
  price_note?: string; // e.g. "provize", "bez provize", "dohodou"
}

/**
 * Extract house data using focused LLM prompt
 */
async function extractHouseData(listingText: string): Promise<HouseLLMExtraction | null> {
  try {
    const azureClient = getAzureOpenAIClient();

    const messages = [
      {
        role: 'system' as const,
        content: HOUSE_EXTRACTION_PROMPT,
      },
      {
        role: 'user' as const,
        content: `Extract house data from this Czech listing:\n\n${listingText}`,
      },
    ];

    const result = await azureClient.executeWithRetry(
      async () => {
        return await azureClient.createChatCompletion({
          messages,
          temperature: 0.1,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        });
      },
      'House LLM extraction'
    );

    const content = result.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error: any) {
    console.error('[HouseTransformer] LLM extraction failed:', error.message);
    return null;
  }
}

/**
 * Calculate bedrooms from Czech disposition
 * Formula: "5+1" = 4 bedrooms, "4+kk" = 3 bedrooms
 */
function calculateBedroomsFromDisposition(disposition: string): number | undefined {
  const match = disposition.match(/^(\d+)\+/);
  if (!match) return undefined;

  const rooms = parseInt(match[1], 10);
  return rooms - 1; // Bedrooms = rooms - 1 (living room)
}

/**
 * Parse price from formatted string
 */
function parsePrice(priceFormatted?: string): number | undefined {
  if (!priceFormatted) return undefined;

  const cleaned = priceFormatted
    .replace(/[Kč€zł]/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '');

  const parsed = parseInt(cleaned, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Extract sqm from title/description using regex (fallback when LLM unavailable)
 * For houses: extracts living area and plot area separately
 */
function extractHouseSqmFromText(title: string, description: string = ''): { sqmLiving?: number; sqmPlot?: number } {
  const text = `${title}\n${description}`;
  const result: { sqmLiving?: number; sqmPlot?: number } = {};

  // Extract all "XX m²" values
  const sqmPattern = /(\d[\d\s.,]*)\s*m[²2]/gi;
  const allMatches = [...text.matchAll(sqmPattern)].map(m =>
    parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
  ).filter(v => v > 0);

  // Check for explicit "pozemek XX m²" pattern
  const plotPattern = /pozemek[^\d]*(\d[\d\s.,]*)\s*m[²2]/i;
  const plotMatch = text.match(plotPattern);
  if (plotMatch) {
    result.sqmPlot = parseFloat(plotMatch[1].replace(/\s/g, '').replace(',', '.'));
  }

  // Title typically has: "Prodej domu, 149 m², ... pozemek 472 m²"
  const titleMatches = [...title.matchAll(sqmPattern)].map(m =>
    parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
  ).filter(v => v > 0);

  if (titleMatches.length >= 2) {
    // First is living, second is plot
    result.sqmLiving = titleMatches[0];
    if (!result.sqmPlot) result.sqmPlot = titleMatches[1];
  } else if (titleMatches.length === 1) {
    // Single value: if < 500 likely living area, if > 500 likely plot
    const val = titleMatches[0];
    if (val <= 500) result.sqmLiving = val;
    else result.sqmPlot = val;
  }

  return result;
}

/**
 * Transform Bazos house listing to HousePropertyTierI
 *
 * @param listing - Bazos ad data
 * @param country - Country code (default: 'cz')
 * @returns HousePropertyTierI with focused extraction
 */
export async function transformBazosHouse(
  listing: BazosAd,
  country: string = 'cz'
): Promise<Partial<HousePropertyTierI>> {
  console.log(`[HouseTransformer] Processing ${listing.id}`);

  // Build listing text for LLM
  const listingText = `${listing.title}\n${(listing as any).description || ''}`;

  // Extract using focused LLM prompt
  const extracted = await extractHouseData(listingText);

  // Fallback values from listing
  const fallbackPrice = parsePrice(listing.price_formatted);

  // Regex-based sqm fallback when LLM fails
  const fallbackSqm = extractHouseSqmFromText(listing.title, (listing as any).description || '');

  // Smart price selection: Use fallback if LLM returned 0 or nothing
  const finalPrice = (extracted?.price && extracted.price > 0)
    ? extracted.price
    : (fallbackPrice ?? 0);

  // Calculate bedrooms from disposition
  const finalDisposition = extracted?.czech_disposition;
  const calculatedBedrooms = finalDisposition
    ? calculateBedroomsFromDisposition(finalDisposition)
    : extracted?.bedrooms;

  // Smart city extraction from locality
  const extractCityFromLocality = (locality?: string): string | undefined => {
    if (!locality) return undefined;
    // Handle formats: "Praha 2 - Vinohrady" → "Praha"
    const parts = locality.split(/[-,]/)[0]?.trim();
    // Remove number suffixes: "Praha 2" → "Praha", "Brno 4" → "Brno"
    return parts?.replace(/\s+\d+$/, '').trim();
  };

  // Build location with better fallbacks
  const lat = (listing as any).detail_latitude ? parseFloat((listing as any).detail_latitude) : undefined;
  const lon = (listing as any).detail_longitude ? parseFloat((listing as any).detail_longitude) : undefined;

  const location = {
    address: extracted?.location?.street || listing.locality,
    city: extracted?.location?.city || extractCityFromLocality(listing.locality) || listing.locality?.split(/[-,]/)[0]?.trim(),
    region: extracted?.location?.region || listing.locality,
    postal_code: extracted?.location?.postal_code || (listing as any).detail_zip_code,
    district: extracted?.location?.district,
    street: extracted?.location?.street,
    country: mapCountryName(country),
    coordinates: lat && lon ? { lat, lon } : undefined,
  };

  // Map to HousePropertyTierI
  return {
    // Category
    property_category: 'house' as const,

    // Core identification
    title: listing.title,
    price: finalPrice,
    currency: extracted?.currency || 'CZK',
    transaction_type: extracted?.transaction_type || 'sale',

    // Location
    location,

    // Classification
    property_subtype: mapPropertySubtype(extracted?.property_subtype),

    // House-specific details
    bedrooms: calculatedBedrooms ?? 0,
    bathrooms: extracted?.bathrooms ?? 1,
    sqm_living: extracted?.sqm_living || fallbackSqm.sqmLiving || 0,
    sqm_plot: extracted?.sqm_plot || fallbackSqm.sqmPlot || 0,
    stories: extracted?.stories,
    rooms: extracted?.rooms,

    // House amenities (boolean, not nullable)
    has_garden: extracted?.has_garden ?? false,
    has_garage: extracted?.has_garage ?? false,
    has_parking: extracted?.has_parking ?? false,
    has_basement: extracted?.has_basement ?? false,
    has_pool: extracted?.has_pool,
    has_fireplace: extracted?.has_fireplace,
    has_terrace: extracted?.has_terrace,
    has_balcony: extracted?.has_balcony,

    // Optional areas
    garden_area: extracted?.garden_area,
    garage_count: extracted?.garage_count,
    terrace_area: extracted?.terrace_area,
    cellar_area: extracted?.cellar_area,
    balcony_area: extracted?.balcony_area,

    // Building context
    year_built: extracted?.year_built,
    renovation_year: extracted?.renovation_year,
    construction_type: mapConstructionType(extracted?.construction_type),
    condition: mapCondition(extracted?.condition),
    roof_type: mapRoofType(extracted?.roof_type),
    heating_type: extracted?.heating_type ? normalizeHeatingType(extracted.heating_type) : undefined,
    energy_class: extracted?.energy_class ? normalizeEnergyRating(extracted.energy_class) : undefined,

    // Tier 1 universal fields
    furnished: normalizeFurnished(extracted?.furnished),
    published_date: listing.from ? new Date(listing.from).toISOString() : undefined,

    // Financials
    property_tax: extracted?.property_tax,
    deposit: extracted?.deposit,
    utility_charges: extracted?.utility_charges,

    // Images - use detail API images if available, fallback to thumbnail
    images: (listing as any).detail_images?.length > 0
      ? (listing as any).detail_images
      : (listing.image_thumbnail ? [listing.image_thumbnail] : []),

    // Media - use detail API images if available
    media: {
      images: (listing as any).detail_images?.length > 0
        ? (listing as any).detail_images
        : (listing.image_thumbnail ? [listing.image_thumbnail] : []),
      total_images: (listing as any).detail_images?.length > 0
        ? (listing as any).detail_images.length
        : (listing.image_thumbnail ? 1 : 0),
    },

    // Portal & lifecycle
    source_url: listing.url || '',
    source_platform: 'bazos',
    portal_id: listing.id,
    status: 'active' as const,

    // Description
    description: (listing as any).description || '',

    // Features
    features: buildFeatures(extracted),

    // Tier II: Country-specific (Czech Republic)
    country_specific: {
      czech: {
        disposition: finalDisposition,
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
 * Map property subtype to standard values
 */
function mapPropertySubtype(
  subtype?: string
):
  | 'detached'
  | 'semi_detached'
  | 'terraced'
  | 'villa'
  | 'cottage'
  | 'farmhouse'
  | 'townhouse'
  | 'bungalow'
  | undefined {
  if (!subtype) return undefined;

  const normalized = subtype.toLowerCase();
  if (normalized === 'detached') return 'detached';
  if (normalized === 'semi_detached' || normalized === 'semi-detached') return 'semi_detached';
  if (normalized === 'terraced') return 'terraced';
  if (normalized === 'villa') return 'villa';
  if (normalized === 'cottage' || normalized === 'chalupa') return 'cottage';
  if (normalized === 'farmhouse') return 'farmhouse';
  if (normalized === 'townhouse') return 'townhouse';
  if (normalized === 'bungalow') return 'bungalow';

  return undefined;
}

/**
 * Map construction type to standard values
 */
function mapConstructionType(
  type?: string
): 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined {
  if (!type) return undefined;

  const normalized = type.toLowerCase();
  if (normalized.includes('brick') || normalized.includes('cihl')) return 'brick';
  if (normalized.includes('wood') || normalized.includes('dřev')) return 'wood';
  if (normalized.includes('stone') || normalized.includes('kámen')) return 'stone';
  if (normalized.includes('concrete') || normalized.includes('beton')) return 'concrete';
  if (normalized.includes('mixed') || normalized.includes('smíšen')) return 'mixed';

  return undefined;
}

/**
 * Map condition to standard values
 */
function mapCondition(
  condition?: string
): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!condition) return undefined;

  const normalized = condition.toLowerCase();
  if (normalized.includes('new') || normalized.includes('nový')) return 'new';
  if (normalized.includes('excellent') || normalized.includes('výborný')) return 'excellent';
  if (normalized.includes('good') || normalized.includes('dobrý')) return 'good';
  if (normalized.includes('after_renovation') || normalized.includes('po rekonstrukci'))
    return 'after_renovation';
  if (normalized.includes('requires_renovation') || normalized.includes('k rekonstrukci'))
    return 'requires_renovation';

  return undefined;
}

/**
 * Map roof type to standard values
 */
function mapRoofType(
  type?: string
): 'flat' | 'gable' | 'hip' | 'mansard' | 'gambrel' | undefined {
  if (!type) return undefined;

  const normalized = type.toLowerCase();
  if (normalized.includes('flat') || normalized.includes('plochá')) return 'flat';
  if (normalized.includes('gable') || normalized.includes('sedlová')) return 'gable';
  if (normalized.includes('hip') || normalized.includes('valbová')) return 'hip';
  if (normalized.includes('mansard')) return 'mansard';
  if (normalized.includes('gambrel')) return 'gambrel';

  return undefined;
}

/**
 * Build features array from amenities
 */
function buildFeatures(extracted: HouseLLMExtraction | null): string[] {
  if (!extracted) return [];

  const features: string[] = [];

  if (extracted.has_garden) features.push('garden');
  if (extracted.has_garage) features.push('garage');
  if (extracted.has_parking) features.push('parking');
  if (extracted.has_basement) features.push('basement');
  if (extracted.has_pool) features.push('pool');
  if (extracted.has_fireplace) features.push('fireplace');
  if (extracted.has_terrace) features.push('terrace');
  if (extracted.has_balcony) features.push('balcony');

  return features;
}

/**
 * Map country code to full name
 */
function normalizeFurnished(
  input?: string
): 'furnished' | 'partially_furnished' | 'not_furnished' | undefined {
  if (!input) return undefined;
  const clean = input.toLowerCase().trim();
  if (['yes', 'ano', 'equipped', 'vybaveno', 'furnished'].includes(clean)) return 'furnished';
  if (['partial', 'částečně', 'partially'].includes(clean)) return 'partially_furnished';
  if (['no', 'ne', 'unfurnished', 'nevybaveno'].includes(clean)) return 'not_furnished';
  return undefined;
}

function mapCountryName(country: string): string {
  const countryMap: Record<string, string> = {
    cz: 'Czech Republic',
    sk: 'Slovakia',
    pl: 'Poland',
    at: 'Austria',
  };
  return countryMap[country] || 'Unknown';
}
