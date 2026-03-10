import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
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
 * Transform Byty.sk Apartment (byty) to ApartmentPropertyTierI
 *
 * FIELD EXTRACTION STRATEGY:
 * - Tier I (Global): 51 standardized fields shared across all countries
 * - Tier II (Slovak): Country-specific typed columns (disposition, ownership, etc.)
 * - Tier III (Portal): JSONB portal_metadata for Byty.sk-specific data
 *
 * Data source: HTML scraping from list page (details array)
 * Limitations: Detail page fields (floor, heating, etc.) not available in list view
 */
export function transformBytyApartment(listing: BytyListing): ApartmentPropertyTierI {
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
  const bedrooms = rooms ? Math.max(1, rooms - 1) : 1; // n-1 rooms = bedrooms (living room excluded)
  const bathrooms = rooms && rooms >= 2 ? Math.max(1, Math.floor(rooms / 2)) : 1; // Estimate bathrooms
  const sqm = listing.area || 0;

  // Floor information (apartment-specific)
  const floorInfo = extractFloorInfo(listing.details, listing.title);
  const floor = floorInfo?.floor;
  const total_floors = floorInfo?.totalFloors;
  const floor_location = floorInfo ? calculateFloorLocation(floorInfo.floor, floorInfo.totalFloors) : undefined;

  // ============ Tier I Amenities (Boolean fields) ============
  const has_parking = amenities.has_parking || amenities.has_garage || false;
  const has_balcony = amenities.has_balcony || amenities.has_loggia || false;
  const has_elevator = amenities.has_elevator || false;
  const has_basement = amenities.has_basement || false;

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
  const construction_type: 'panel' | 'brick' | 'concrete' | 'mixed' | undefined =
    constructionRaw === 'stone' || constructionRaw === 'wood' || constructionRaw === 'other'
      ? undefined
      : (constructionRaw as 'panel' | 'brick' | 'concrete' | 'mixed' | undefined);
  const year_built = extractYearBuilt(listing.details, listing.title);

  // ============ Tier I Financial Details ============
  const hoa_fees = extractHOAFees(listing.details);
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
    property_category: 'apartment',
    title,
    price,
    currency,
    transaction_type,
    source_url: listing.url,
    source_platform: 'byty-sk',
    status: 'active',
    location,

    // Core apartment metrics
    bedrooms,
    bathrooms,
    sqm,
    rooms,

    // Apartment-specific Tier I fields
    floor,
    total_floors,
    floor_location,
    has_elevator,
    has_balcony,
    has_basement,
    has_parking,
    hoa_fees,
    balcony_area: undefined, // Not available in list view

    // Universal property attributes
    condition,
    heating_type,
    construction_type,
    energy_class,
    year_built,

    // Financial details
    available_from: undefined, // Not available in list view
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
        extracted_amenities: amenities, // Full amenity details
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

/**
 * Extract city from location string
 * Example: "Bratislava - Staré Mesto, Kresánkova" → "Bratislava"
 */
function extractCity(location: string): string {
  if (!location) return '';
  // Split by dash or comma, take first part, remove trailing digits
  return location.split(/[-,]/)[0].trim().replace(/\s*\d+$/, '') || location;
}

/**
 * Extract room count from details array and title
 * Patterns: "2 izb", "2-izbový", "2 izbový byt"
 */
function extractRoomsFromDetails(details?: string[], title?: string): number | undefined {
  const sources = [
    ...(details || []),
    title || ''
  ];

  for (const source of sources) {
    // Match "N izb" or "N-izbový"
    const match = source.match(/(\d+)\s*[-\s]?izb/i);
    if (match) {
      const count = parseInt(match[1]);
      if (count >= 1 && count <= 10) {
        return count;
      }
    }
  }

  return undefined;
}

/**
 * Extract floor information from details or title
 * Patterns: "3. poschodie", "poschodie 3/5", "3/5"
 */
interface FloorInfo {
  floor: number;
  totalFloors?: number;
}

function extractFloorInfo(details?: string[], title?: string): FloorInfo | undefined {
  const sources = [
    ...(details || []),
    title || ''
  ];

  for (const source of sources) {
    // Match "X/Y" pattern (floor X of Y total)
    const fractionMatch = source.match(/(\d+)\s*\/\s*(\d+)/);
    if (fractionMatch) {
      return {
        floor: parseInt(fractionMatch[1]),
        totalFloors: parseInt(fractionMatch[2])
      };
    }

    // Match "poschodie X" or "X. poschodie"
    const floorMatch = source.match(/(?:poschodie|floor)\s*(\d+)|(\d+)\.\s*poschodie/i);
    if (floorMatch) {
      const floorNum = parseInt(floorMatch[1] || floorMatch[2]);
      return { floor: floorNum };
    }
  }

  return undefined;
}

/**
 * Calculate floor location based on floor and total floors
 */
function calculateFloorLocation(floor: number | undefined, totalFloors: number | undefined): 'ground_floor' | 'middle_floor' | 'top_floor' | undefined {
  if (floor === undefined || totalFloors === undefined) return undefined;
  if (floor === 0 || floor === 1) return 'ground_floor';
  if (floor === totalFloors) return 'top_floor';
  return 'middle_floor';
}

/**
 * Extract condition from details and title
 * Returns Slovak raw value for normalization
 */
function extractConditionFromDetails(details?: string[], title?: string): string | undefined {
  const sources = [
    ...(details || []),
    title || ''
  ].map(s => s.toLowerCase());

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
      if (pattern.test(source)) {
        return value;
      }
    }
  }

  return undefined;
}

