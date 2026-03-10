import { StandardProperty, AustrianSpecificFields } from '@landomo/core';
import { ImmodirektListing } from '../types/immodirektTypes';

/**
 * Transform Immodirekt.at listing to StandardProperty format
 */
export function transformImmodirektToStandard(listing: ImmodirektListing): StandardProperty & Record<string, any> {
  const transactionType = mapTransactionType(listing.transactionType);
  const propertyType = mapPropertyType(listing.propertyType, listing.title);
  const city = listing.location?.city || extractCityFromLocation(listing.location) || 'Unknown';

  // Map property type to category
  const propertyCategory = mapPropertyCategory(propertyType);

  return {
    // Category (required for partitioned DB)
    property_category: propertyCategory,

    // Basic info
    title: listing.title || 'Untitled',
    description: listing.description || listing.title || '',
    source_url: listing.url,
    source_platform: 'immodirekt-at',
    price: listing.price || 0,
    currency: 'EUR',

    // Transaction details
    transaction_type: transactionType,
    property_type: propertyType,

    // Location
    location: {
      country: 'Austria',
      city: city,
      region: listing.location?.state,
      postal_code: listing.location?.postalCode,
      address: listing.location?.address,
      coordinates: listing.coordinates ? {
        lat: listing.coordinates.lat,
        lon: listing.coordinates.lng
      } : undefined
    },

    // Property details
    details: {
      sqm: listing.area,
      rooms: listing.rooms,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      floor: listing.floor,
      renovation_year: undefined, // not available from immodirekt-at
      parking_spaces: undefined   // not available from immodirekt-at
    },

    // Price per square meter (calculated)
    price_per_sqm: listing.price && listing.area ? Math.round(listing.price / listing.area) : undefined,

    // Universal Tier 1 fields (also in country_specific for backward compat)
    condition: normalizeCondition(listing.condition),
    heating_type: normalizeHeatingType(listing.heatingType),
    furnished: normalizeFurnished(listing.furnished),
    construction_type: undefined, // not available from immodirekt-at
    available_from: listing.availableFrom,
    published_date: listing.metadata?.published,
    deposit: undefined, // not available from immodirekt-at
    parking_spaces: undefined, // not available from immodirekt-at

    // Portal metadata (Immodirekt-specific fields)
    portal_metadata: {
      immodirekt: {
        // Identity
        id: listing.id,

        // Classification
        property_type: listing.propertyType,
        transaction_type: listing.transactionType,

        // Austrian specific
        condition: listing.condition,
        energy_rating: listing.energyRating,
        heating_type: listing.heatingType,
        construction_year: listing.constructionYear,
        furnished: listing.furnished,
        available_from: listing.availableFrom,

        // Area breakdown
        area: listing.area,
        plot_area: listing.plotArea,
        total_floors: listing.totalFloors,

        // Contact & Realtor
        realtor_name: listing.realtor?.name,
        realtor_phone: listing.realtor?.phone,
        realtor_email: listing.realtor?.email,
        realtor_company: listing.realtor?.company,

        // Metadata
        realtor: listing.realtor,
        metadata: listing.metadata
      }
    },

    // Media
    media: {
      images: listing.images || [],
      total_images: listing.images?.length || 0
    },

    // Backward compatibility
    images: listing.images || [],

    // Features
    features: listing.features || [],

    // Amenities parsed from features
    amenities: {
      ...parseAustrianFeatures(listing.features)
    },

    // Top-level Austrian DB columns (read by bulk-operations.ts)
    austrian_ownership: normalizeOwnershipType(listing.ownershipType),
    austrian_operating_costs: listing.operatingCosts,
    austrian_heating_costs: listing.heatingCosts,

    // Country-specific data
    country_specific: {
      // Condition
      condition: normalizeCondition(listing.condition),

      // Furnished
      furnished: normalizeFurnished(listing.furnished),

      // Energy rating (standardized)
      energy_rating: normalizeEnergyRating(listing.energyRating),

      // Heating type
      heating_type: normalizeHeatingType(listing.heatingType),

      // Ownership
      ownership_type: normalizeOwnershipType(listing.ownershipType),

      // Building details
      year_built: listing.constructionYear,
      available_from: listing.availableFrom,

      // Cost breakdown
      operating_costs: listing.operatingCosts,
      heating_costs: listing.heatingCosts,

      // Area breakdown
      area_living: listing.area,
      area_plot: listing.plotArea,

      // Images
      image_urls: listing.images || [],
      image_count: listing.images?.length || 0
    } as AustrianSpecificFields
  } as StandardProperty & Record<string, any>;
}

