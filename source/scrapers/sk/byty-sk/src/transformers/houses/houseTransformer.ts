import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { BytyListing } from '../../types/bytyTypes';
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeFurnished,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType,
  parseSlovakFeatures,
  type ParsedAmenities
} from '../../shared/slovak-value-mappings';

/**
 * Transform Byty.sk House (domy) to HousePropertyTierI
 *
 * FIELD EXTRACTION STRATEGY:
 * - Tier I (Global): 51 standardized fields shared across all countries
 * - Tier II (Slovak): Country-specific typed columns (disposition, ownership, etc.)
 * - Tier III (Portal): JSONB portal_metadata for Byty.sk-specific data
 *
 * Data source: HTML scraping from list page (details array)
 * Limitations: Detail page fields (stories, precise land area) not available in list view
 */
export function transformBytyHouse(listing: BytyListing): HousePropertyTierI {
  // ============ Core Identification ============
  const title = listing.title || 'Unknown';
  const price = listing.price || 0;
  const currency = listing.currency || 'EUR';
  const transaction_type = listing.transactionType === 'prenajom' ? 'rent' : 'sale';

  // ============ Location ============
  const location: PropertyLocation = {
    address: listing.location || 'Unknown',
    city: extractCity(listing.location),
    country: 'sk',
    coordinates: undefined,
  };

  // ============ Extract All Available Fields from Details ============
  const amenities: ParsedAmenities = parseSlovakFeatures(listing.details);

  // Extract room count from details or title
  const rooms = extractRoomsFromDetails(listing.details, listing.title);
  const bedrooms = rooms ? Math.max(1, rooms - 1) : 1;
  const bathrooms = rooms && rooms >= 2 ? Math.max(1, Math.floor(rooms / 2)) : 1;
  const sqm = listing.area || 0;

  // House-specific fields
  const property_subtype = detectHouseType(listing);
  const stories = extractStoriesFromDetails(listing.details, listing.title);
  const sqm_living = sqm; // Area in list view is often living space
  const sqm_plot = extractPlotArea(listing.details) || sqm; // Try to extract plot separately

  // ============ Tier I Amenities (Boolean fields) ============
  const has_garden = amenities.has_garden || false;
  const has_garage = amenities.has_garage || false;
  const has_basement = amenities.has_basement || false;
  const has_parking = amenities.has_parking || has_garage || false;

  // ============ Tier I Condition (Normalized to English) ============
  const conditionRaw = extractConditionFromDetails(listing.details, listing.title);
  const conditionNormalized = normalizeCondition(conditionRaw);
  const condition: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined =
    conditionNormalized === 'very_good' ? 'excellent' :
    conditionNormalized === 'before_renovation' ? 'requires_renovation' :
    conditionNormalized === 'under_construction' ? 'new' :
    (conditionNormalized as 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined);

  // ============ Tier I Energy, Heating, Construction ============
  const energy_class = extractAndNormalizeEnergyClass(listing.details);
  const heating_type = extractAndNormalizeHeating(listing.details) || undefined;
  const constructionRaw = extractAndNormalizeConstruction(listing.details);
  const construction_type: 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined =
    constructionRaw === 'panel' || constructionRaw === 'other'
      ? undefined
      : (constructionRaw as 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined);
  const year_built = extractYearBuilt(listing.details, listing.title);

  // ============ Tier I Financial Details ============
  const deposit = transaction_type === 'rent' ? extractDeposit(listing.details, price) : undefined;

  // ============ Tier I Furnished Status ============
  const furnished_status = extractFurnishedStatus(listing.details);

  // ============ Dates ============
  const published_date = parsePublishedDate(listing.date);

  // ============ Tier II Slovak-Specific Fields ============
  const slovak_disposition = rooms ? normalizeDisposition(`${rooms}-izbový`) : undefined;
  const slovak_ownership_raw = extractOwnershipFromDetails(listing.details);
  const slovak_ownership = normalizeOwnership(slovak_ownership_raw) || 'other';

  // Additional Slovak fields from amenities
  const slovak_has_loggia = amenities.has_loggia;
  const slovak_is_barrier_free = amenities.is_barrier_free;
  const slovak_is_low_energy = amenities.is_low_energy;

  // ============ Construct Final Object (3-Tier Architecture) ============
  return {
    // ========== TIER I: GLOBAL STANDARD FIELDS ==========
    property_category: 'house',
    title,
    price,
    currency,
    transaction_type,
    source_url: listing.url,
    source_platform: 'byty-sk',
    status: 'active',
    location,

    // Core house metrics
    bedrooms,
    bathrooms,
    sqm_living,
    sqm_plot,
    rooms,

    // House-specific Tier I fields
    property_subtype,
    stories,
    has_garden,
    has_garage,
    has_basement,
    has_parking,

    // Universal property attributes
    condition,
    heating_type,
    construction_type,
    energy_class,
    year_built,

    // Financial details
    available_from: undefined,
    deposit,
    parking_spaces: has_parking ? 1 : undefined,

    // Furnished status
    furnished: furnished_status,

    // Dates
    published_date,

    // ========== TIER III: PORTAL METADATA (JSONB) ==========
    portal_metadata: {
      byty_sk: {
        original_id: listing.id,
        date: listing.date,
        details: listing.details,
        extracted_amenities: amenities,
      },
    },

    // Country-specific fields (Slovakia)
    country_specific: {
      slovakia: {
        disposition: slovak_disposition,
        ownership: slovak_ownership,
        has_loggia: slovak_has_loggia,
        is_barrier_free: slovak_is_barrier_free,
        is_low_energy: slovak_is_low_energy,
      }
    },

    // Media
    images: listing.imageUrl ? [listing.imageUrl] : [],
    description: listing.description,
  };
}

