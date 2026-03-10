import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { BytyListing } from '../../types/bytyTypes';
import {
  normalizeOwnership,
  parseSlovakFeatures,
  type ParsedAmenities
} from '../../shared/slovak-value-mappings';

/**
 * Transform Byty.sk Land (pozemky) to LandPropertyTierI
 *
 * FIELD EXTRACTION STRATEGY:
 * - Tier I (Global): Land-specific standardized fields
 * - Tier II (Slovak): Country-specific typed columns (ownership, etc.)
 * - Tier III (Portal): JSONB portal_metadata for Byty.sk-specific data
 *
 * Data source: HTML scraping from list page (details array)
 * Limitations: Zoning details, exact utilities info not always available
 */
export function transformBytyLand(listing: BytyListing): LandPropertyTierI {
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

  // ============ Land-Specific Details ============
  const property_subtype = detectLandType(listing);
  const area_plot_sqm = listing.area || 0; // For land, area is always plot area

  // Land infrastructure
  const building_permit = extractBuildingPermitFromDetails(listing.details);
  const has_utilities = extractUtilitiesFromDetails(listing.details);
  const road_access_bool = extractRoadAccessFromDetails(listing.details);
  const road_access: 'paved' | 'gravel' | 'dirt' | 'none' | undefined =
    road_access_bool === true ? 'paved' : road_access_bool === false ? 'none' : undefined;

  // ============ Zoning & Use ============
  const zoning = extractZoning(listing.details, listing.title);
  const slopeRaw = extractSlope(listing.details);
  // Map slope to terrain field ('flat' | 'sloped' | 'hilly' | 'mountainous')
  const terrain: 'flat' | 'sloped' | 'hilly' | 'mountainous' | undefined =
    slopeRaw === 'flat' ? 'flat' :
    slopeRaw === 'gentle' ? 'sloped' :
    slopeRaw === 'moderate' ? 'hilly' :
    slopeRaw === 'steep' ? 'mountainous' :
    undefined;

  // ============ Dates ============
  const published_date = parsePublishedDate(listing.date);

  // ============ Tier II Slovak-Specific Fields ============
  const slovak_ownership_raw = extractOwnershipFromDetails(listing.details);
  const slovak_ownership = normalizeOwnership(slovak_ownership_raw) || 'other';

  // ============ Construct Final Object (3-Tier Architecture) ============
  return {
    // ========== TIER I: GLOBAL STANDARD FIELDS ==========
    property_category: 'land',
    title,
    price,
    currency,
    transaction_type,
    source_url: listing.url,
    source_platform: 'byty-sk',
    status: 'active',
    location,

    // Land-specific Tier I fields
    property_subtype,
    area_plot_sqm,
    building_permit,
    road_access,
    zoning,
    terrain,

    // Dates
    published_date,

    // ========== TIER III: PORTAL METADATA (JSONB) ==========
    portal_metadata: {
      byty_sk: {
        original_id: listing.id,
        date: listing.date,
        details: listing.details,
        extracted_amenities: amenities,
        has_utilities_detected: has_utilities,
      },
    },

    // Country-specific fields (Slovakia)
    country_specific: {
      slovakia: {
        disposition: undefined,
        ownership: slovak_ownership,
        is_low_energy: amenities.is_low_energy,
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

/**
 * Detect land type from title and details
 */
function detectLandType(listing: BytyListing): 'building_plot' | 'agricultural' | 'forest' | 'vineyard' | 'orchard' | 'recreational' | 'industrial' | undefined {
  const title = listing.title?.toLowerCase() || '';
  const details = listing.details?.map(d => d.toLowerCase()).join(' ') || '';
  const combined = `${title} ${details}`;

  // Forest
  if (combined.includes('les') || combined.includes('forest')) return 'forest';

  // Vineyard
  if (combined.includes('vinica') || combined.includes('vineyard')) return 'vineyard';

  // Orchard
  if (combined.includes('sad') || combined.includes('ovocn') || combined.includes('orchard')) return 'orchard';

  // Industrial
  if (
    combined.includes('priemyselný') ||
    combined.includes('priemyselny') ||
    combined.includes('industrial') ||
    combined.includes('výrobn') ||
    combined.includes('vyrobn')
  ) {
    return 'industrial';
  }

  // Recreational
  if (
    combined.includes('rekreačný') ||
    combined.includes('rekreacny') ||
    combined.includes('chatová') ||
    combined.includes('chatova') ||
    combined.includes('recreational') ||
    combined.includes('záhrad') ||
    combined.includes('zahrad')
  ) {
    return 'recreational';
  }

  // Agricultural (arable, grassland, meadow, pasture)
  if (
    combined.includes('orná') ||
    combined.includes('orna') ||
    combined.includes('lúka') ||
    combined.includes('luka') ||
    combined.includes('meadow') ||
    combined.includes('grassland') ||
    combined.includes('pasture') ||
    combined.includes('pasienok') ||
    combined.includes('poľnohospodársk') ||
    combined.includes('polnohospodarsk') ||
    combined.includes('agricultural')
  ) {
    return 'agricultural';
  }

  // Building plot (default for unspecified land)
  if (
    combined.includes('staveb') ||
    combined.includes('building') ||
    combined.includes('parcela') ||
    combined.includes('plot')
  ) {
    return 'building_plot';
  }

  return 'building_plot'; // Default
}

/**
 * Extract building permit status
 */
function extractBuildingPermitFromDetails(details?: string[]): boolean | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const lower = detail.toLowerCase();
    if (
      lower.includes('stavebné povolenie') ||
      lower.includes('stavebne povolenie') ||
      lower.includes('building permit') ||
      lower.includes('s povolením') ||
      lower.includes('s povolenim')
    ) {
      return true;
    }

    // Explicit "no permit" or "without permit"
    if (
      lower.includes('bez povolenia') ||
      lower.includes('without permit')
    ) {
      return false;
    }
  }

  return undefined;
}

/**
 * Extract utilities status (water, electricity, gas, sewage)
 */
function extractUtilitiesFromDetails(details?: string[]): boolean | undefined {
  if (!details) return undefined;

  let foundUtility = false;

  for (const detail of details) {
    const lower = detail.toLowerCase();
    if (
      lower.includes('inžinierske siete') ||
      lower.includes('inzinierske siete') ||
      lower.includes('utilities') ||
      lower.includes('voda') ||
      lower.includes('water') ||
      lower.includes('električka') ||
      lower.includes('elektrina') ||
      lower.includes('electricity') ||
      lower.includes('plyn') ||
      lower.includes('gas') ||
      lower.includes('kanalizácia') ||
      lower.includes('kanalizacia') ||
      lower.includes('sewage')
    ) {
      foundUtility = true;
    }
  }

  return foundUtility ? true : undefined;
}

/**
 * Extract road access status
 */
function extractRoadAccessFromDetails(details?: string[]): boolean | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const lower = detail.toLowerCase();
    if (
      lower.includes('prístup') ||
      lower.includes('pristup') ||
      lower.includes('prístupová cesta') ||
      lower.includes('pristupova cesta') ||
      lower.includes('cesta') ||
      lower.includes('road access') ||
      lower.includes('access') ||
      lower.includes('asfalt') ||
      lower.includes('asphalt')
    ) {
      return true;
    }

    // Explicit "no access"
    if (
      lower.includes('bez prístupu') ||
      lower.includes('bez pristupu') ||
      lower.includes('no access')
    ) {
      return false;
    }
  }

  return undefined;
}