/**
 * Map Immodirekt transaction type to StandardProperty
 */
function mapTransactionType(type?: string): 'sale' | 'rent' {
  if (!type) return 'sale';

  const typeNormalized = type.toLowerCase();

  if (typeNormalized.includes('rent') || typeNormalized.includes('mieten')) {
    return 'rent';
  }

  return 'sale';
}

/**
 * Map Immodirekt property type to StandardProperty
 */
function mapPropertyType(type?: string, title?: string): string {
  const searchText = `${type || ''} ${title || ''}`.toLowerCase();

  if (searchText.includes('wohnung') || searchText.includes('apartment') || searchText.includes('flat')) {
    return 'apartment';
  }

  if (searchText.includes('haus') || searchText.includes('house') || searchText.includes('einfamilienhaus')) {
    return 'house';
  }

  if (searchText.includes('grundstück') || searchText.includes('land') || searchText.includes('parzelle')) {
    return 'land';
  }

  if (searchText.includes('gewerbe') || searchText.includes('commercial') || searchText.includes('büro')) {
    return 'commercial';
  }

  if (searchText.includes('garage') || searchText.includes('stellplatz')) {
    return 'garage';
  }

  // Default to apartment
  return 'apartment';
}

/**
 * Map property type to category partition
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (propertyType) {
    case 'apartment':
    case 'maisonette':
    case 'loft':
      return 'apartment';
    case 'house':
    case 'multi-family-house':
    case 'row-house':
    case 'semi-detached-house':
    case 'villa':
    case 'farmhouse':
      return 'house';
    case 'land':
    case 'commercial-land':
    case 'agriculture':
      return 'land';
    case 'office':
    case 'retail':
    case 'warehouse':
    case 'commercial':
    case 'parking':
    case 'restaurant':
    case 'hotel':
      return 'commercial';
    default:
      return 'apartment';
  }
}

/**
 * Extract city from location object or string
 */
function extractCityFromLocation(location?: { city?: string; state?: string; address?: string }): string | undefined {
  if (!location) return undefined;

  // Try city field first
  if (location.city) return location.city;

  // Try to extract from state or address
  const text = location.state || location.address || '';

  // Common Austrian cities
  const cities = [
    'Wien', 'Vienna',
    'Graz',
    'Linz',
    'Salzburg',
    'Innsbruck',
    'Klagenfurt',
    'Villach',
    'Wels',
    'St. Pölten',
    'Dornbirn'
  ];

  for (const city of cities) {
    if (text.includes(city)) {
      return city;
    }
  }

  // Extract first part before comma or dash
  const parts = text.split(/[,\-]/);
  return parts[0]?.trim() || undefined;
}

/**
 * Parse price from Austrian format text
 * Examples: "€ 350.000", "EUR 350.000", "€ 1.200/Monat"
 */
export function parsePrice(priceText?: string): number | undefined {
  if (!priceText) return undefined;

  // Remove common Austrian price suffixes
  const cleaned = priceText
    .replace(/€.*$/i, '')
    .replace(/EUR.*$/i, '')
    .replace(/\/.*$/i, '') // Remove per month notation
    .replace(/\./g, '') // Remove thousand separators
    .replace(/,/g, '.') // Replace decimal comma with dot
    .replace(/[^\d.]/g, '');

  const price = parseFloat(cleaned);
  return isNaN(price) ? undefined : price;
}

/**
 * Parse Austrian features into structured amenities
 */
