import { StandardProperty, AustrianSpecificFields, WillhabenATPortalMetadata } from '@landomo/core';
import { WillhabenListing, getAttribute, getAttributes } from '../types/willhabenTypes';

/**
 * Transform Willhaben listing to StandardProperty format
 */
export function transformWillhabenToStandard(listing: WillhabenListing): StandardProperty & Record<string, any> {
  const price = parsePrice(getAttribute(listing, 'PRICE'));
  const sqm = parseNumber(getAttribute(listing, 'ESTATE_SIZE/LIVING_AREA') || getAttribute(listing, 'ESTATE_SIZE'));
  const propertyType = getAttribute(listing, 'PROPERTY_TYPE');
  const propertyTypeId = getAttribute(listing, 'PROPERTY_TYPE_ID');

  const mappedType = mapPropertyType(propertyTypeId);

  return {
    // Category (required for ingest)
    property_category: mapPropertyCategory(mappedType),

    // Basic info
    title: getAttribute(listing, 'HEADING') || listing.description || 'Unknown',
    price: price || 0,
    currency: 'EUR',
    property_type: mappedType,
    transaction_type: mapTransactionType(getAttribute(listing, 'ADTYPE_ID')),
    source_url: `https://www.willhaben.at/iad/${getAttribute(listing, 'SEO_URL') || `immobilien/d/${listing.id}`}`,
    source_platform: 'willhaben',

    // Location
    location: {
      address: getAttribute(listing, 'ADDRESS'),
      city: extractCity(getAttribute(listing, 'LOCATION') || ''),
      region: getAttribute(listing, 'STATE') || getAttribute(listing, 'DISTRICT'),
      postal_code: getAttribute(listing, 'POSTCODE'),
      country: 'Austria',
      coordinates: parseCoordinates(getAttribute(listing, 'COORDINATES'))
    },

    // Details
    details: {
      bedrooms: parseNumber(getAttribute(listing, 'NUMBER_OF_ROOMS')),
      bathrooms: 1, // Willhaben doesn't typically provide bathroom count separately
      sqm: sqm,
      floor: parseNumber(getAttribute(listing, 'FLOOR')),
      rooms: parseNumber(getAttribute(listing, 'NUMBER_OF_ROOMS')),
      renovation_year: parseNumber(getAttribute(listing, 'RENOVATION_YEAR')),
      parking_spaces: countParkingSpaces(listing)
    },

    // Financial details
    price_per_sqm: price && sqm ? Math.round(price / sqm) : undefined,

    // Universal Tier 1 fields (also in country_specific for backward compat)
    condition: normalizeCondition(getAttribute(listing, 'CONDITION')),
    heating_type: normalizeHeatingType(getAttribute(listing, 'HEATING_TYPE')),
    furnished: normalizeFurnished(getAttribute(listing, 'FURNISHED')),
    construction_type: undefined, // not available from willhaben
    available_from: undefined, // not available from willhaben
    published_date: parsePublishedDate(getAttribute(listing, 'PUBLISHED'), getAttribute(listing, 'PUBLISHED_String')),
    deposit: parseNumber(getAttribute(listing, 'DEPOSIT')),
    parking_spaces: countParkingSpaces(listing),

    // Portal metadata (Willhaben-specific fields)
    portal_metadata: {
      willhaben: {
        id: listing.id,
        vertical_id: listing.verticalId?.toString(),
        ad_type_id: listing.adTypeId?.toString(),
        product_id: listing.productId?.toString(),
        advert_status: listing.advertStatus,
        org_id: getAttribute(listing, 'ORGID'),
        org_uuid: getAttribute(listing, 'ORG_UUID'),
        ad_uuid: getAttribute(listing, 'AD_UUID'),
        location_id: getAttribute(listing, 'LOCATION_ID'),
        location_quality: getAttribute(listing, 'LOCATION_QUALITY'),
        is_private: getAttribute(listing, 'ISPRIVATE') === '1',
        is_bumped: getAttribute(listing, 'IS_BUMPED') === '1',
        published: getAttribute(listing, 'PUBLISHED'),
        published_string: getAttribute(listing, 'PUBLISHED_String'),
        price_for_display: getAttribute(listing, 'PRICE_FOR_DISPLAY'),
        estate_preference: getAttributes(listing, 'ESTATE_PREFERENCE'),
        category_tree_ids: getAttributes(listing, 'categorytreeids'),
        seo_url: getAttribute(listing, 'SEO_URL'),
        property_type_id: getAttribute(listing, 'PROPERTY_TYPE_ID'),
        category_id: getAttribute(listing, 'CATEGORY_ID')
      } as WillhabenATPortalMetadata
    },

    // Top-level Austrian DB columns (read by bulk-operations.ts as prop.data.austrian_*)
    austrian_ownership: normalizeOwnershipType(getAttribute(listing, 'OWNERSHIP_TYPE')),
    austrian_operating_costs: parseNumber(getAttribute(listing, 'OPERATING_COSTS')),
    austrian_heating_costs: parseNumber(getAttribute(listing, 'HEATING_COSTS')),

    // Country-specific fields (Austria)
    country_specific: {
      // Condition
      condition: normalizeCondition(getAttribute(listing, 'CONDITION')),

      // Furnished
      furnished: normalizeFurnished(getAttribute(listing, 'FURNISHED')),

      // Energy rating (standardized)
      energy_rating: normalizeEnergyRating(getAttribute(listing, 'ENERGY_RATING')),

      // Heating type
      heating_type: normalizeHeatingType(getAttribute(listing, 'HEATING_TYPE')),

      // Ownership
      ownership_type: normalizeOwnershipType(getAttribute(listing, 'OWNERSHIP_TYPE')),

      // Building details
      year_built: parseNumber(getAttribute(listing, 'CONSTRUCTION_YEAR')),

      // Cost breakdown
      operating_costs: parseNumber(getAttribute(listing, 'OPERATING_COSTS')),
      heating_costs: parseNumber(getAttribute(listing, 'HEATING_COSTS')),

      // Areas
      area_living: parseNumber(getAttribute(listing, 'ESTATE_SIZE/LIVING_AREA')),
      area_total: parseNumber(getAttribute(listing, 'ESTATE_SIZE')),
      area_plot: parseNumber(getAttribute(listing, 'PLOT_AREA')),

      // Floor information
      total_floors: extractTotalFloors(getAttribute(listing, 'FLOOR')),

      // Additional Austrian-specific fields
      accessible: getAttribute(listing, 'BARRIER_FREE') === '1',
      pets_allowed: getAttribute(listing, 'PETS_ALLOWED') === '1'
    } as AustrianSpecificFields,

    // Amenities - extracted from attributes
    amenities: extractAmenitiesFromAttributes(listing),

    // Media (enhanced)
    media: {
      images: extractImageUrls(listing.advertImageList?.advertImage || []),
      total_images: listing.advertImageList?.advertImage?.length || 0,
      floor_plan_urls: extractFloorPlanUrls(listing.advertImageList?.floorPlans || [])
    },

    // Backward compatibility
    images: extractImageUrls(listing.advertImageList?.advertImage || []),
    description: getAttribute(listing, 'BODY_DYN') || listing.description,
    description_language: 'de',

    // Status
    status: listing.advertStatus?.id === 'active' ? 'active' : 'removed'
  } as any;
}

