import { ApartmentPropertyTierI, PropertyImage } from '@landomo/core';
import { SRealityListing } from '../../types/srealityTypes';
import { SRealityItemsParser, FIELD_NAMES } from '../../utils/itemsParser';
import {
  bedroomsFromDisposition,
  extractDispositionFromTitle,
  extractFloorInfo,
  getStringOrValue,
  extractCity,
  mapOwnership,
  ensureBoolean,
  extractImages,
  extractVirtualTourUrl,
  extractVideoUrl,
  extractHashIdFromUrl,
  extractAreaFromTitle,
  extractSourceUrl,
  extractSellerInfo,
  extractLabelsFeatures,
  extractCommissionInfo,
  parseAvailableFrom,
  DISPOSITION_CODES,
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
 * Transform SReality apartment listing to ApartmentPropertyTierI
 *
 * Apartment-specific fields:
 * - czech_disposition (2+kk, 3+1) → Tier II
 * - floor, total_floors
 * - has_elevator, has_balcony, has_basement
 * - panel/brick building type
 */
export function transformApartment(listing: SRealityListing): ApartmentPropertyTierI {
  // Initialize type-safe parser (single O(n) pass)
  const parser = new SRealityItemsParser(listing.items || []);

  // === A. Disposition — codeItems/seo.category_sub_cb FIRST, title as fallback ===
  const titleString = getStringOrValue(listing.name) || '';
  const categorySub = listing.seo?.category_sub_cb;
  const disposition = (typeof categorySub === 'number' ? DISPOSITION_CODES[categorySub] : undefined)
    || extractDispositionFromTitle(titleString)
    || parser.getString(FIELD_NAMES.DISPOSITION);
  const floorInfo = extractFloorInfo(parser.getString(FIELD_NAMES.FLOOR));

  // === G. labelsAll[0] features — supplement items[] booleans ===
  const labels = extractLabelsFeatures(listing.labelsAll);

  // Extract amenities: items[] parser OR labelsAll tags (whichever is true wins)
  const has_elevator = ensureBoolean(parser.getBoolean(FIELD_NAMES.ELEVATOR) || labels.has_elevator);
  const has_balcony = ensureBoolean(parser.getBooleanOr(FIELD_NAMES.BALCONY, FIELD_NAMES.BALCONY_ALT) || labels.has_balcony);
  const has_loggia = ensureBoolean(parser.getBoolean(FIELD_NAMES.LOGGIA) || labels.has_loggia);
  const has_basement = ensureBoolean(parser.getBooleanOr(FIELD_NAMES.CELLAR, FIELD_NAMES.BASEMENT) || labels.has_basement);
  const has_parking = ensureBoolean(parser.getBoolean(FIELD_NAMES.PARKING) || labels.has_parking);
  const has_terrace = ensureBoolean(parser.getBoolean(FIELD_NAMES.TERRACE) || labels.has_terrace);
  const has_garage = ensureBoolean(parser.getBoolean(FIELD_NAMES.GARAGE) || labels.has_garage);

  // Extract areas using parser
  const sqm = parser.getAreaOr(FIELD_NAMES.LIVING_AREA, FIELD_NAMES.LIVING_AREA_TRUNCATED, FIELD_NAMES.TOTAL_AREA, FIELD_NAMES.AREA) ?? extractAreaFromTitle(titleString);
  const balcony_area = parser.getAreaOr(FIELD_NAMES.BALCONY, FIELD_NAMES.BALCONY_ALT);
  const loggia_area = parser.getArea(FIELD_NAMES.LOGGIA);
  const cellar_area = parser.getArea(FIELD_NAMES.CELLAR);
  const terrace_area = parser.getArea(FIELD_NAMES.TERRACE);

  // Extract bedrooms from disposition
  const bedrooms = bedroomsFromDisposition(disposition);

  // Extract bathrooms
  const bathrooms = extractBathrooms(parser);

  // Extract total floors in building
  const total_floors = floorInfo.total_floors || extractTotalFloors(parser);

  // === D. Construction type — codeItems.building_type_search FIRST, items[] text fallback ===
  const buildingTypeCode = listing.codeItems?.building_type_search;
  const buildingTypeRaw = parser.getStringOr(FIELD_NAMES.BUILDING_TYPE, FIELD_NAMES.CONSTRUCTION);
  const construction_type = (
    (typeof buildingTypeCode === 'number' ? BUILDING_TYPE_CODES[buildingTypeCode] : undefined)
    || mapBuildingType(buildingTypeRaw)
  ) as 'panel' | 'brick' | 'concrete' | 'mixed' | undefined;

  // Extract condition — labelsAll 'new_building' tag supplements items[] text
  const conditionRaw = parser.getString(FIELD_NAMES.CONDITION);
  const condition = mapCondition(conditionRaw) || labels.condition;

  // Extract year built
  const year_built = extractYearBuilt(parser);

  // === C. Ownership — codeItems.ownership numeric code FIRST, items[] text fallback ===
  const ownershipCode = listing.codeItems?.ownership;
  const ownershipRaw = parser.getString(FIELD_NAMES.OWNERSHIP);
  const ownership: 'personal' | 'cooperative' | 'state' | 'municipal' | undefined =
    (typeof ownershipCode === 'number' ? OWNERSHIP_CODES[ownershipCode] : undefined)
    || mapOwnership(ownershipRaw)
    || labels.ownership;

  // Extract heating type
  const heating_type = parser.getStringOr(FIELD_NAMES.HEATING, FIELD_NAMES.HEATING_ALT, FIELD_NAMES.HEATING_EN);

  // === B. Energy class — use item.value_type (letter A-G) directly ===
  // item.value_type is already the letter; avoid parsing the verbose text string
  const energyItem = (listing.items || []).find((i: any) => i.type === 'energy_efficiency_rating');
  const energy_class: string | undefined = energyItem?.value_type
    || parser.getStringOr(FIELD_NAMES.ENERGY_CLASS, FIELD_NAMES.ENERGY_RATING);

  // Determine floor location
  const floor_location = determineFloorLocation(floorInfo.floor, total_floors);

  // Extract rooms count
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
    property_category: 'apartment' as const,

    // === Tier I: Core Identification ===
    title: getStringOrValue(listing.name) || 'Unknown',
    price: listing.price_czk?.value_raw ?? listing.price as number,
    currency: 'CZK',
    // category_type_cb: 1=sale, 2=rent, 3=auction
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
    property_subtype: detectApartmentSubtype(titleString),

    // Apartment-specific details
    bedrooms: bedrooms as number,
    bathrooms: bathrooms ?? 1,
    sqm: sqm as number,
    floor: floorInfo.floor,
    total_floors,
    rooms,

    // Apartment amenities
    has_elevator,
    has_balcony,
    balcony_area,
    has_parking,
    has_basement,
    cellar_area,
    has_loggia,
    loggia_area,
    has_terrace,
    terrace_area,
    has_garage,

    // Building context
    year_built,
    construction_type,
    condition,
    heating_type: normalizeHeatingType(heating_type) || undefined,
    energy_class,
    floor_location,

    // === FINANCIALS ===
    hoa_fees: extractFinancial(parser, FIELD_NAMES.HOA_FEES),
    deposit: extractFinancial(parser, FIELD_NAMES.DEPOSIT),
    utility_charges: extractFinancial(parser, FIELD_NAMES.UTILITY_CHARGES),
    service_charges: extractFinancial(parser, FIELD_NAMES.SERVICE_CHARGES),
    ...extractCommissionInfo(listing.price_czk?.name),

    // Rental-Specific Fields
    available_from: parseAvailableFrom(parser.getStringOr(FIELD_NAMES.AVAILABLE_FROM, FIELD_NAMES.AVAILABLE_FROM_ALT)),

    // Tier 1 Universal Fields
    furnished,
    renovation_year: extractRenovationYear(parser),
    published_date: parser.getString(FIELD_NAMES.AKTUALIZACE),

    // === F. Seller contact (from _embedded.seller detail API fields) ===
    ...(sellerInfo ? {
      agent_name: sellerInfo.agent_name,
      agent_phone: sellerInfo.agent_phone,
      agent_email: sellerInfo.agent_email,
      agent_agency: sellerInfo.agent_agency,
    } : {}),

    agent: sellerInfo?.agent_name ? {
      name: sellerInfo.agent_name,
      phone: sellerInfo.agent_phone,
      email: sellerInfo.agent_email,
      agency: sellerInfo.agent_agency,
      agency_logo: sellerInfo.logo_url,
    } : undefined,

    // Media & Agent (enhanced with multiple sizes)
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

    // Description
    description: listing.text?.value,

    // Features array (apartment-specific features as strings)
    features: buildFeaturesList(parser, has_balcony, has_loggia, has_terrace, has_elevator, has_parking),

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

        // Marketing flags (newly documented)
        labels: listing.labels,
        new: listing.new,
        region_tip: listing.region_tip,
        exclusively_at_rk: listing.exclusively_at_rk === 1,

        // Media flags (newly documented)
        has_floor_plan: listing.has_floor_plan === 1,
        has_video: listing.has_video === 1,
        has_panorama: listing.has_panorama === 1,

        // Auction fields (newly documented)
        is_auction: listing.is_auction,
        auction_price: listing.is_auction ? listing.auctionPrice : undefined,

        // Media URLs (newly documented)
        virtual_tour_url: virtualTourUrl && virtualTourUrl !== 'available' ? virtualTourUrl : undefined,
        video_url: videoUrl
      }
    },

    // Portal & Lifecycle
    source_url: extractSourceUrl(listing, hashId),
    source_platform: 'sreality',
    portal_id: `sreality-${hashId}`,
    status: 'active'
  };
}

