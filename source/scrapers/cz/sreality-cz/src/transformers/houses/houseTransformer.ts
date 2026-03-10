import { HousePropertyTierI, PropertyImage } from '@landomo/core';
import { SRealityListing } from '../../types/srealityTypes';
import { SRealityItemsParser, FIELD_NAMES } from '../../utils/itemsParser';
import {
  bedroomsFromDisposition,
  getStringOrValue,
  extractCity,
  mapSubType,
  ensureBoolean,
  extractImages,
  extractVirtualTourUrl,
  extractVideoUrl,
  extractHashIdFromUrl,
  extractAreaFromTitle,
  extractSourceUrl,
  extractSellerInfo,
  extractLabelsFeatures,
  mapOwnership,
  extractCommissionInfo,
  parseAvailableFrom,
  OWNERSHIP_CODES,
  BUILDING_TYPE_CODES,
} from '../../utils/srealityHelpers';
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeHeatingType,
  normalizeEnergyRating,
  normalizeFurnished,
  normalizeConstructionType
} from '../../../../shared/czech-value-mappings';

/**
 * Transform SReality house listing to HousePropertyTierI
 *
 * House-specific fields:
 * - sqm_plot (CRITICAL - main house differentiator)
 * - sqm_living, sqm_total
 * - has_garden, garden_area
 * - has_garage, garage_count
 * - has_parking, parking_spaces
 * - has_basement, cellar_area
 * - has_pool, has_fireplace, has_terrace, has_attic
 * - stories (NOT floor number!)
 * - Czech infrastructure: water_supply, sewage_type, gas_connection
 */