// ============================================================================
// HELPER FUNCTIONS: Field Extraction from Byty.sk HTML Details
// ============================================================================

function extractCity(location: string): string {
  if (!location) return '';
  return location.split(/[-,]/)[0].trim().replace(/\s*\d+$/, '') || location;
}

function extractRoomsFromDetails(details?: string[], title?: string): number | undefined {
  const sources = [...(details || []), title || ''];

  for (const source of sources) {
    const match = source.match(/(\d+)\s*[-\s]?izb/i);
    if (match) {
      const count = parseInt(match[1]);
      if (count >= 1 && count <= 10) return count;
    }
  }

  return undefined;
}

function detectHouseType(listing: BytyListing): 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow' | undefined {
  const title = listing.title?.toLowerCase() || '';
  const details = listing.details?.map(d => d.toLowerCase()).join(' ') || '';
  const combined = `${title} ${details}`;

  if (combined.includes('vila') || combined.includes('villa')) return 'villa';
  if (combined.includes('radový') || combined.includes('radova') || combined.includes('townhouse')) return 'townhouse';
  if (combined.includes('chalupa') || combined.includes('chata') || combined.includes('cottage')) return 'cottage';
  if (combined.includes('bungalov') || combined.includes('bungalow')) return 'bungalow';
  if (combined.includes('farma') || combined.includes('farmhouse')) return 'farmhouse';
  if (combined.includes('poloblok') || combined.includes('semi') || combined.includes('dvojdom')) return 'semi_detached';

  return 'detached';
}

function extractStoriesFromDetails(details?: string[], title?: string): number | undefined {
  const sources = [...(details || []), title || ''];

  for (const source of sources) {
    const match = source.match(/(\d+)\s*(?:podlaž|poschodí|floor|story|storey)/i);
    if (match) {
      const count = parseInt(match[1]);
      if (count >= 1 && count <= 5) return count;
    }
  }

  return undefined;
}

function extractPlotArea(details?: string[]): number | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    // Match "pozemok 500m²" or "land 500 sqm"
    const match = detail.match(/(?:pozemok|plot|land)\s*:?\s*(\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }
  }

  return undefined;
}

