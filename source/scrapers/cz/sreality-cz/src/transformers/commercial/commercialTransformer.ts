import { CommercialPropertyTierI, PropertyImage } from '@landomo/core';
import { SRealityListing } from '../../types/srealityTypes';
import { SRealityItemsParser, FIELD_NAMES } from '../../utils/itemsParser';
import {
  getStringOrValue,
  extractCity,
  ensureBoolean,
  extractImages,
  extractVirtualTourUrl,
  extractVideoUrl,
  extractHashIdFromUrl,
  extractAreaFromTitle,
  extractFloorInfo,
  extractSourceUrl,
  extractCommissionInfo,
  extractSellerInfo,
  parseAvailableFrom,
} from '../../utils/srealityHelpers';
import {
  normalizeCondition,
  normalizeHeatingType,
  normalizeEnergyRating,
  normalizeConstructionType,
  normalizeFurnished
} from '../../../../shared/czech-value-mappings';

/**
 * Transform SReality commercial listing to CommercialPropertyTierI
 *
 * Commercial-specific fields:
 * - sqm_total (CRITICAL - required field)
 * - property_subtype (office, retail, warehouse, etc.)
 * - has_elevator, has_parking, has_bathrooms
 * - ceiling_height (for warehouses/industrial)
 * - parking_spaces, office_rooms
 */
