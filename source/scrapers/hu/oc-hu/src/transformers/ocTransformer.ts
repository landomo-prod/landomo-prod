import { StandardProperty } from '@landomo/core';
import {
  normalizeOwnershipType,
  normalizeCondition,
  normalizeFurnished,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType
} from '../../../shared/hungarian-value-mappings';
import { OcListing, PROPERTY_TYPE_MAP, TRANSACTION_TYPE_MAP } from '../types/ocTypes';

/**
 * Transform Otthon Centrum listing to StandardProperty format
 */
export function transformOcToStandard(listing: OcListing): StandardProperty & Record<string, any> {
  const sqm = listing.area;

  return {
    // Basic info
    title: listing.title || 'Untitled Property',
    price: listing.price || 0,
    currency: listing.currency || 'HUF',
    property_type: mapPropertyType(listing.propertyType),
    property_category: mapPropertyCategory(mapPropertyType(listing.propertyType)),
    transaction_type: mapTransactionType(listing.transactionType),
    source_url: listing.url,
    source_platform: 'oc.hu',

    // Agent/Seller information
    agent: listing.agent ? {
      name: listing.agent.name || listing.agent.company || 'Unknown',
      phone: listing.agent.phone,
      email: listing.agent.email,
      agency: listing.agent.company
    } : undefined,

    // Location
    location: {
      address: listing.address || listing.location,
      city: listing.city || extractCity(listing.location),
      region: listing.district,
      country: 'Hungary',
      postal_code: listing.zipCode,
      coordinates: listing.coordinates
    },

    // Details
    details: {
      bedrooms: listing.rooms,
      bathrooms: listing.rooms ? Math.max(1, Math.floor(listing.rooms / 2)) : undefined,
      sqm: sqm,
      floor: listing.floor,
      total_floors: listing.totalFloors,
      rooms: listing.rooms,
      year_built: listing.buildYear,
      renovation_year: undefined, // OC.hu doesn't provide renovation year separately
      parking_spaces: listing.parking ? 1 : undefined,
    },

    // Financial details
    price_per_sqm: listing.price && sqm ? Math.round(listing.price / sqm) : undefined,

    // Universal Tier 1 fields (promoted from country_specific for cross-country querying)
    condition: mapConditionToEnglish(normalizeCondition(listing.condition)),
    heating_type: mapHeatingToEnglish(normalizeHeatingType(listing.heating)),
    furnished: mapFurnishedToEnglish(normalizeFurnished(listing.furnished)),
    construction_type: mapConstructionToEnglish(normalizeConstructionType(listing.constructionType)),
    available_from: undefined, // OC.hu doesn't provide available_from
    published_date: listing.publishedDate,
    deposit: listing.deposit,
    parking_spaces: listing.parking ? 1 : undefined,

    // Portal metadata
    portal_metadata: {
      'oc.hu': {
        original_id: listing.id,
        own_id: listing.ownId,
        source_url: listing.url,
        published_date: listing.publishedDate,
        modified_date: listing.modifiedDate,
        view_count: listing.viewCount,
        otthon_start_eligible: listing.otthonStartEligible
      }
    },

    // Country-specific fields (Hungary) - uses HungarianSpecificFields interface
    country_specific: {
      room_count: listing.rooms,
      half_rooms: listing.halfRooms,
      ownership: mapOwnershipToEnglish(normalizeOwnershipType(listing.ownership)),
      condition: mapConditionToEnglish(normalizeCondition(listing.condition)),
      furnished: mapFurnishedToEnglish(normalizeFurnished(listing.furnished)),
      energy_rating: mapEnergyRatingToEnglish(normalizeEnergyRating(listing.energyRating)),
      heating_type: mapHeatingToEnglish(normalizeHeatingType(listing.heating)),
      construction_type: mapConstructionToEnglish(normalizeConstructionType(listing.constructionType)),
      utility_costs: listing.utilities,
      deposit: listing.deposit,
    },
    // Dedicated DB columns for bulk-operations extraction
    ...({ hungarian_room_count: listing.rooms ? String(listing.rooms) : undefined, hungarian_ownership: normalizeOwnershipType(listing.ownership) } as Record<string, unknown>),

    // Features
    features: extractFeatures(listing),

    // Amenities
    amenities: {
      has_balcony: listing.balcony,
      has_terrace: listing.terrace,
      has_garden: listing.garden,
      has_parking: listing.parking,
      has_elevator: listing.elevator,
      has_ac: listing.airConditioning,
      has_storage: listing.storage
    },

    // Media
    images: listing.images || [],
    description: listing.description,
    description_language: 'hu',

    // Status
    status: 'active'
  };
}