/**
 * Extract bathroom count using parser
 */
function extractBathrooms(parser: SRealityItemsParser): number | undefined {
  // Try common bathroom field names
  const bathroomFields = ['Počet koupelen', 'Koupelen', 'Bathrooms', 'Koupelna'] as any[];

  for (const field of bathroomFields) {
    const value = parser.getString(field);
    if (value) {
      // Extract first number from "2 koupelny", "2x Koupelna", etc.
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
 * Extract total floors in building using parser
 */
function extractTotalFloors(parser: SRealityItemsParser): number | undefined {
  const value = parser.getStringOr(FIELD_NAMES.TOTAL_FLOORS, FIELD_NAMES.FLOOR_COUNT, FIELD_NAMES.FLOORS_IN_BUILDING);
  if (!value) return undefined;

  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
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
 * Extract year built using parser
 *
 * SReality API primarily uses 'Rok kolaudace' (occupancy certificate year) rather
 * than 'Rok postavení' or 'Rok výstavby'. All three are checked for completeness.
 * 'Rok kolaudace' is a numeric item (integer), so getNumber() is preferred but
 * getString() with regex fallback handles both.
 */
function extractYearBuilt(parser: SRealityItemsParser): number | undefined {
  const yearFields = [
    FIELD_NAMES.YEAR_COMPLETED,   // 'Rok kolaudace' — primary field the API actually returns
    FIELD_NAMES.YEAR_BUILT,        // 'Rok postavení'
    FIELD_NAMES.YEAR_BUILT_ALT,    // 'Rok výstavby'
  ];

  for (const field of yearFields) {
    // Try direct numeric value first (Rok kolaudace is type=integer)
    const numericValue = parser.getNumber(field);
    if (numericValue && numericValue >= 1800 && numericValue <= 2100) {
      return numericValue;
    }

    // Fall back to string parsing for text-format values
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
 * Map Czech building type to construction_type enum
 */
function mapBuildingType(raw?: string): 'panel' | 'brick' | 'concrete' | 'mixed' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (normalized.includes('panel')) return 'panel';
  if (normalized.includes('cihla') || normalized.includes('cihl')) return 'brick';
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
 * Determine floor location classification
 */
function determineFloorLocation(floor?: number, total_floors?: number): 'ground_floor' | 'middle_floor' | 'top_floor' | undefined {
  if (floor === undefined) return undefined;

  if (floor === 0) return 'ground_floor';

  if (total_floors !== undefined) {
    if (floor === total_floors || floor === total_floors - 1) return 'top_floor';
    return 'middle_floor';
  }

  // If total floors unknown, assume middle floor for floor > 0
  return 'middle_floor';
}

/**
 * Extract total room count from disposition
 */
function extractRooms(disposition?: string): number | undefined {
  if (!disposition) return undefined;

  // Extract total from "2+kk" = 2 rooms + kitchenette = 2 total
  // Extract total from "3+1" = 3 rooms + kitchen = 4 total
  const match = disposition.match(/^(\d)\+(\d|kk)/i);
  if (!match) return undefined;

  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1; // +kk = kitchenette (part of room), +1 = separate kitchen
  return baseRooms + additional;
}

/**
 * Build features list from amenities using parser
 */
function buildFeaturesList(
  parser: SRealityItemsParser,
  has_balcony?: boolean,
  has_loggia?: boolean,
  has_terrace?: boolean,
  has_elevator?: boolean,
  has_parking?: boolean
): string[] {
  const features: string[] = [];

  if (has_balcony) features.push('balcony');
  if (has_loggia) features.push('loggia');
  if (has_terrace) features.push('terrace');
  if (has_elevator) features.push('elevator');
  if (has_parking) features.push('parking');

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

  return features;
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
 * Detect apartment subtype from title string
 * SReality titles often contain Czech subtype keywords
 */
function detectApartmentSubtype(title: string): ApartmentPropertyTierI['property_subtype'] {
  const lower = title.toLowerCase();

  if (lower.includes('mezonet') || lower.includes('maisonette')) return 'maisonette';
  if (lower.includes('penthouse')) return 'penthouse';
  if (lower.includes('loft')) return 'loft';
  if (lower.includes('ateliér') || lower.includes('atelier')) return 'atelier';
  if (lower.includes('garsoniéra') || lower.includes('garsoniera') || lower.includes('garsoni')) return 'studio';

  return undefined;
}