export function transformCommercial(listing: SRealityListing): CommercialPropertyTierI {
  // Initialize type-safe parser (single O(n) pass)
  const parser = new SRealityItemsParser(listing.items || []);

  // Extract title
  const titleString = getStringOrValue(listing.name) || '';

  // Extract floor info
  const floorInfo = extractFloorInfo(parser.getString(FIELD_NAMES.FLOOR));

  // Extract amenities using parser (ensures boolean, never undefined)
  const has_elevator = ensureBoolean(parser.getBoolean(FIELD_NAMES.ELEVATOR));
  const has_parking = ensureBoolean(parser.getBooleanOr(FIELD_NAMES.PARKING, FIELD_NAMES.GARAGE));
  // Extract bathrooms — check parser for bathroom fields, default to undefined if unknown
  const bathroomFields = ['Počet koupelen', 'Koupelen', 'Koupelna'] as any[];
  let has_bathrooms = false;
  for (const field of bathroomFields) {
    if (parser.getBoolean(field)) {
      has_bathrooms = true;
      break;
    }
  }
  // If no explicit bathroom field, leave unknown — but type requires boolean
  // Check WC field as well
  if (!has_bathrooms) {
    has_bathrooms = parser.getBoolean('WC' as any);
  }

  // Extract areas - commercial properties use various area field names
  // Priority: TOTAL_AREA > LIVING_AREA > BUILT_UP_AREA > title extraction
  const sqm_total = parser.getAreaOr(
    FIELD_NAMES.TOTAL_AREA,
    FIELD_NAMES.LIVING_AREA,
    FIELD_NAMES.LIVING_AREA_TRUNCATED,
    FIELD_NAMES.BUILT_UP_AREA,
    FIELD_NAMES.BUILT_UP_AREA_ALT,
    FIELD_NAMES.AREA
  ) ?? extractAreaFromTitle(titleString);

  const sqm_usable = parser.getArea(FIELD_NAMES.LIVING_AREA) || parser.getArea(FIELD_NAMES.LIVING_AREA_TRUNCATED);
  const sqm_plot = parser.getArea(FIELD_NAMES.PLOT_AREA);

  // Determine property subtype from title or commercial type field
  const commercialType = parser.getString(FIELD_NAMES.COMMERCIAL_TYPE);
  const commercialSubtype = parser.getString(FIELD_NAMES.COMMERCIAL_SUBTYPE);
  const property_subtype = detectCommercialSubtype(titleString, commercialType, commercialSubtype);

  // Extract parking count if available
  const parkingStr = parser.getString(FIELD_NAMES.PARKING);
  const parking_spaces = parkingStr ? extractNumberFromString(parkingStr) : undefined;

  // Extract city from locality field (extractCity expects a string parameter)
  const localityString = getStringOrValue(listing.locality) || '';
  const city = extractCity(localityString);

  // Determine transaction type from title or price field
  const transaction_type = detectTransactionType(listing, titleString);

  // Extract additional details
  const condition = parser.getString(FIELD_NAMES.CONDITION);
  const heating = parser.getString(FIELD_NAMES.HEATING) ||
                  parser.getString(FIELD_NAMES.HEATING_ALT) ||
                  parser.getString(FIELD_NAMES.HEATING_EN);
  // === B. Energy class — use item.value_type (letter A-G) directly ===
  const energyItem = (listing.items || []).find((i: any) => i.type === 'energy_efficiency_rating');
  const energy_rating: string | undefined = energyItem?.value_type
    || parser.getStringOr(FIELD_NAMES.ENERGY_CLASS, FIELD_NAMES.ENERGY_RATING);
  const construction_type = parser.getString(FIELD_NAMES.BUILDING_TYPE) ||
                           parser.getString(FIELD_NAMES.CONSTRUCTION);

  // === F. Seller contact — from _embedded.seller (detail API) ===
  const sellerInfo = extractSellerInfo(listing._embedded);

  // Cache images (called twice below)
  const images = extractImages(listing);

  // Extract hash_id from URL or use listing.hash_id
  const hash_id = extractHashIdFromUrl(listing._links?.self?.href) || listing.hash_id;
  const portal_id = hash_id ? `sreality-${hash_id}` : `sreality-${Date.now()}`;

  // Property type from category_sub_cb
  const property_type = mapCommercialPropertyType(typeof listing.seo?.category_sub_cb === 'number' ? listing.seo.category_sub_cb : undefined);

  // Build the commercial property object
  const commercial: CommercialPropertyTierI = {
    // Category
    property_category: 'commercial',
    property_subtype: property_type as CommercialPropertyTierI['property_subtype'],

    // Core fields
    title: titleString,
    price: listing.price_czk?.value_raw ?? listing.price as number,
    currency: 'CZK',
    transaction_type,

    // Location
    location: {
      city: city || 'Unknown',
      country: 'cz',
      coordinates: (listing.gps?.lat && listing.gps?.lon) ? {
        lat: listing.gps.lat,
        lon: listing.gps.lon
      } : (listing.map?.lat && listing.map?.lon) ? {
        lat: listing.map.lat,
        lon: listing.map.lon
      } : undefined
    },

    // Commercial-specific metrics
    sqm_total: sqm_total as number,
    sqm_usable,
    sqm_plot,
    floor: floorInfo.floor,
    total_floors: floorInfo.total_floors,

    // Financials
    price_per_sqm: (listing.price_czk?.value_raw || listing.price) && sqm_total
      ? Math.round((listing.price_czk?.value_raw ?? listing.price ?? 0) / sqm_total)
      : undefined,
    ...extractCommissionInfo(listing.price_czk?.name),

    // Amenities (required booleans)
    has_elevator,
    has_parking,
    has_bathrooms,
    parking_spaces,

    // Building context
    year_built: extractYearBuilt(parser),

    // Additional amenities (optional)
    has_air_conditioning: parser.getBoolean(FIELD_NAMES.KLIMATIZACE),
    has_security_system: undefined,
    has_reception: undefined,
    has_kitchen: undefined,

    // Lease & Availability
    available_from: parseAvailableFrom(parser.getStringOr(FIELD_NAMES.AVAILABLE_FROM_ALT, FIELD_NAMES.AVAILABLE_FROM)),

    // Tier 1 Universal Fields
    furnished: normalizeFurnished(parser.getRaw(FIELD_NAMES.FURNISHED)?.value),
    renovation_year: extractRenovationYear(parser),
    published_date: parser.getString(FIELD_NAMES.AKTUALIZACE),

    // Ceiling height (important for warehouses/industrial)
    ceiling_height: parser.getNumberOr(FIELD_NAMES.VYSKA_STROPU, FIELD_NAMES.VYSKA_MISTNOSTI),

    // Building characteristics
    condition: condition ? mapCommercialCondition(normalizeCondition(condition)) : undefined,
    heating_type: heating ? normalizeHeatingType(heating) : undefined,
    energy_class: energy_rating ? normalizeEnergyRating(energy_rating) : undefined,
    construction_type: construction_type ? mapCommercialConstructionType(normalizeConstructionType(construction_type)) : undefined,

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

    // Description
    description: listing.text?.value,

    // Images and media (using cached images)
    images: images.map(img => img.preview || img.full || img.thumbnail).filter(Boolean) as string[],
    media: (() => {
      const vtUrl = extractVirtualTourUrl(listing);
      return {
        images: images.map((img, i): PropertyImage => ({
          url: img.full || img.preview || img.thumbnail || '',
          thumbnail_url: img.thumbnail,
          order: i,
          ...(i === 0 ? { is_main: true } : {}),
        })).filter(img => img.url),
        total_images: listing.advert_images_count,
        virtual_tour_url: vtUrl && vtUrl !== 'available' ? vtUrl : undefined,
        video_tour_url: extractVideoUrl(listing),
      };
    })(),

    // Source tracking
    source_url: extractSourceUrl(listing, hash_id),
    source_platform: 'sreality',
    portal_id,
    status: 'active' as const,

    // Tier III: Portal metadata
    portal_metadata: {
      sreality: {
        hash_id: hash_id || 0,
        category_main_cb: 4, // Commercial
        category_sub_cb: listing.seo?.category_sub_cb,
        category_type_cb: transaction_type === 'sale' ? 1 : transaction_type === 'rent' ? 2 : 3,
        has_floor_plan: listing.has_floor_plan === 1,
        has_video: listing.has_video === 1,
        has_panorama: listing.has_panorama === 1,
        labels: listing.labels || [],
        is_auction: listing.is_auction || false,
        auction_price: listing.auctionPrice,
        advert_images_count: listing.advert_images_count,
        exclusively_at_rk: listing.exclusively_at_rk || false,
        price_czk: listing.price_czk,
        price_note: listing.price_note,
        name: listing.name,
        locality: listing.locality
      }
    }
  };

  return commercial;
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
 * Detect commercial property subtype from title and metadata
 */
function detectCommercialSubtype(
  title: string,
  commercialType?: string,
  commercialSubtype?: string
): CommercialPropertyTierI['property_subtype'] {
  const titleLower = title.toLowerCase();
  const typeLower = (commercialType || '').toLowerCase();
  const subtypeLower = (commercialSubtype || '').toLowerCase();
  const combined = `${titleLower} ${typeLower} ${subtypeLower}`;

  // Office
  if (combined.match(/kancelář|kanceláře|office|administrativní/i)) {
    return 'office';
  }

  // Retail
  if (combined.match(/obchod|prodejna|retail|shop|butik/i)) {
    return 'retail';
  }

  // Warehouse
  if (combined.match(/sklad|warehouse|storage|hala/i)) {
    return 'warehouse';
  }

  // Industrial
  if (combined.match(/průmysl|výrob|industrial|továrn/i)) {
    return 'industrial';
  }

  // Hotel
  if (combined.match(/hotel|penzion|ubytování/i)) {
    return 'hotel';
  }

  // Restaurant
  if (combined.match(/restaurace|hostinec|kavárna|bistro|restaurant|café/i)) {
    return 'restaurant';
  }

  // Medical
  if (combined.match(/ordinace|lékařsk|medical|zdravotn/i)) {
    return 'medical';
  }

  // Showroom
  if (combined.match(/showroom|výstavní|prodejní plocha/i)) {
    return 'showroom';
  }

  // Mixed use
  if (combined.match(/polyfunkční|mixed|kombinovan/i)) {
    return 'mixed_use';
  }

  // Default - try to infer from most common patterns
  if (titleLower.includes('prostor')) {
    return 'office'; // Generic "space" often means office
  }

  return undefined; // Unable to determine
}

/**
 * Detect transaction type (sale vs rent) from listing data
 */
function detectTransactionType(
  listing: SRealityListing,
  title: string
): 'sale' | 'rent' | 'auction' {
  const titleLower = title.toLowerCase();

  // Check category_type_cb first (most reliable)
  const categoryType = listing.seo?.category_type_cb;
  if (categoryType === 1 || categoryType === '1' as any) {
    return 'sale';
  }
  if (categoryType === 2 || categoryType === '2' as any) {
    return 'rent';
  }
  if (categoryType === 3 || categoryType === '3' as any) {
    return 'auction';
  }

  // Fallback to title detection
  if (titleLower.includes('pronájem') || titleLower.includes('nájem')) {
    return 'rent';
  }
  if (titleLower.includes('dražb')) {
    return 'auction';
  }
  if (titleLower.includes('prodej')) {
    return 'sale';
  }

  // Default to sale if unclear
  return 'sale';
}

/**
 * Extract numeric value from string (e.g., "2 parking spaces" -> 2)
 */
function extractNumberFromString(str: string): number | undefined {
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Map condition values to commercial property allowed values
 */
function mapCommercialCondition(condition: string | undefined): 'new' | 'excellent' | 'good' | 'fair' | 'requires_renovation' | undefined {
  if (!condition) return undefined;

  const mapping: Record<string, 'new' | 'excellent' | 'good' | 'fair' | 'requires_renovation'> = {
    'new': 'new',
    'excellent': 'excellent',
    'very_good': 'excellent',
    'good': 'good',
    'after_renovation': 'good',
    'before_renovation': 'fair',
    'requires_renovation': 'requires_renovation',
    'project': 'new',
    'under_construction': 'new'
  };

  return mapping[condition];
}

/**
 * Map construction type to commercial property allowed values
 */
/**
 * Map SReality category_sub_cb to property_type for commercial
 */
function mapCommercialPropertyType(categorySubCb?: number): string | undefined {
  if (categorySubCb === undefined || categorySubCb === null) return undefined;

  const map: Record<number, string> = {
    25: 'office',
    26: 'warehouse',
    27: 'production',
    28: 'retail',
    29: 'accommodation',
    30: 'restaurant',
    31: 'agricultural',
    32: 'commercial_other',
    38: 'apartment_building',
    49: 'virtual_office',
    56: 'medical_office',
    57: 'other',
  };

  return map[categorySubCb] || 'other';
}

function mapCommercialConstructionType(constructionType: string | undefined): 'brick' | 'concrete' | 'steel' | 'mixed' | 'prefab' | undefined {
  if (!constructionType) return undefined;

  const mapping: Record<string, 'brick' | 'concrete' | 'steel' | 'mixed' | 'prefab'> = {
    'brick': 'brick',
    'concrete': 'concrete',
    'steel': 'steel',
    'mixed': 'mixed',
    'prefab': 'prefab',
    'other': 'mixed',
    'panel': 'prefab',
    'stone': 'brick',
    'wood': 'mixed'
  };

  return mapping[constructionType];
}