/**
 * Map OC.hu property type to standard type
 */
function mapPropertyType(propertyType: string): string {
  if (!propertyType) return 'other';

  const normalized = propertyType.toLowerCase().trim();
  return PROPERTY_TYPE_MAP[normalized] || 'other';
}

/**
 * Map OC.hu transaction type to standard type
 */
function mapTransactionType(transactionType: string): 'sale' | 'rent' {
  if (!transactionType) return 'sale';

  const normalized = transactionType.toLowerCase().trim();
  return TRANSACTION_TYPE_MAP[normalized] || 'sale';
}

/**
 * Extract city from location string
 * Handles formats like "Budapest, V. kerület", "Debrecen", "Szeged, Alsóváros"
 */
function extractCity(location: string): string {
  if (!location) return '';

  // Remove district/neighborhood information after comma
  const city = location
    .split(/[,-]/)[0]
    .trim()
    .replace(/\s*\d+\.?\s*kerület/i, '')  // Remove "5. kerület" etc.
    .replace(/\s*\d+$/,'');                // Remove trailing numbers

  return city || location;
}

/**
 * Extract features from listing
 */
function extractFeatures(listing: OcListing): string[] {
  const features: string[] = [];

  if (listing.balcony) features.push('balcony');
  if (listing.terrace) features.push('terrace');
  if (listing.garden) features.push('garden');
  if (listing.parking) features.push('parking');
  if (listing.elevator) features.push('elevator');
  if (listing.airConditioning) features.push('air_conditioning');
  if (listing.storage) features.push('storage');
  if (listing.otthonStartEligible) features.push('otthon_start_eligible');

  if (listing.condition) features.push(`condition_${listing.condition}`);
  if (listing.heating) features.push(`heating_${listing.heating}`);

  return features;
}

/**
 * Helper to safely parse numeric values
 */
export function parseNumber(value: any): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Helper to safely parse boolean values
 */
export function parseBoolean(value: any): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (['yes', 'igen', 'true', '1'].includes(normalized)) return true;
    if (['no', 'nem', 'false', '0'].includes(normalized)) return false;
  }
  return undefined;
}

/**
 * Map Hungarian condition values to English canonical values
 */
function mapConditionToEnglish(hungarianCondition: any): 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' | 'before_renovation' | 'requires_renovation' | 'project' | 'under_construction' | 'newly_renovated' | undefined {
  if (!hungarianCondition) return undefined;

  const mapping: Record<string, 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' | 'before_renovation' | 'requires_renovation' | 'project' | 'under_construction' | 'newly_renovated'> = {
    'újépítésű': 'new',
    'újszerű': 'excellent',
    'kiváló': 'excellent',
    'jó': 'good',
    'felújított': 'after_renovation',
    'felújítandó': 'requires_renovation',
    'közepes': 'good',
    'romos': 'requires_renovation',
    'építés_alatt': 'under_construction'
  };

  return mapping[hungarianCondition];
}

/**
 * Map Hungarian furnished values to English canonical values
 */
function mapFurnishedToEnglish(hungarianFurnished: any): 'furnished' | 'unfurnished' | 'partially_furnished' | 'not_furnished' | undefined {
  if (!hungarianFurnished) return undefined;

  const mapping: Record<string, 'furnished' | 'unfurnished' | 'partially_furnished' | 'not_furnished'> = {
    'bútorozott': 'furnished',
    'részben_bútorozott': 'partially_furnished',
    'bútorozatlan': 'unfurnished'
  };

  return mapping[hungarianFurnished];
}

