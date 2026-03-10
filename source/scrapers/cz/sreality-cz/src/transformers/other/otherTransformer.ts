import { OtherPropertyTierI } from '@landomo/core';
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
  extractSourceUrl,
  extractSellerInfo
} from '../../utils/srealityHelpers';
import {
  normalizeCondition,
  normalizeConstructionType
} from '../../../../shared/czech-value-mappings';

/**
 * Transform SReality "other" listing (category 5) to OtherPropertyTierI
 *
 * Subcategories:
 * - 34: Garáže (Garages)
 * - 36: Specifický typ (Specific/Misc type)
 * - 52: Garážová stání (Parking spaces)
 * - 53: Mobilheimy (Mobile homes)
 */
export function transformOther(listing: SRealityListing): OtherPropertyTierI {
  const parser = new SRealityItemsParser(listing.items || []);

  const titleString = getStringOrValue(listing.name) || '';

  // Determine subtype from subcategory and title
  const subCategoryId = listing.seo?.category_sub_cb;
  const property_subtype = detectOtherSubtype(subCategoryId, titleString);

  // Area extraction
  const sqm_total = parser.getAreaOr(
    FIELD_NAMES.TOTAL_AREA,
    FIELD_NAMES.LIVING_AREA,
    FIELD_NAMES.LIVING_AREA_TRUNCATED,
    FIELD_NAMES.BUILT_UP_AREA,
    FIELD_NAMES.BUILT_UP_AREA_ALT,
    FIELD_NAMES.AREA
  ) || extractAreaFromTitle(titleString) || 0;

  // Amenities
  const has_electricity = ensureBoolean(
    parser.getBoolean(FIELD_NAMES.ELECTRICITY as any) ||
    isPositiveField(parser.getString(FIELD_NAMES.ELECTRICITY as any))
  );
  const has_parking = ensureBoolean(
    property_subtype === 'garage' || property_subtype === 'parking_space' ||
    parser.getBoolean(FIELD_NAMES.PARKING) ||
    parser.getBoolean(FIELD_NAMES.GARAGE)
  );
  const has_water_connection = parser.getBoolean('Voda' as any) ??
    parser.getBoolean(FIELD_NAMES.WATER as any) ??
    undefined;
  const has_heating = parser.getBoolean(FIELD_NAMES.HEATING as any) ??
    isPositiveField(parser.getString(FIELD_NAMES.HEATING as any)) ??
    undefined;

  // Parking spaces count
  const parkingStr = parser.getString(FIELD_NAMES.PARKING);
  const parking_spaces = parkingStr ? extractNumber(parkingStr) : undefined;

  // Condition
  const conditionRaw = parser.getString(FIELD_NAMES.CONDITION);
  const condition = mapOtherCondition(normalizeCondition(conditionRaw));

  // Construction type
  const constructionRaw = parser.getStringOr(FIELD_NAMES.BUILDING_TYPE, FIELD_NAMES.CONSTRUCTION);
  const construction_type = mapOtherConstructionType(normalizeConstructionType(constructionRaw));

  // Year built
  const year_built = extractYearBuilt(parser);

  // Hash ID
  const hashId = listing.hash_id ?? extractHashIdFromUrl(listing._links?.self?.href);

  // Images
  const images = extractImages(listing);

  // Media URLs
  const virtualTourUrl = extractVirtualTourUrl(listing);
  const videoUrl = extractVideoUrl(listing);

  // Features
  const features = buildFeaturesList(parser, property_subtype, has_electricity, has_water_connection, has_heating);

  // Seller info
  const sellerInfo = extractSellerInfo(listing._embedded);

  return {
    property_category: 'other' as const,

    // Core
    title: titleString || 'Unknown',
    price: listing.price_czk?.value_raw || listing.price || 0,
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

    // Other-specific
    sqm_total,
    has_parking,
    has_electricity,
    parking_spaces,
    has_water_connection: has_water_connection ?? undefined,
    has_heating: has_heating ?? undefined,

    // Building context
    year_built,
    construction_type,
    condition,

    // Media
    media: images.length > 0 ? {
      images: images.map(img => img.preview || img.full || img.thumbnail).filter(Boolean) as string[],
      total_images: listing.advert_images_count
    } : undefined,

    images: images.length > 0 ? images.map(img => img.preview || img.full || img.thumbnail).filter(Boolean) as string[] : undefined,
    videos: videoUrl ? [videoUrl] : undefined,

    agent: sellerInfo?.agent_name ? {
      name: sellerInfo.agent_name,
      phone: sellerInfo.agent_phone,
      email: sellerInfo.agent_email,
      agency: sellerInfo.agent_agency,
      agency_logo: sellerInfo.logo_url,
    } : undefined,

    // Description
    description: listing.text?.value,

    // Features
    features,

    // Tier II: Country-specific
    country_specific: {
      czech: {
        condition: normalizeCondition(conditionRaw),
        construction_type: normalizeConstructionType(constructionRaw)
      }
    },

    // Tier III: Portal metadata
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

        labels: listing.labels,
        new: listing.new,
        region_tip: listing.region_tip,
        exclusively_at_rk: listing.exclusively_at_rk === 1,

        has_floor_plan: listing.has_floor_plan === 1,
        has_video: listing.has_video === 1,
        has_panorama: listing.has_panorama === 1,

        is_auction: listing.is_auction,
        auction_price: listing.is_auction ? listing.auctionPrice : undefined,

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
 * Detect other property subtype from subcategory ID and title
 */
function detectOtherSubtype(
  subCategoryId?: number | string,
  title?: string
): OtherPropertyTierI['property_subtype'] {
  // Primary: subcategory ID (can be number or string from API)
  const subId = typeof subCategoryId === 'string' ? parseInt(subCategoryId) : subCategoryId;
  if (subId === 34) return 'garage';
  if (subId === 52) return 'parking_space';
  if (subId === 53) return 'mobile_home';

  // Fallback: title keywords
  if (title) {
    const lower = title.toLowerCase();
    if (lower.includes('garáž') || lower.includes('garaz')) return 'garage';
    if (lower.includes('stání') || lower.includes('stani') || lower.includes('parking')) return 'parking_space';
    if (lower.includes('mobilheim') || lower.includes('mobilní') || lower.includes('mobilni') || lower.includes('karavan')) return 'mobile_home';
    if (lower.includes('sklad') || lower.includes('storage')) return 'storage';
  }

  return 'other';
}

/**
 * Check if a field string value is positive
 */
function isPositiveField(value?: string): boolean | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('ano') || lower.includes('yes') || lower === '1') return true;
  if (lower.includes('ne') || lower.includes('no') || lower === '0') return false;
  return undefined;
}