function extractConditionFromDetails(details?: string[], title?: string): string | undefined {
  const sources = [...(details || []), title || ''].map(s => s.toLowerCase());

  const conditionKeywords = [
    { pattern: /novostavb|nový|novy/i, value: 'novostavba' },
    { pattern: /po rekonštrukcii|po rekonstrukcii|after renovation/i, value: 'po rekonštrukcii' },
    { pattern: /pred rekonštrukciou|pred rekonstrukciou|before renovation/i, value: 'pred rekonštrukciou' },
    { pattern: /výborn|vyborn|excellent/i, value: 'výborný' },
    { pattern: /veľmi dobr|velmi dobr|very good/i, value: 'veľmi dobrý' },
    { pattern: /dobr|good/i, value: 'dobrý' },
    { pattern: /projekt|project/i, value: 'projekt' },
    { pattern: /vo výstavbe|vo vystavbe|under construction/i, value: 'vo výstavbe' }
  ];

  for (const source of sources) {
    for (const { pattern, value } of conditionKeywords) {
      if (pattern.test(source)) return value;
    }
  }

  return undefined;
}

function extractOwnershipFromDetails(details?: string[]): string | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const lower = detail.toLowerCase();
    if (lower.includes('osobn') || lower.includes('personal')) return 'osobné';
    if (lower.includes('družstev') || lower.includes('druzstev') || lower.includes('cooperative')) return 'družstevné';
    if (lower.includes('obecn') || lower.includes('municipal')) return 'obecné';
    if (lower.includes('štátn') || lower.includes('statn') || lower.includes('state')) return 'štátne';
  }

  return undefined;
}

function extractYearBuilt(details?: string[], title?: string): number | undefined {
  const sources = [...(details || []), title || ''];

  for (const source of sources) {
    const match = source.match(/\b(19\d{2}|20[0-3]\d)\b/);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1800 && year <= 2030) return year;
    }
  }

  return undefined;
}

function extractAndNormalizeEnergyClass(details?: string[]): 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const match = detail.match(/energ[^\s]*\s*trieda\s*([a-g])/i) ||
                  detail.match(/energy\s*class\s*([a-g])/i) ||
                  detail.match(/\b([a-g])\s*trieda/i);
    if (match) {
      return normalizeEnergyRating(match[1]);
    }
  }

  return undefined;
}

function extractAndNormalizeHeating(details?: string[]): 'central_heating' | 'individual_heating' | 'electric_heating' | 'gas_heating' | 'boiler' | 'heat_pump' | 'other' | undefined {
  if (!details) return undefined;
  const combined = details.join(' ').toLowerCase();
  return normalizeHeatingType(combined);
}

function extractAndNormalizeConstruction(details?: string[]): 'panel' | 'brick' | 'stone' | 'wood' | 'concrete' | 'mixed' | 'other' | undefined {
  if (!details) return undefined;
  const combined = details.join(' ').toLowerCase();
  return normalizeConstructionType(combined);
}

function extractDeposit(details: string[] | undefined, monthlyRent: number): number | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const amountMatch = detail.match(/(?:kaucia|deposit)\s*:?\s*(\d+)/i);
    if (amountMatch) return parseInt(amountMatch[1]);

    const monthsMatch = detail.match(/(?:kaucia|deposit)\s*:?\s*(\d+)\s*(?:mesiac|month)/i);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      return months * monthlyRent;
    }
  }

  return undefined;
}

function extractFurnishedStatus(details?: string[]): 'furnished' | 'partially_furnished' | 'not_furnished' | undefined {
  if (!details) return undefined;
  const combined = details.join(' ').toLowerCase();
  return normalizeFurnished(combined);
}

function parsePublishedDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;

  const lower = dateStr.toLowerCase().trim();
  const today = new Date();

  if (lower === 'dnes' || lower === 'today') return today.toISOString();

  if (lower === 'včera' || lower === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  }

  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  return undefined;
}