/**
 * Map Hungarian heating values to English canonical values
 */
function mapHeatingToEnglish(hungarianHeating: any): 'other' | 'unknown' | 'central_heating' | 'individual_heating' | 'electric_heating' | 'gas_heating' | 'hot_water' | 'water_heating' | 'heat_pump' | 'none' | 'district_heating' | 'oil_heating' | 'floor_heating' | undefined {
  if (!hungarianHeating) return undefined;

  const mapping: Record<string, 'other' | 'unknown' | 'central_heating' | 'individual_heating' | 'electric_heating' | 'gas_heating' | 'hot_water' | 'water_heating' | 'heat_pump' | 'none' | 'district_heating' | 'oil_heating' | 'floor_heating'> = {
    'központi': 'central_heating',
    'gázfűtés': 'gas_heating',
    'elektromos': 'electric_heating',
    'távfűtés': 'district_heating',
    'házközponti': 'central_heating',
    'egyedi': 'individual_heating',
    'gázkonvektor': 'gas_heating',
    'fan_coil': 'heat_pump',
    'geotermikus': 'heat_pump',
    'napkollektor': 'other',
    'egyéb': 'other'
  };

  return mapping[hungarianHeating] || 'unknown';
}

/**
 * Map Hungarian construction values to English canonical values
 */
function mapConstructionToEnglish(hungarianConstruction: any): 'other' | 'panel' | 'brick' | 'concrete' | 'wood' | 'mixed' | 'stone' | 'steel' | 'masonry' | undefined {
  if (!hungarianConstruction) return undefined;

  const mapping: Record<string, 'other' | 'panel' | 'brick' | 'concrete' | 'wood' | 'mixed' | 'stone' | 'steel' | 'masonry'> = {
    'panel': 'panel',
    'tégla': 'brick',
    'vasbeton': 'concrete',
    'vályog': 'masonry',
    'fa': 'wood',
    'könnyűszerkezet': 'steel',
    'vegyesfalazat': 'mixed',
    'egyéb': 'other'
  };

  return mapping[hungarianConstruction];
}

/**
 * Map Hungarian ownership to English canonical values for HungarianSpecificFields
 */
function mapOwnershipToEnglish(hungarianOwnership: any): 'freehold' | 'cooperative' | 'municipal' | 'state' | 'condominium' | 'other' | undefined {
  if (!hungarianOwnership) return undefined;
  const mapping: Record<string, 'freehold' | 'cooperative' | 'municipal' | 'state' | 'condominium' | 'other'> = {
    'tulajdon': 'freehold',
    'társasházi': 'condominium',
    'szövetkezeti': 'cooperative',
    'állami': 'state',
    'egyéb': 'other'
  };
  return mapping[hungarianOwnership];
}

/**
 * Map Hungarian energy rating values to English canonical values
 * Hungarian system uses A++, A+, A-J. StandardProperty expects a-g or unknown.
 */
function mapEnergyRatingToEnglish(hungarianRating: any): 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'unknown' | undefined {
  if (!hungarianRating) return undefined;

  const mapping: Record<string, 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'unknown'> = {
    'a++': 'a',
    'a+': 'a',
    'a': 'a',
    'b': 'b',
    'c': 'c',
    'd': 'd',
    'e': 'e',
    'f': 'f',
    'g': 'g',
    'h': 'g',  // Map H-J to G (lowest in standard)
    'i': 'g',
    'j': 'g'
  };

  return mapping[hungarianRating] || 'unknown';
}

function mapPropertyCategory(propertyType: string): string {
  const pt = (propertyType || '').toLowerCase();
  if (pt.includes('apartment') || pt.includes('flat') || pt.includes('lakás') || pt.includes('lakas')) return 'apartment';
  if (pt.includes('house') || pt.includes('ház') || pt.includes('haz') || pt.includes('villa')) return 'house';
  if (pt.includes('land') || pt.includes('telek') || pt.includes('plot')) return 'land';
  if (pt.includes('commercial') || pt.includes('office') || pt.includes('iroda') || pt.includes('üzlet')) return 'commercial';
  return 'apartment';
}