/**
 * Extract first number from string
 */
function extractNumber(str: string): number | undefined {
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract year built from parser
 */
function extractYearBuilt(parser: SRealityItemsParser): number | undefined {
  const yearFields = ['Rok postavení', 'Rok výstavby', 'Year built'] as any[];
  for (const field of yearFields) {
    const value = parser.getString(field);
    if (value) {
      const match = value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
      const year = match ? parseInt(match[0]) : undefined;
      if (year && year >= 1800 && year <= 2100) return year;
    }
  }
  return undefined;
}

/**
 * Map condition to OtherPropertyTierI allowed values
 */
function mapOtherCondition(condition?: string): OtherPropertyTierI['condition'] {
  if (!condition) return undefined;
  const mapping: Record<string, OtherPropertyTierI['condition']> = {
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
 * Map construction type to OtherPropertyTierI allowed values
 */
function mapOtherConstructionType(constructionType?: string): OtherPropertyTierI['construction_type'] {
  if (!constructionType) return undefined;
  const mapping: Record<string, OtherPropertyTierI['construction_type']> = {
    'brick': 'brick',
    'concrete': 'concrete',
    'steel': 'steel',
    'prefab': 'prefab',
    'wood': 'wood',
    'panel': 'prefab',
    'mixed': 'concrete',
    'other': undefined,
    'stone': 'brick'
  };
  return mapping[constructionType];
}

/**
 * Build features list for other properties
 */
function buildFeaturesList(
  parser: SRealityItemsParser,
  subtype?: string,
  has_electricity?: boolean,
  has_water?: boolean | null,
  has_heating?: boolean | null
): string[] {
  const features: string[] = [];

  if (subtype) features.push(subtype);
  if (has_electricity) features.push('electricity');
  if (has_water) features.push('water_connection');
  if (has_heating) features.push('heating');

  // Garage-specific features
  if (parser.getBoolean('Automatická vrata' as any)) {
    features.push('automatic_door');
  }
  if (parser.getBoolean('Montážní jáma' as any) || parser.getBoolean('Jáma' as any)) {
    features.push('pit');
  }

  // Security
  const security = parser.getStringOr('Zabezpečení' as any, 'Security' as any, 'Alarm' as any);
  if (security) {
    const lower = security.toLowerCase();
    if (lower.includes('alarm')) features.push('alarm');
    if (lower.includes('kamer') || lower.includes('camera')) features.push('camera');
  }

  return features;
}