/**
 * Map standard property type to property_category for DB partitioning
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (propertyType) {
    case 'apartment': return 'apartment';
    case 'house': return 'house';
    case 'land': return 'land';
    case 'commercial': return 'commercial';
    case 'garage': return 'commercial';
    default: return 'apartment';
  }
}

/**
 * Map Willhaben property type ID to standard property type
 */
function mapPropertyType(propertyTypeId?: string): string {
  if (!propertyTypeId) return 'other';

  const typeMap: Record<string, string> = {
    '3': 'apartment',      // Wohnung
    '4': 'house',          // Haus
    '5': 'land',           // Grundstück
    '6': 'commercial',     // Gewerbe
    '7': 'garage',         // Garage/Stellplatz
    '8': 'other'           // Sonstiges
  };

  return typeMap[propertyTypeId] || 'other';
}

/**
 * Map Willhaben ad type ID to transaction type
 */
function mapTransactionType(adTypeId?: string): 'sale' | 'rent' {
  // 1 = Verkauf (sale), 2 = Miete (rent)
  return adTypeId === '1' ? 'sale' : 'rent';
}

/**
 * Extract city from location string
 * Example: "Wien, 19. Bezirk, Döbling" → "Wien"
 */
function extractCity(location: string): string {
  if (!location) return 'Unknown';

  // Extract city from "Wien, 19. Bezirk, Döbling" → "Wien"
  const cityMatch = location.split(',')[0];
  return cityMatch ? cityMatch.trim() : location;
}

/**
 * Parse price from string (removes € symbol and converts to number)
 */
