/**
 * Bazos Land Transformer
 *
 * Category-specific transformer for land/plot properties.
 * Uses focused LLM extraction for land-specific fields.
 */

import { LandPropertyTierI } from '@landomo/core';
import { BazosAd } from '../types/bazosTypes';
import { getAzureOpenAIClient } from '../services/azureClient';
import { LAND_EXTRACTION_PROMPT } from '../prompts/landExtractionPrompt';

/**
 * Land-specific LLM extraction result
 */
interface LandLLMExtraction {
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

  // Land dimensions
  area_plot_sqm?: number;

  // Land classification
  zoning?: string;
  land_type?: string;
  property_subtype?: string;

  // Utilities (CRITICAL)
  water_supply?: string;
  sewage?: string;
  electricity?: string;
  gas?: string;
  road_access?: string;

  // Development potential
  building_permit?: boolean;
  max_building_coverage?: number;
  terrain?: string;

  // Legal & administrative
  cadastral_number?: string;
  ownership_type?: string;

  // Energy & heating (rare for land but can appear on plots with existing structures)
  heating_type?: string;
  energy_class?: string;

  // Commission
  price_note?: string; // e.g. "provize", "bez provize", "dohodou"
}

/**
 * Extract land data using focused LLM prompt
 */
async function extractLandData(listingText: string): Promise<LandLLMExtraction | null> {
  try {
    const azureClient = getAzureOpenAIClient();

    const messages = [
      {
        role: 'system' as const,
        content: LAND_EXTRACTION_PROMPT,
      },
      {
        role: 'user' as const,
        content: `Extract land data from this Czech listing:\n\n${listingText}`,
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
      'Land LLM extraction'
    );

    const content = result.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (error: any) {
    console.error('[LandTransformer] LLM extraction failed:', error.message);
    return null;
  }
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
 * Extract land area from title/description using regex (fallback when LLM unavailable)
 */
function extractLandAreaFromText(title: string, description: string = ''): number | undefined {
  const text = `${title}\n${description}`;

  // Pattern: "XX m²" or "XX m2"
  const sqmPattern = /(\d[\d\s.,]*)\s*m[²2]/gi;
  const matches = [...text.matchAll(sqmPattern)];

  if (matches.length > 0) {
    // For land, take the largest area mentioned (land plots are usually the biggest number)
    const titleMatch = title.match(/(\d[\d\s.,]*)\s*m[²2]/i);
    if (titleMatch) {
      const val = parseFloat(titleMatch[1].replace(/\s/g, '').replace(',', '.'));
      if (val > 0) return val;
    }

    // Fallback: largest value
    const values = matches.map(m => parseFloat(m[1].replace(/\s/g, '').replace(',', '.')))
      .filter(v => v > 0);
    if (values.length > 0) return Math.max(...values);
  }

  return undefined;
}

/**
 * Transform Bazos land listing to LandPropertyTierI
 *
 * @param listing - Bazos ad data
 * @param country - Country code (default: 'cz')
 * @returns LandPropertyTierI with focused extraction
 */
export async function transformBazosLand(
  listing: BazosAd,
  country: string = 'cz'
): Promise<Partial<LandPropertyTierI>> {
  console.log(`[LandTransformer] Processing ${listing.id}`);

  // Build listing text for LLM
  const listingText = `${listing.title}\n${(listing as any).description || ''}`;

  // Extract using focused LLM prompt
  const extracted = await extractLandData(listingText);

  // Fallback values from listing
  const fallbackPrice = parsePrice(listing.price_formatted);

  // Regex-based area fallback when LLM fails
  const fallbackArea = extractLandAreaFromText(listing.title, (listing as any).description || '');

  // Smart price selection: Use fallback if LLM returned 0 or nothing
  const finalPrice = (extracted?.price && extracted.price > 0)
    ? extracted.price
    : (fallbackPrice ?? 0);

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

  // Map to LandPropertyTierI
  return {
    // Category
    property_category: 'land' as const,
    property_type: classifyLandPropertyType(listing.title),

    // Core identification
    title: listing.title,
    price: finalPrice,
    currency: extracted?.currency || 'CZK',
    transaction_type: extracted?.transaction_type || 'sale',

    // Location
    location,

    // Classification
    property_subtype: mapPropertySubtype(extracted?.property_subtype),

    // Land-specific details
    area_plot_sqm: extracted?.area_plot_sqm || fallbackArea || 0,
    zoning: mapZoning(extracted?.zoning),
    land_type: mapLandType(extracted?.land_type),

    // Utilities (CRITICAL for land)
    water_supply: mapWaterSupply(extracted?.water_supply),
    sewage: mapSewage(extracted?.sewage),
    electricity: mapElectricity(extracted?.electricity),
    gas: mapGas(extracted?.gas),
    road_access: mapRoadAccess(extracted?.road_access),

    // Development potential
    building_permit: extracted?.building_permit,
    max_building_coverage: extracted?.max_building_coverage,
    terrain: mapTerrain(extracted?.terrain),

    // Legal & administrative
    cadastral_number: extracted?.cadastral_number,
    ownership_type: mapOwnershipType(extracted?.ownership_type),

    // Tier 1 universal fields
    published_date: listing.from ? new Date(listing.from).toISOString() : undefined,

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
        cadastral_number: extracted?.cadastral_number,
        ownership_type: extracted?.ownership_type,
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
 * Classify land property_type from Czech title
 */
function classifyLandPropertyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('stavební')) return 'building_plot';
  if (t.includes('pole') || t.includes('orná')) return 'field';
  if (t.includes('zahrad')) return 'garden';
  if (t.includes('les')) return 'forest';
  if (t.includes('komerční')) return 'commercial_plot';
  if (t.includes('louk')) return 'meadow';
  if (t.includes('sad') || t.includes('vinic')) return 'orchard';
  if (t.includes('rybník') || t.includes('vodní')) return 'water';
  return 'other';
}

/**
 * Map property subtype to standard values
 */
function mapPropertySubtype(
  subtype?: string
):
  | 'building_plot'
  | 'agricultural'
  | 'forest'
  | 'vineyard'
  | 'orchard'
  | 'recreational'
  | 'industrial'
  | undefined {
  if (!subtype) return undefined;

  const normalized = subtype.toLowerCase();
  if (normalized === 'building_plot' || normalized.includes('stavební')) return 'building_plot';
  if (normalized === 'agricultural' || normalized.includes('zemědělsk')) return 'agricultural';
  if (normalized === 'forest' || normalized.includes('les')) return 'forest';
  if (normalized === 'vineyard' || normalized.includes('vinice')) return 'vineyard';
  if (normalized === 'orchard' || normalized.includes('sad')) return 'orchard';
  if (normalized === 'recreational' || normalized.includes('rekreačn')) return 'recreational';
  if (normalized === 'industrial' || normalized.includes('průmyslov')) return 'industrial';

  return undefined;
}

/**
 * Map zoning to standard values
 */
function mapZoning(
  zoning?: string
):
  | 'residential'
  | 'commercial'
  | 'agricultural'
  | 'mixed'
  | 'industrial'
  | 'recreational'
  | undefined {
  if (!zoning) return undefined;

  const normalized = zoning.toLowerCase();
  if (normalized === 'residential' || normalized.includes('obytný')) return 'residential';
  if (normalized === 'commercial' || normalized.includes('komerčn')) return 'commercial';
  if (normalized === 'agricultural' || normalized.includes('zemědělsk')) return 'agricultural';
  if (normalized === 'mixed' || normalized.includes('smíšen')) return 'mixed';
  if (normalized === 'industrial' || normalized.includes('průmyslov')) return 'industrial';
  if (normalized === 'recreational' || normalized.includes('rekreačn')) return 'recreational';

  return undefined;
}

/**
 * Map land type to standard values
 */
function mapLandType(
  type?: string
):
  | 'arable'
  | 'grassland'
  | 'forest'
  | 'vineyard'
  | 'orchard'
  | 'building_plot'
  | 'meadow'
  | 'pasture'
  | undefined {
  if (!type) return undefined;

  const normalized = type.toLowerCase();
  if (normalized === 'arable' || normalized.includes('orná')) return 'arable';
  if (normalized === 'grassland' || normalized.includes('trávník')) return 'grassland';
  if (normalized === 'forest' || normalized.includes('les')) return 'forest';
  if (normalized === 'vineyard' || normalized.includes('vinice')) return 'vineyard';
  if (normalized === 'orchard' || normalized.includes('sad')) return 'orchard';
  if (normalized === 'building_plot' || normalized.includes('stavební')) return 'building_plot';
  if (normalized === 'meadow' || normalized.includes('louka')) return 'meadow';
  if (normalized === 'pasture' || normalized.includes('pastva')) return 'pasture';

  return undefined;
}

/**
 * Map water supply to standard values
 */
function mapWaterSupply(
  status?: string
): 'mains' | 'well' | 'connection_available' | 'none' | undefined {
  if (!status) return undefined;

  const normalized = status.toLowerCase();

  if (normalized === 'mains' || normalized.includes('vodovod')) return 'mains';
  if (normalized === 'well' || normalized.includes('studna')) return 'well';
  if (normalized === 'connection_available' || normalized.includes('možnost připojení'))
    return 'connection_available';
  if (normalized === 'none' || normalized.includes('bez')) return 'none';

  return undefined;
}

/**
 * Map sewage to standard values
 */
function mapSewage(
  status?: string
): 'mains' | 'septic' | 'connection_available' | 'none' | undefined {
  if (!status) return undefined;

  const normalized = status.toLowerCase();

  if (normalized === 'mains' || normalized.includes('kanalizace')) return 'mains';
  if (normalized === 'septic' || normalized.includes('septik')) return 'septic';
  if (normalized === 'connection_available' || normalized.includes('možnost připojení'))
    return 'connection_available';
  if (normalized === 'none' || normalized.includes('bez')) return 'none';

  return undefined;
}

/**
 * Map electricity to standard values
 */
function mapElectricity(
  status?: string
): 'connected' | 'connection_available' | 'none' | undefined {
  if (!status) return undefined;

  const normalized = status.toLowerCase();

  if (normalized === 'connected' || normalized.includes('elektřina')) return 'connected';
  if (normalized === 'connection_available' || normalized.includes('možnost připojení'))
    return 'connection_available';
  if (normalized === 'none' || normalized.includes('bez')) return 'none';

  return undefined;
}

/**
 * Map gas to standard values
 */
function mapGas(status?: string): 'connected' | 'connection_available' | 'none' | undefined {
  if (!status) return undefined;

  const normalized = status.toLowerCase();

  if (normalized === 'connected' || normalized.includes('plyn')) return 'connected';
  if (normalized === 'connection_available' || normalized.includes('možnost připojení'))
    return 'connection_available';
  if (normalized === 'none' || normalized.includes('bez')) return 'none';

  return undefined;
}

/**
 * Map road access to standard values
 */
function mapRoadAccess(access?: string): 'paved' | 'gravel' | 'dirt' | 'none' | undefined {
  if (!access) return undefined;

  const normalized = access.toLowerCase();
  if (normalized === 'paved' || normalized.includes('asfalt')) return 'paved';
  if (normalized === 'gravel' || normalized.includes('štěrk')) return 'gravel';
  if (normalized === 'dirt' || normalized.includes('polní')) return 'dirt';
  if (normalized === 'none' || normalized.includes('bez')) return 'none';

  return undefined;
}

/**
 * Map terrain to standard values
 */
function mapTerrain(terrain?: string): 'flat' | 'sloped' | 'hilly' | 'mountainous' | undefined {
  if (!terrain) return undefined;

  const normalized = terrain.toLowerCase();
  if (normalized === 'flat' || normalized.includes('rovný')) return 'flat';
  if (normalized === 'sloped' || normalized.includes('svažit')) return 'sloped';
  if (normalized === 'hilly' || normalized.includes('kopcovit')) return 'hilly';
  if (normalized === 'mountainous' || normalized.includes('hornat')) return 'mountainous';

  return undefined;
}

/**
 * Map ownership type to standard values
 */
function mapOwnershipType(
  type?: string
): 'personal' | 'state' | 'municipal' | 'cooperative' | undefined {
  if (!type) return undefined;

  const normalized = type.toLowerCase();
  if (normalized === 'personal' || normalized.includes('osobní')) return 'personal';
  if (normalized === 'state' || normalized.includes('státní')) return 'state';
  if (normalized === 'municipal' || normalized.includes('obecní')) return 'municipal';
  if (normalized === 'cooperative' || normalized.includes('družstevní')) return 'cooperative';

  return undefined;
}

/**
 * Build features array from utilities and characteristics
 */
function buildFeatures(extracted: LandLLMExtraction | null): string[] {
  if (!extracted) return [];

  const features: string[] = [];

  if (extracted.water_supply && extracted.water_supply !== 'none') {
    features.push(`water_supply_${extracted.water_supply}`);
  }
  if (extracted.sewage && extracted.sewage !== 'none') {
    features.push(`sewage_${extracted.sewage}`);
  }
  if (extracted.electricity && extracted.electricity !== 'none') {
    features.push(`electricity_${extracted.electricity}`);
  }
  if (extracted.gas && extracted.gas !== 'none') {
    features.push(`gas_${extracted.gas}`);
  }
  if (extracted.building_permit) {
    features.push('building_permit');
  }
  if (extracted.road_access && extracted.road_access !== 'none') {
    features.push(`road_access_${extracted.road_access}`);
  }

  return features;
}

/**
 * Map country code to full name
 */
function mapCountryName(country: string): string {
  const countryMap: Record<string, string> = {
    cz: 'Czech Republic',
    sk: 'Slovakia',
    pl: 'Poland',
    at: 'Austria',
  };
  return countryMap[country] || 'Unknown';
}