/**
 * Extract zoning information
 */
function extractZoning(details?: string[], title?: string): 'residential' | 'commercial' | 'industrial' | 'agricultural' | 'mixed' | undefined {
  const sources = [...(details || []), title || ''].map(s => s.toLowerCase());

  for (const source of sources) {
    // Residential
    if (
      source.includes('bytov') ||
      source.includes('residential') ||
      source.includes('rodinné domy') ||
      source.includes('rodinne domy')
    ) {
      return 'residential';
    }

    // Commercial
    if (
      source.includes('komerčn') ||
      source.includes('komercn') ||
      source.includes('commercial') ||
      source.includes('obchodn') ||
      source.includes('retail')
    ) {
      return 'commercial';
    }

    // Industrial
    if (
      source.includes('priemyseln') ||
      source.includes('industrial') ||
      source.includes('výrobn') ||
      source.includes('vyrobn')
    ) {
      return 'industrial';
    }

    // Agricultural
    if (
      source.includes('poľnohospodár') ||
      source.includes('polnohospodar') ||
      source.includes('agricultural')
    ) {
      return 'agricultural';
    }

    // Mixed
    if (
      source.includes('zmiešan') ||
      source.includes('zmiesan') ||
      source.includes('mixed')
    ) {
      return 'mixed';
    }
  }

  return undefined;
}

/**
 * Extract slope/terrain information
 */
function extractSlope(details?: string[]): 'flat' | 'gentle' | 'moderate' | 'steep' | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const lower = detail.toLowerCase();

    if (lower.includes('rovinn') || lower.includes('flat')) return 'flat';
    if (lower.includes('miern') || lower.includes('gentle')) return 'gentle';
    if (lower.includes('stredný svah') || lower.includes('moderate')) return 'moderate';
    if (lower.includes('strmý') || lower.includes('strmy') || lower.includes('steep')) return 'steep';
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
 * Parse published date from Slovak date string
 */
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