/**
 * Extract ownership type from details
 */
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

/**
 * Extract year built from details or title
 * Patterns: "rok 2020", "2020", "stavba 2015"
 */
function extractYearBuilt(details?: string[], title?: string): number | undefined {
  const sources = [
    ...(details || []),
    title || ''
  ];

  for (const source of sources) {
    // Match 4-digit year between 1800-2030
    const match = source.match(/\b(19\d{2}|20[0-3]\d)\b/);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1800 && year <= 2030) {
        return year;
      }
    }
  }

  return undefined;
}

/**
 * Extract and normalize energy class
 */
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

/**
 * Extract and normalize heating type
 */
function extractAndNormalizeHeating(details?: string[]): 'central_heating' | 'individual_heating' | 'electric_heating' | 'gas_heating' | 'boiler' | 'heat_pump' | 'other' | undefined {
  if (!details) return undefined;

  const combined = details.join(' ').toLowerCase();
  return normalizeHeatingType(combined);
}

/**
 * Extract and normalize construction type
 */
function extractAndNormalizeConstruction(details?: string[]): 'panel' | 'brick' | 'stone' | 'wood' | 'concrete' | 'mixed' | 'other' | undefined {
  if (!details) return undefined;

  const combined = details.join(' ').toLowerCase();
  return normalizeConstructionType(combined);
}

/**
 * Extract HOA fees (monthly common charges)
 * Patterns: "réžia 50€", "poplatky 50 EUR"
 */
function extractHOAFees(details?: string[]): number | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const match = detail.match(/(?:réžia|rezia|poplatky|charges|hoa)\s*:?\s*(\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }
  }

  return undefined;
}

/**
 * Extract deposit for rentals
 * Patterns: "kaucia 500€", "deposit 2 months" (calculate as 2x rent)
 */
function extractDeposit(details: string[] | undefined, monthlyRent: number): number | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    // Direct amount
    const amountMatch = detail.match(/(?:kaucia|deposit)\s*:?\s*(\d+)/i);
    if (amountMatch) {
      return parseInt(amountMatch[1]);
    }

    // Months multiplier
    const monthsMatch = detail.match(/(?:kaucia|deposit)\s*:?\s*(\d+)\s*(?:mesiac|month)/i);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      return months * monthlyRent;
    }
  }

  return undefined;
}

/**
 * Extract furnished status
 */
function extractFurnishedStatus(details?: string[]): 'furnished' | 'partially_furnished' | 'not_furnished' | undefined {
  if (!details) return undefined;

  const combined = details.join(' ').toLowerCase();
  return normalizeFurnished(combined);
}

/**
 * Parse published date from Slovak date string
 * Patterns: "dnes", "včera", "27.1.2026", "27. január 2026"
 */
function parsePublishedDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;

  const lower = dateStr.toLowerCase().trim();
  const today = new Date();

  // Handle relative dates
  if (lower === 'dnes' || lower === 'today') {
    return today.toISOString();
  }

  if (lower === 'včera' || lower === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  }

  // Parse DD.MM.YYYY
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return undefined;
}