function parsePrice(priceStr?: string): number | undefined {
  if (!priceStr) return undefined;

  // Remove currency symbols, spaces, and dots (thousands separator)
  const cleaned = priceStr.replace(/[€\s.]/g, '').replace(',', '.');
  const price = parseFloat(cleaned);

  return isNaN(price) ? undefined : price;
}

/**
 * Parse number from string
 */
function parseNumber(numStr?: string): number | undefined {
  if (!numStr) return undefined;

  const cleaned = numStr.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);

  return isNaN(num) ? undefined : num;
}

/**
 * Parse coordinates from string
 * Example: "48.24029,16.34025" → {lat: 48.24029, lon: 16.34025}
 */
function parseCoordinates(coordStr?: string): { lat: number; lon: number } | undefined {
  if (!coordStr) return undefined;

  const parts = coordStr.split(',');
  if (parts.length !== 2) return undefined;

  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lon)) return undefined;

  return { lat, lon };
}

/**
 * Extract total floors from floor string
 * Example: "3/5" → 5
 */
function extractTotalFloors(floorStr?: string): number | undefined {
  if (!floorStr) return undefined;

  const match = floorStr.match(/\/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract image URLs from advertImage array
 */
function extractImageUrls(images: any[]): string[] {
  return images
    .map(img => img.referenceImageUrl || img.mainImageUrl)
    .filter(url => url);
}

/**
 * Extract thumbnail URLs from advertImage array
 */
function extractThumbnailUrls(images: any[]): string[] {
  return images
    .map(img => img.thumbnailImageUrl)
    .filter(url => url);
}

/**
 * Extract main image URL
 */
function extractMainImageUrl(images: any[]): string | undefined {
  const mainImage = images.find(img => img.description === 'Cover Image') || images[0];
  return mainImage?.mainImageUrl || mainImage?.referenceImageUrl;
}

/**
 * Extract floor plan URLs
 */
function extractFloorPlanUrls(floorPlans: any[]): string[] | undefined {
  if (!floorPlans || floorPlans.length === 0) return undefined;

  const urls = floorPlans
    .map(fp => fp.url || fp.href || fp.reference)
    .filter(url => url);

  return urls.length > 0 ? urls : undefined;
}

/**
 * Extract amenities from Willhaben attributes
 */
function extractAmenitiesFromAttributes(listing: WillhabenListing): StandardProperty['amenities'] {
  const amenities: StandardProperty['amenities'] = {};

  // Check for common Austrian amenity attributes
  const preferences = getAttributes(listing, 'ESTATE_PREFERENCE');

  // Common Willhaben preference IDs:
  // 24 = Balkon, 25 = Terrasse, 26 = Garten, 27 = Garage, 28 = Parkplatz
  // 250 = Lift (elevator), etc.

  if (preferences.includes('24')) amenities.has_balcony = true;
  if (preferences.includes('25')) amenities.has_terrace = true;
  if (preferences.includes('26')) amenities.has_garden = true;
  if (preferences.includes('27')) amenities.has_garage = true;
  if (preferences.includes('28')) amenities.has_parking = true;
  if (preferences.includes('250')) amenities.has_elevator = true;

  return amenities;
}

/**
 * Normalize condition to standard format
 */
function normalizeCondition(condition?: string): AustrianSpecificFields['condition'] {
  if (!condition) return undefined;

  const conditionMap: Record<string, AustrianSpecificFields['condition']> = {
    'ERSTBEZUG': 'new',
    'NEU': 'new',
    'NEW': 'new',
    'NEUWERTIG': 'excellent',
    'EXCELLENT': 'excellent',
    'SANIERT': 'after_renovation',
    'RENOVATED': 'after_renovation',
    'NACH_SANIERUNG': 'after_renovation',
    'GEPFLEGT': 'good',
    'GOOD': 'good',
    'RENOVIERUNGSBEDÜRFTIG': 'requires_renovation',
    'NEEDS_RENOVATION': 'requires_renovation',
    'PROJEKTIERT': 'project',
    'PROJECT': 'project',
    'IM_BAU': 'under_construction',
    'UNDER_CONSTRUCTION': 'under_construction'
  };

  return conditionMap[condition.toUpperCase().replace(/\s+/g, '_')] || undefined;
}

/**
 * Normalize furnished status to standard format
 */
function normalizeFurnished(furnished?: string): AustrianSpecificFields['furnished'] {
  if (!furnished) return undefined;

  const furnishedLower = furnished.toLowerCase();

  // Check specific terms first (before general 'möbliert')
  if (furnishedLower.includes('unmöbliert') || furnishedLower === 'unfurnished' || furnishedLower.includes('nicht möbliert')) {
    return 'not_furnished';
  }

  if (furnishedLower.includes('teilmöbliert') || furnishedLower.includes('teilweise') || furnishedLower === 'partially') {
    return 'partially_furnished';
  }

  if (furnishedLower.includes('möbliert') || furnishedLower === 'furnished' || furnishedLower.includes('vollmöbliert')) {
    return 'furnished';
  }

  return undefined;
}

/**
 * Normalize energy rating to standard format
 */
function normalizeEnergyRating(rating?: string): AustrianSpecificFields['energy_rating'] {
  if (!rating) return undefined;

  // Energy ratings are typically A, B, C, D, E, F, G
  const normalized = rating.toUpperCase().replace(/[^A-G]/g, '');
  const lower = normalized.toLowerCase();

  if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(lower)) {
    return lower as 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  }

  return 'unknown';
}

/**
 * Normalize heating type to standard format
 */
function normalizeHeatingType(heatingType?: string): AustrianSpecificFields['heating_type'] {
  if (!heatingType) return undefined;

  const heatingMap: Record<string, AustrianSpecificFields['heating_type']> = {
    'ZENTRALHEIZUNG': 'central_heating',
    'CENTRAL': 'central_heating',
    'CENTRAL_HEATING': 'central_heating',
    'FERNWÄRME': 'district_heating',
    'DISTRICT_HEATING': 'district_heating',
    'GASHEIZUNG': 'gas_heating',
    'GAS': 'gas_heating',
    'GAS_HEATING': 'gas_heating',
    'ELEKTROHEIZUNG': 'electric_heating',
    'ELECTRIC': 'electric_heating',
    'ELECTRIC_HEATING': 'electric_heating',
    'ÖLHEIZUNG': 'oil_heating',
    'OIL': 'oil_heating',
    'OIL_HEATING': 'oil_heating',
    'WÄRMEPUMPE': 'heat_pump',
    'HEAT_PUMP': 'heat_pump',
    'FUSSBODENHEIZUNG': 'floor_heating',
    'FLOOR_HEATING': 'floor_heating',
    'HOLZ': 'other',
    'WOOD': 'other',
    'SOLAR': 'other'
  };

  const key = heatingType.toUpperCase().replace(/[^A-ZÄÖÜ]/g, '_');
  return heatingMap[key] || 'other';
}

/**
 * Normalize ownership type to standard format
 */
function normalizeOwnershipType(ownershipType?: string): AustrianSpecificFields['ownership_type'] {
  if (!ownershipType) return undefined;

  const ownershipMap: Record<string, AustrianSpecificFields['ownership_type']> = {
    'EIGENTUM': 'eigentumsrecht',
    'EIGENTUMSRECHT': 'eigentumsrecht',
    'BAURECHT': 'baurecht',
    'MIETKAUF': 'mietkauf',
    'ERBPACHT': 'erbpacht',
    'GENOSSENSCHAFT': 'genossenschaft',
    'FREEHOLD': 'eigentumsrecht',
    'LEASEHOLD': 'baurecht',
    'COOPERATIVE': 'genossenschaft'
  };

  return ownershipMap[ownershipType.toUpperCase()] || 'other';
}

/**
 * Count parking spaces from Willhaben preferences and attributes
 * Preference IDs: 27 = Garage, 28 = Parkplatz/Stellplatz
 */
/**
 * Parse published date from Willhaben epoch milliseconds or ISO string
 */
function parsePublishedDate(epochMs?: string, isoString?: string): string | undefined {
  if (isoString) return isoString;
  if (!epochMs) return undefined;
  const ms = parseInt(epochMs, 10);
  if (isNaN(ms)) return undefined;
  return new Date(ms).toISOString();
}

function countParkingSpaces(listing: WillhabenListing): number | undefined {
  // Check for explicit parking spaces attribute
  const parkingCount = parseNumber(getAttribute(listing, 'PARKING_SPACES'));
  if (parkingCount !== undefined) return parkingCount;

  // Infer from preferences: if garage or parking is listed, count as 1
  const preferences = getAttributes(listing, 'ESTATE_PREFERENCE');
  const hasGarage = preferences.includes('27');
  const hasParking = preferences.includes('28');

  if (hasGarage || hasParking) return 1;

  return undefined;
}