export function transformHouse(listing: SRealityListing): HousePropertyTierI {
  // Initialize type-safe parser (single O(n) pass)
  const parser = new SRealityItemsParser(listing.items || []);

  // Extract Czech disposition (e.g., "4+1", "5+kk")
  const disposition = parser.getString(FIELD_NAMES.DISPOSITION);

  // Extract bedrooms from disposition (houses use same logic as apartments)
  const bedrooms = bedroomsFromDisposition(disposition);

  // Extract bathrooms
  const bathrooms = extractBathrooms(parser);

  // === CRITICAL HOUSE AREAS ===
  // Living area (interior usable space)
  const sqm_living = parser.getAreaOr(FIELD_NAMES.LIVING_AREA, FIELD_NAMES.LIVING_AREA_TRUNCATED, FIELD_NAMES.AREA) ?? extractAreaFromTitle(getStringOrValue(listing.name) || '');

  // Total built area (including walls, structures)
  const sqm_total = parser.getAreaOr(FIELD_NAMES.TOTAL_AREA, FIELD_NAMES.BUILT_UP_AREA, FIELD_NAMES.BUILT_UP_AREA_ALT);

  // Plot area (CRITICAL for houses - main differentiator)
  const sqm_plot = parser.getArea(FIELD_NAMES.PLOT_AREA);

  // Number of stories (NOT floor number - houses ARE the building)
  const stories = extractStories(parser);

  // === G. labelsAll[0] features — supplement items[] booleans ===
  const labels = extractLabelsFeatures(listing.labelsAll);

  // === HOUSE AMENITIES (all must be boolean, not undefined) ===
  // Garden - check for area value first, then boolean
  const garden_area = parser.getAreaOr(FIELD_NAMES.GARDEN, FIELD_NAMES.GARDEN_AREA);
  const has_garden = ensureBoolean(garden_area ? true : parser.getBooleanOr(FIELD_NAMES.GARDEN, FIELD_NAMES.GARDEN_AREA));

  // Garage — supplement with labelsAll
  const has_garage = ensureBoolean(parser.getBoolean(FIELD_NAMES.GARAGE) || labels.has_garage);
  const garage_count = extractCount(parser, FIELD_NAMES.GARAGE);

  // Parking — supplement with labelsAll
  const has_parking = ensureBoolean(parser.getBoolean(FIELD_NAMES.PARKING) || labels.has_parking);
  const parking_spaces = extractCount(parser, FIELD_NAMES.PARKING);

  // Basement/cellar — supplement with labelsAll
  const cellar_area = parser.getAreaOr(FIELD_NAMES.CELLAR, FIELD_NAMES.BASEMENT);
  const has_basement = ensureBoolean(cellar_area ? true : parser.getBooleanOr(FIELD_NAMES.CELLAR, FIELD_NAMES.BASEMENT) || labels.has_basement);

  // Pool
  const has_pool = ensureBoolean(parser.getBoolean(FIELD_NAMES.BAZEN));

  // Fireplace
  const has_fireplace = ensureBoolean(parser.getBoolean(FIELD_NAMES.KRB));

  // Terrace — supplement with labelsAll
  const terrace_area = parser.getArea(FIELD_NAMES.TERRACE);
  const has_terrace = ensureBoolean(terrace_area ? true : parser.getBoolean(FIELD_NAMES.TERRACE) || labels.has_terrace);

  // Attic
  const has_attic = ensureBoolean(parser.getBooleanOr(FIELD_NAMES.PODKROVI, FIELD_NAMES.PUDA));

  // Balcony — supplement with labelsAll
  const has_balcony = ensureBoolean(parser.getBooleanOr(FIELD_NAMES.BALCONY, FIELD_NAMES.BALCONY_ALT) || labels.has_balcony);
  const balcony_area = parser.getAreaOr(FIELD_NAMES.BALCONY, FIELD_NAMES.BALCONY_ALT);

  // === BUILDING CONTEXT ===
  const year_built = extractYearBuilt(parser);
  const renovation_year = extractRenovationYear(parser);

  // === D. Construction type — codeItems.building_type_search FIRST, items[] text fallback ===
  const buildingTypeCode = listing.codeItems?.building_type_search;
  const buildingTypeRaw = parser.getStringOr(FIELD_NAMES.BUILDING_TYPE, FIELD_NAMES.CONSTRUCTION);
  const construction_type = (
    (typeof buildingTypeCode === 'number' ? BUILDING_TYPE_CODES[buildingTypeCode] : undefined)
    || mapBuildingType(buildingTypeRaw)
  ) as 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined;

  // Condition — labelsAll 'new_building' tag supplements items[] text
  const conditionRaw = parser.getString(FIELD_NAMES.CONDITION);
  const condition = mapCondition(conditionRaw) || labels.condition;

  // === C. Ownership — codeItems.ownership numeric code FIRST, items[] text fallback ===
  const ownershipCode = listing.codeItems?.ownership;
  const ownershipRaw = parser.getString(FIELD_NAMES.OWNERSHIP);
  const ownership: 'personal' | 'cooperative' | 'state' | 'municipal' | undefined =
    (typeof ownershipCode === 'number' ? OWNERSHIP_CODES[ownershipCode] : undefined)
    || mapOwnership(ownershipRaw);

  // Heating type
  const heating_type = parser.getStringOr(FIELD_NAMES.HEATING, FIELD_NAMES.HEATING_ALT, FIELD_NAMES.HEATING_EN);

  // Roof type (houses have roofs!)
  const roof_type = extractRoofType(parser);

  // === B. Energy class — use item.value_type (letter A-G) directly ===
  const energyItem = (listing.items || []).find((i: any) => i.type === 'energy_efficiency_rating');
  const energy_class: string | undefined = energyItem?.value_type
    || parser.getStringOr(FIELD_NAMES.ENERGY_CLASS, FIELD_NAMES.ENERGY_RATING);

  // === FINANCIALS ===
  const property_tax = extractFinancial(parser, FIELD_NAMES.DAN_Z_NEMOVITOSTI);
  const hoa_fees = extractFinancial(parser, FIELD_NAMES.HOA_FEES);
  const deposit = extractFinancial(parser, FIELD_NAMES.DEPOSIT);
  const utility_charges = extractFinancial(parser, FIELD_NAMES.UTILITY_CHARGES);
  const service_charges = extractFinancial(parser, FIELD_NAMES.SERVICE_CHARGES);

  // === RENTAL SPECIFICS ===
  const available_from = parseAvailableFrom(parser.getStringOr(FIELD_NAMES.AVAILABLE_FROM, FIELD_NAMES.AVAILABLE_FROM_ALT));

  // === CLASSIFICATION ===
  const property_subtype = mapSubType(listing.seo?.category_sub_cb) as 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow' | undefined;

  // Extract total rooms count
  const rooms = extractRooms(disposition);

  // Extract furnished status for Tier II
  // Vybavení can be boolean (true/false) or string ("Částečně") - pass raw value
  const furnishedRawItem = parser.getRaw(FIELD_NAMES.FURNISHED);
  const furnishedRaw = furnishedRawItem?.value;
  const furnished = normalizeFurnished(furnishedRaw) || labels.furnished;

  // === F. Seller contact — from _embedded.seller (detail API) ===
  const sellerInfo = extractSellerInfo(listing._embedded);

  // Extract hash_id (fallback to URL extraction for detail API responses)
  const hashId = listing.hash_id ?? extractHashIdFromUrl(listing._links?.self?.href);

  // Extract images with multiple sizes
  const images = extractImages(listing);

  // Extract media URLs
  const virtualTourUrl = extractVirtualTourUrl(listing);
  const videoUrl = extractVideoUrl(listing);

  return {
    // === Category Classification ===
    property_category: 'house' as const,

    // === Tier I: Core Identification ===
    title: getStringOrValue(listing.name) || 'Unknown',
    price: listing.price_czk?.value_raw ?? listing.price as number,
    currency: 'CZK',
    transaction_type: listing.seo?.category_type_cb === 2 ? 'rent' : listing.seo?.category_type_cb === 3 ? 'auction' : 'sale',

    // Location
    location: {
      city: extractCity(getStringOrValue(listing.locality) || ''),
      country: 'cz',
      coordinates: (listing.gps?.lat && listing.gps?.lon) ? {
        lat: listing.gps.lat,
        lon: listing.gps.lon
      } : (listing.map?.lat && listing.map?.lon) ? {
        lat: listing.map.lat,
        lon: listing.map.lon
      } : undefined
    },

    // Classification
    property_subtype,

    // === HOUSE-SPECIFIC DETAILS (all non-nullable fields MUST have values) ===
    bedrooms: bedrooms as number,
    bathrooms: bathrooms ?? 1,
    sqm_living: sqm_living as number,
    sqm_total,
    sqm_plot: sqm_plot as number,
    stories,
    rooms,

    // === HOUSE AMENITIES (all boolean fields are required, not undefined) ===
    has_garden,
    garden_area,
    has_garage,
    garage_count,
    has_parking,
    parking_spaces,
    has_basement,
    cellar_area,
    has_pool,
    has_fireplace,
    has_terrace,
    terrace_area,
    has_attic,
    has_balcony,
    balcony_area,

    // === BUILDING CONTEXT ===
    year_built,
    renovation_year,
    construction_type,
    condition,
    heating_type: normalizeHeatingType(heating_type) || undefined,
    roof_type,
    energy_class,

    // Tier 1 Universal Fields
    furnished,
    published_date: parser.getString(FIELD_NAMES.AKTUALIZACE),

    // === FINANCIALS ===
    property_tax,
    hoa_fees,
    deposit,
    utility_charges,
    service_charges,
    ...extractCommissionInfo(listing.price_czk?.name),

    // === RENTAL SPECIFICS ===
    available_from,

    // === F. Seller contact (from _embedded.seller detail API fields) ===
    ...(sellerInfo ? {
      agent_name: sellerInfo.agent_name,
      agent_phone: sellerInfo.agent_phone,
      agent_email: sellerInfo.agent_email,
      agent_agency: sellerInfo.agent_agency,
    } : {}),

    // === MEDIA & AGENT (enhanced with multiple sizes) ===
    media: images.length > 0 ? {
      images: images.map((img, i): PropertyImage => ({
        url: img.full || img.preview || img.thumbnail || '',
        thumbnail_url: img.thumbnail,
        order: i,
        ...(i === 0 ? { is_main: true } : {}),
      })).filter(img => img.url),
      total_images: listing.advert_images_count,
      virtual_tour_url: virtualTourUrl && virtualTourUrl !== 'available' ? virtualTourUrl : undefined,
      video_tour_url: videoUrl,
    } : undefined,

    // Legacy arrays (deprecated, but keep for backward compatibility)
    images: images.length > 0 ? images.map(img => img.full || img.preview || img.thumbnail).filter(Boolean) as string[] : undefined,
    videos: videoUrl ? [videoUrl] : undefined,

    // agent block kept for backward compatibility; populated from sellerInfo
    agent: (sellerInfo?.agent_name) ? {
      name: sellerInfo.agent_name!,
      phone: sellerInfo.agent_phone,
      email: sellerInfo.agent_email,
      agency: sellerInfo.agent_agency,
      agency_logo: listing._embedded?.seller?.logo?._links?.self?.href,
    } : undefined,

    // Description
    description: listing.text?.value,

    // Features array (house-specific features as strings)
    features: buildFeaturesList(
      parser,
      has_garden,
      has_garage,
      has_parking,
      has_pool,
      has_fireplace,
      has_terrace,
      has_attic,
      has_basement
    ),

    // === Tier II: Country-Specific (Czech Republic) ===
    // NOTE: Use flat keys (czech_disposition, not czech.disposition)
    // because ingest service reads country_specific.czech_disposition
    country_specific: {
      czech_disposition: normalizeDisposition(disposition),
      // ownership: codeItems numeric code → normalized string (most reliable source)
      czech_ownership: ownership || normalizeOwnership(ownershipRaw),
      condition: normalizeCondition(conditionRaw) || labels.condition,
      heating_type: normalizeHeatingType(heating_type),
      // energy_rating: value_type letter (A-G) preferred over verbose text parsing
      energy_rating: energy_class || normalizeEnergyRating(energy_class),
      furnished,
      // construction_type: codeItems code → string preferred over text matching
      construction_type: construction_type || normalizeConstructionType(buildingTypeRaw),
    },

    // === Tier III: Portal Metadata (enhanced with all documented fields) ===
    portal_metadata: {
      sreality: {
        hash_id: hashId,
        name: getStringOrValue(listing.name),
        locality: getStringOrValue(listing.locality),
        price_czk: listing.price_czk?.value_raw,
        price_note: listing.price_czk?.name,
        category_main_cb: listing.seo?.category_main_cb,
        category_sub_cb: listing.seo?.category_sub_cb,
        category_type_cb: listing.seo?.category_type_cb,
        advert_images_count: listing.advert_images_count,

        // Marketing flags
        labels: listing.labels,
        new: listing.new,
        region_tip: listing.region_tip,
        exclusively_at_rk: listing.exclusively_at_rk === 1,

        // Media flags
        has_floor_plan: listing.has_floor_plan === 1,
        has_video: listing.has_video === 1,
        has_panorama: listing.has_panorama === 1,

        // Auction fields
        is_auction: listing.is_auction,
        auction_price: listing.is_auction ? listing.auctionPrice : undefined,

        // Media URLs
        virtual_tour_url: virtualTourUrl && virtualTourUrl !== 'available' ? virtualTourUrl : undefined,
        video_url: videoUrl
      }
    },

    // === PORTAL & LIFECYCLE ===
    source_url: extractSourceUrl(listing, hashId),
    source_platform: 'sreality',
    portal_id: `sreality-${hashId}`,
    status: 'active'
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Extract bathroom count using parser
 */
function extractBathrooms(parser: SRealityItemsParser): number | undefined {
  const bathroomFields = ['Počet koupelen', 'Koupelen', 'Bathrooms', 'Koupelna'] as any[];

  for (const field of bathroomFields) {
    const value = parser.getString(field);
    if (value) {
      const match = value.match(/(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
  }

  // Unknown — return undefined instead of assuming 1
  return undefined;
}

/**
 * Extract number of stories from parser
 * NOTE: This is stories in the house, NOT floor number!
 */
function extractStories(parser: SRealityItemsParser): number | undefined {
  const value = parser.getStringOr(FIELD_NAMES.TOTAL_FLOORS, FIELD_NAMES.FLOOR_COUNT, FIELD_NAMES.FLOORS_IN_BUILDING);
  if (!value) return undefined;

  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract count from parser (e.g., garage count, parking spaces)
 */
function extractCount(parser: SRealityItemsParser, ...fieldNames: any[]): number | undefined {
  for (const field of fieldNames) {
    const value = parser.getString(field);
    if (value) {
      const match = String(value).match(/(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
  }
  return undefined;
}

/**
 * Extract year built using parser
 *
 * SReality API primarily uses 'Rok kolaudace' (occupancy certificate year) rather
 * than 'Rok postavení' or 'Rok výstavby'. All three are checked for completeness.
 */
function extractYearBuilt(parser: SRealityItemsParser): number | undefined {
  const yearFields = [
    FIELD_NAMES.YEAR_COMPLETED,   // 'Rok kolaudace' — primary field the API actually returns
    FIELD_NAMES.YEAR_BUILT,        // 'Rok postavení'
    FIELD_NAMES.YEAR_BUILT_ALT,    // 'Rok výstavby'
  ];

  for (const field of yearFields) {
    const numericValue = parser.getNumber(field);
    if (numericValue && numericValue >= 1800 && numericValue <= 2100) {
      return numericValue;
    }

    const value = parser.getString(field);
    if (value) {
      const match = value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
      const year = match ? parseInt(match[0]) : undefined;
      if (year && year >= 1800 && year <= 2100) {
        return year;
      }
    }
  }

  return undefined;
}

/**
 * Extract renovation year using parser
 */
function extractRenovationYear(parser: SRealityItemsParser): number | undefined {
  const numericValue = parser.getNumber(FIELD_NAMES.RENOVATION_YEAR);
  if (numericValue && numericValue >= 1800 && numericValue <= 2100) {
    return numericValue;
  }

  const value = parser.getString(FIELD_NAMES.RENOVATION_YEAR);
  if (value) {
    const match = value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
    const year = match ? parseInt(match[0]) : undefined;
    if (year && year >= 1800 && year <= 2100) {
      return year;
    }
  }

  return undefined;
}

/**
 * Map Czech building type to construction_type enum
 */
function mapBuildingType(raw?: string): 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (normalized.includes('cihla') || normalized.includes('cihl')) return 'brick';
  if (normalized.includes('dřev') || normalized.includes('drev')) return 'wood';
  if (normalized.includes('kámen') || normalized.includes('kamen')) return 'stone';
  if (normalized.includes('beton')) return 'concrete';
  if (normalized.includes('smíšen') || normalized.includes('smisen')) return 'mixed';

  return undefined;
}

/**
 * Map Czech condition to enum
 */
function mapCondition(raw?: string): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (normalized.includes('novostavba') || normalized.includes('nový')) return 'new';
  if (normalized.includes('výborný') || normalized.includes('vyborny')) return 'excellent';
  if (normalized.includes('velmi dobrý') || normalized.includes('dobrý') || normalized.includes('dobry')) return 'good';
  if (normalized.includes('po rekonstrukci') || normalized.includes('renovován')) return 'after_renovation';
  if (normalized.includes('vyžaduje') || normalized.includes('projekt') || normalized.includes('k rekonstrukci')) return 'requires_renovation';

  return undefined;
}

/**
 * Extract roof type using parser (house-specific!)
 */
function extractRoofType(parser: SRealityItemsParser): 'flat' | 'gable' | 'hip' | 'mansard' | 'gambrel' | undefined {
  const roofValue = parser.getStringOr(FIELD_NAMES.TYP_STRECHY, FIELD_NAMES.STRECHA);
  if (!roofValue) return undefined;

  const normalized = roofValue.toLowerCase();
  if (normalized.includes('plochá') || normalized.includes('plocha')) return 'flat';
  if (normalized.includes('sedlová') || normalized.includes('sedlova')) return 'gable';
  if (normalized.includes('valbová') || normalized.includes('valbova')) return 'hip';
  if (normalized.includes('mansardová') || normalized.includes('mansardova')) return 'mansard';
  if (normalized.includes('stanová') || normalized.includes('stanova')) return 'gambrel';

  return undefined;
}

/**
 * Extract financial value using parser (tax, fees, etc.)
 */
function extractFinancial(parser: SRealityItemsParser, ...fieldNames: any[]): number | undefined {
  for (const field of fieldNames) {
    const value = parser.getString(field);
    if (value) {
      const normalized = value
        .replace(/\s+/g, '')
        .replace(/Kč|CZK/gi, '')
        .replace(/\/rok|\/měsíc|\/month|\/year/gi, '')
        .replace(',', '.')
        .trim();

      const parsed = parseFloat(normalized);
      return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
    }
  }
  return undefined;
}

/**
 * Extract total room count from disposition
 */
function extractRooms(disposition?: string): number | undefined {
  if (!disposition) return undefined;

  const match = disposition.match(/^(\d)\+(\d|kk)/i);
  if (!match) return undefined;

  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1;
  return baseRooms + additional;
}

/**
 * Build features list from amenities using parser
 */
function buildFeaturesList(
  parser: SRealityItemsParser,
  has_garden?: boolean,
  has_garage?: boolean,
  has_parking?: boolean,
  has_pool?: boolean,
  has_fireplace?: boolean,
  has_terrace?: boolean,
  has_attic?: boolean,
  has_basement?: boolean
): string[] {
  const features: string[] = [];

  // House-specific amenities
  if (has_garden) features.push('garden');
  if (has_garage) features.push('garage');
  if (has_parking) features.push('parking');
  if (has_pool) features.push('pool');
  if (has_fireplace) features.push('fireplace');
  if (has_terrace) features.push('terrace');
  if (has_attic) features.push('attic');
  if (has_basement) features.push('basement');

  // Extract furnished status (handles boolean true/false and string "Částečně")
  const furnishedVal = parser.getRaw(FIELD_NAMES.FURNISHED)?.value;
  const furnishedNorm = normalizeFurnished(furnishedVal);
  if (furnishedNorm === 'furnished') features.push('furnished');
  else if (furnishedNorm === 'partially_furnished') features.push('partially_furnished');

  // Extract AC
  if (parser.getBoolean(FIELD_NAMES.KLIMATIZACE)) {
    features.push('air_conditioning');
  }

  // Extract accessibility
  if (parser.getBooleanOr(FIELD_NAMES.BEZBARIEROVY, FIELD_NAMES.BEZBARIEROVA)) {
    features.push('wheelchair_accessible');
  }

  // Extract security features
  if (parser.getBooleanOr(FIELD_NAMES.ALARM, FIELD_NAMES.ZABEZPECOVACI_SYSTEM)) {
    features.push('security_system');
  }

  // Solar panels (common for houses)
  if (parser.getBooleanOr(FIELD_NAMES.SOLARNI_PANELY, FIELD_NAMES.FOTOVOLTAIKA)) {
    features.push('solar_panels');
  }

  return features;
}