function parseAustrianFeatures(features?: string[]): StandardProperty['amenities'] {
  if (!features || features.length === 0) return {};

  const amenities: StandardProperty['amenities'] = {};

  features.forEach(feature => {
    const lowerFeature = feature.toLowerCase();

    // Parking
    if (lowerFeature.includes('parkplatz') || lowerFeature.includes('stellplatz')) {
      amenities.has_parking = true;
    }

    // Garage
    if (lowerFeature.includes('garage')) {
      amenities.has_garage = true;
    }

    // Balcony
    if (lowerFeature.includes('balkon') || lowerFeature.includes('balcony')) {
      amenities.has_balcony = true;
    }

    // Terrace
    if (lowerFeature.includes('terrasse') || lowerFeature.includes('terrace')) {
      amenities.has_terrace = true;
    }

    // Garden
    if (lowerFeature.includes('garten') || lowerFeature.includes('garden')) {
      amenities.has_garden = true;
    }

    // Elevator
    if (lowerFeature.includes('aufzug') || lowerFeature.includes('lift') || lowerFeature.includes('elevator')) {
      amenities.has_elevator = true;
    }

    // Basement/Cellar
    if (lowerFeature.includes('keller') || lowerFeature.includes('basement') || lowerFeature.includes('cellar')) {
      amenities.has_basement = true;
    }

    // Air conditioning
    if (lowerFeature.includes('klimaanlage') || lowerFeature.includes('air conditioning')) {
      amenities.has_ac = true;
    }

    // Swimming pool
    if (lowerFeature.includes('pool') || lowerFeature.includes('schwimmbad')) {
      amenities.has_pool = true;
    }

    // Fireplace
    if (lowerFeature.includes('kamin') || lowerFeature.includes('fireplace')) {
      amenities.has_fireplace = true;
    }

    // Storage
    if (lowerFeature.includes('abstellraum') || lowerFeature.includes('storage')) {
      amenities.has_storage = true;
    }

    // Barrier-free
    if (lowerFeature.includes('barrierefrei') || lowerFeature.includes('wheelchair') || lowerFeature.includes('accessible')) {
      amenities.is_barrier_free = true;
    }

    // Pet friendly
    if (lowerFeature.includes('haustiere') || lowerFeature.includes('pet')) {
      amenities.is_pet_friendly = true;
    }
  });

  return amenities;
}

/**
 * Normalize condition to standard format
 */
function normalizeCondition(condition?: string): AustrianSpecificFields['condition'] {
  if (!condition) return undefined;

  const conditionMap: Record<string, AustrianSpecificFields['condition']> = {
    'ERSTBEZUG': 'new',
    'NEUWERTIG': 'excellent',
    'SANIERT': 'after_renovation',
    'GEPFLEGT': 'good',
    'RENOVIERUNGSBEDÜRFTIG': 'requires_renovation',
    'PROJEKTIERT': 'project',
    'IM BAU': 'under_construction',
    'NEW': 'new',
    'EXCELLENT': 'excellent',
    'RENOVATED': 'after_renovation',
    'GOOD': 'good',
    'NEEDS_RENOVATION': 'requires_renovation',
    'PROJECT': 'project',
    'UNDER_CONSTRUCTION': 'under_construction'
  };

  return conditionMap[condition.toUpperCase()] || undefined;
}

/**
 * Normalize furnished status to standard format
 */
function normalizeFurnished(furnished?: boolean | string): AustrianSpecificFields['furnished'] {
  if (furnished === undefined || furnished === null) return undefined;

  if (typeof furnished === 'boolean') {
    return furnished ? 'furnished' : 'not_furnished';
  }

  const furnishedLower = furnished.toLowerCase();

  if (furnishedLower.includes('möbliert') || furnishedLower.includes('furnished')) {
    return 'furnished';
  }

  if (furnishedLower.includes('teilmöbliert') || furnishedLower.includes('partly')) {
    return 'partially_furnished';
  }

  return 'not_furnished';
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
    'FERNWÄRME': 'district_heating',
    'GASHEIZUNG': 'gas_heating',
    'ELEKTROHEIZUNG': 'electric_heating',
    'ÖLHEIZUNG': 'oil_heating',
    'WÄRMEPUMPE': 'heat_pump',
    'FUSSBODENHEIZUNG': 'floor_heating',
    'CENTRAL': 'central_heating',
    'CENTRAL_HEATING': 'central_heating',
    'DISTRICT_HEATING': 'district_heating',
    'GAS': 'gas_heating',
    'GAS_HEATING': 'gas_heating',
    'ELECTRIC': 'electric_heating',
    'ELECTRIC_HEATING': 'electric_heating',
    'OIL': 'oil_heating',
    'OIL_HEATING': 'oil_heating',
    'HEAT_PUMP': 'heat_pump',
    'FLOOR_HEATING': 'floor_heating',
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
