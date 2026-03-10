import { StandardProperty, AustrianSpecificFields } from '@landomo/core';
import { ImmoweltListing } from '../types/immoweltTypes';

/**
 * Transform Immowelt.at listing to StandardProperty format
 */
export function transformImmoweltToStandard(listing: ImmoweltListing): StandardProperty & Record<string, any> {
  const transactionType = mapTransactionType(listing.transactionType);
  const propertyType = mapPropertyType(listing.propertyType, listing.title);
  const city = extractCity(listing);

  // Map property type to category for partition routing
  const propertyCategory = mapPropertyCategory(propertyType);

  return {
    // Category (required for partition routing)
    property_category: propertyCategory,

    // Basic info
    title: listing.title || 'Untitled',
    description: listing.description || listing.title || '',
    source_url: listing.url,
    source_platform: 'immowelt-at',
    price: listing.price || 0,
    currency: 'EUR',

    // Transaction details
    transaction_type: transactionType,
    property_type: propertyType,

    // Location
    location: {
      country: 'Austria',
      city: city,
      region: listing.location?.district,
      address: listing.location?.address,
      postal_code: listing.location?.postalCode,
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
      total_floors: listing.totalFloors,
      year_built: listing.yearBuilt,
      renovation_year: undefined, // not available from immowelt-at
      parking_spaces: listing.parkingSpaces
    },

    // Price per square meter
    price_per_sqm: listing.price && listing.area ? Math.round(listing.price / listing.area) : undefined,

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
    amenities: parseAmenities(listing.features),

    // Agent/Realtor info
    agent: listing.realtor ? {
      name: listing.realtor.name || '',
      phone: listing.realtor.phone,
      email: listing.realtor.email,
      agency: listing.realtor.company,
      agency_logo: listing.realtor.logo
    } : undefined,

    // Energy rating
    energy_rating: normalizeEnergyRating(listing.energyRating),

    // Universal Tier 1 fields (also in country_specific for backward compat)
    condition: normalizeCondition(listing.condition),
    heating_type: normalizeHeatingType(listing.heatingType),
    furnished: normalizeFurnished(listing.furnished),
    construction_type: normalizeConstructionType(listing.constructionType) as string | undefined,
    available_from: listing.availableFrom,
    published_date: listing.metadata?.published,
    deposit: undefined, // not available from immowelt-at
    parking_spaces: listing.parkingSpaces,

    // Portal metadata - Austrian/German specific fields
    portal_metadata: {
      immowelt: {
        id: listing.id,
        property_type: listing.propertyType,
        transaction_type: listing.transactionType,
        condition: listing.condition,
        energy_rating: listing.energyRating,
        heating_type: listing.heatingType,
        construction_type: listing.constructionType,
        building_type: listing.buildingType,
        year_built: listing.yearBuilt,
        furnished: listing.furnished,
        area: listing.area,
        plot_area: listing.plotArea,
        available_from: listing.availableFrom,
        parking_spaces: listing.parkingSpaces,
        realtor: listing.realtor,
        metadata: listing.metadata
      }
    },

    // Top-level Austrian DB columns (read by bulk-operations.ts)
    austrian_ownership: normalizeOwnershipType(listing.ownershipType),
    austrian_operating_costs: listing.operatingCosts,
    austrian_heating_costs: listing.heatingCosts,

    // Country-specific data
    country_specific: {
      condition: normalizeCondition(listing.condition),
      energy_rating: normalizeEnergyRating(listing.energyRating),
      heating_type: normalizeHeatingType(listing.heatingType),
      construction_type: normalizeConstructionType(listing.constructionType) as AustrianSpecificFields['construction_type'],
      furnished: normalizeFurnished(listing.furnished),
      ownership_type: normalizeOwnershipType(listing.ownershipType),
      operating_costs: listing.operatingCosts,
      heating_costs: listing.heatingCosts,
      area_living: listing.area,
      area_plot: listing.plotArea,
      year_built: listing.yearBuilt,
      building_type: normalizeBuildingType(listing.buildingType)
    } as AustrianSpecificFields,

    // Status
    status: 'active'
  } as StandardProperty & Record<string, any>;
}

/**
 * Map property type to category for DB partition routing
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (propertyType) {
    case 'apartment': return 'apartment';
    case 'house': return 'house';
    case 'land': return 'land';
    case 'commercial': return 'commercial';
    case 'office': return 'commercial';
    case 'garage': return 'commercial';
    case 'parking': return 'commercial';
    default: return 'apartment';
  }
}

/**
 * Map Immowelt transaction type to StandardProperty
 */
function mapTransactionType(type?: string): 'sale' | 'rent' {
  if (!type) return 'sale';

  const typeNormalized = type.toLowerCase();

  if (typeNormalized.includes('rent') ||
      typeNormalized.includes('mieten') ||
      typeNormalized.includes('miete')) {
    return 'rent';
  }

  return 'sale';
}

/**
 * Map Immowelt property type to StandardProperty
 */
function mapPropertyType(type?: string, title?: string): string {
  const searchText = `${type || ''} ${title || ''}`.toLowerCase();

  if (searchText.includes('wohnung') ||
      searchText.includes('apartment') ||
      searchText.includes('flat')) {
    return 'apartment';
  }

  if (searchText.includes('haus') ||
      searchText.includes('house') ||
      searchText.includes('einfamilienhaus') ||
      searchText.includes('reihenhaus') ||
      searchText.includes('villa')) {
    return 'house';
  }

  if (searchText.includes('grundstück') ||
      searchText.includes('land')) {
    return 'land';
  }

  if (searchText.includes('gewerbe') ||
      searchText.includes('büro') ||
      searchText.includes('commercial') ||
      searchText.includes('office')) {
    return 'commercial';
  }

  if (searchText.includes('garage') ||
      searchText.includes('stellplatz') ||
      searchText.includes('parking')) {
    return 'garage';
  }

  // Default to apartment
  return 'apartment';
}

/**
 * Extract city from listing location
 */
function extractCity(listing: ImmoweltListing): string {
  if (listing.location?.city) {
    return listing.location.city;
  }

  // Try to extract from address or district
  const text = listing.location?.address || listing.location?.district || '';

  // Common Austrian cities
  const cities = [
    'Wien', 'Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck',
    'Klagenfurt', 'Villach', 'Wels', 'St. Pölten', 'Dornbirn'
  ];

  for (const city of cities) {
    if (text.includes(city)) {
      return city;
    }
  }

  // Extract first part before comma
  const parts = text.split(/[,\-]/);
  return parts[0]?.trim() || 'Unknown';
}

/**
 * Parse amenities from features array
 */
function parseAmenities(features?: string[]): any {
  if (!features || features.length === 0) {
    return {};
  }

  const amenities: any = {};
  const featuresLower = features.map(f => f.toLowerCase());

  // Parking
  if (featuresLower.some(f =>
      f.includes('parkplatz') ||
      f.includes('parking') ||
      f.includes('stellplatz'))) {
    amenities.has_parking = true;
  }

  // Garage
  if (featuresLower.some(f => f.includes('garage'))) {
    amenities.has_garage = true;
  }

  // Garden
  if (featuresLower.some(f => f.includes('garten') || f.includes('garden'))) {
    amenities.has_garden = true;
  }

  // Balcony
  if (featuresLower.some(f => f.includes('balkon') || f.includes('balcony'))) {
    amenities.has_balcony = true;
  }

  // Terrace
  if (featuresLower.some(f => f.includes('terrasse') || f.includes('terrace'))) {
    amenities.has_terrace = true;
  }

  // Basement/Cellar
  if (featuresLower.some(f => f.includes('keller') || f.includes('basement'))) {
    amenities.has_basement = true;
  }

  // Elevator
  if (featuresLower.some(f =>
      f.includes('aufzug') ||
      f.includes('lift') ||
      f.includes('elevator'))) {
    amenities.has_elevator = true;
  }

  // Pool
  if (featuresLower.some(f => f.includes('pool') || f.includes('schwimmbad'))) {
    amenities.has_pool = true;
  }

  // Fireplace
  if (featuresLower.some(f => f.includes('kamin') || f.includes('fireplace'))) {
    amenities.has_fireplace = true;
  }

  // Air conditioning
  if (featuresLower.some(f =>
      f.includes('klimaanlage') ||
      f.includes('air condition') ||
      f.includes('a/c'))) {
    amenities.has_ac = true;
  }

  // Barrier-free
  if (featuresLower.some(f =>
      f.includes('barrierefrei') ||
      f.includes('barrier-free') ||
      f.includes('rollstuhlgerecht'))) {
    amenities.is_barrier_free = true;
  }

  // Pet-friendly
  if (featuresLower.some(f =>
      f.includes('haustiere') ||
      f.includes('pet') ||
      f.includes('tiere erlaubt'))) {
    amenities.is_pet_friendly = true;
  }

  // Furnished
  if (featuresLower.some(f =>
      f.includes('möbliert') ||
      f.includes('furnished') ||
      f.includes('eingerichtet'))) {
    amenities.is_furnished = true;
  }

  return amenities;
}

/**
 * Normalize condition
 */
function normalizeCondition(condition?: string): AustrianSpecificFields['condition'] {
  if (!condition) return undefined;

  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('neu') || conditionLower.includes('new')) {
    return 'new';
  }
  if (conditionLower.includes('erstbezug') || conditionLower.includes('first occupancy')) {
    return 'new';
  }
  if (conditionLower.includes('saniert') || conditionLower.includes('renovated')) {
    return 'after_renovation';
  }
  if (conditionLower.includes('gepflegt') || conditionLower.includes('well maintained')) {
    return 'good';
  }
  if (conditionLower.includes('modernisiert') || conditionLower.includes('modernized')) {
    return 'excellent';
  }

  return undefined;
}

/**
 * Normalize energy rating
 */
function normalizeEnergyRating(rating?: string): AustrianSpecificFields['energy_rating'] {
  if (!rating) return undefined;

  const ratingUpper = rating.toUpperCase();
  const match = ratingUpper.match(/[A-G]/);

  if (match) {
    const lower = match[0].toLowerCase();
    if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(lower)) {
      return lower as 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
    }
  }

  return 'unknown';
}

/**
 * Normalize heating type
 */
function normalizeHeatingType(heating?: string): AustrianSpecificFields['heating_type'] {
  if (!heating) return undefined;

  const heatingLower = heating.toLowerCase();

  if (heatingLower.includes('fernwärme') || heatingLower.includes('district heating')) {
    return 'district_heating';
  }
  if (heatingLower.includes('gas')) {
    return 'gas_heating';
  }
  if (heatingLower.includes('öl') || heatingLower.includes('oil')) {
    return 'oil_heating';
  }
  if (heatingLower.includes('elektro') || heatingLower.includes('electric')) {
    return 'electric_heating';
  }
  if (heatingLower.includes('wärmepumpe') || heatingLower.includes('heat pump')) {
    return 'heat_pump';
  }
  if (heatingLower.includes('fußboden') || heatingLower.includes('floor')) {
    return 'floor_heating';
  }

  return 'other';
}

/**
 * Normalize construction type
 */
function normalizeConstructionType(construction?: string): AustrianSpecificFields['construction_type'] {
  if (!construction) return undefined;

  const constructionLower = construction.toLowerCase();

  if (constructionLower.includes('ziegel') || constructionLower.includes('brick')) {
    return 'brick';
  }
  if (constructionLower.includes('beton') || constructionLower.includes('concrete')) {
    return 'concrete';
  }
  if (constructionLower.includes('holz') || constructionLower.includes('wood')) {
    return 'wood';
  }
  if (constructionLower.includes('stein') || constructionLower.includes('stone')) {
    return 'stone';
  }

  return undefined;
}

/**
 * Normalize furnished status
 */
function normalizeFurnished(furnished?: string): AustrianSpecificFields['furnished'] {
  if (!furnished) return undefined;

  const furnishedLower = furnished.toLowerCase();

  if (furnishedLower.includes('möbliert') ||
      furnishedLower.includes('furnished') ||
      furnishedLower.includes('vollmöbliert')) {
    return 'furnished';
  }
  if (furnishedLower.includes('teilmöbliert') ||
      furnishedLower.includes('teilweise') ||
      furnishedLower.includes('partially')) {
    return 'partially_furnished';
  }
  if (furnishedLower.includes('unmöbliert') ||
      furnishedLower.includes('unfurnished') ||
      furnishedLower.includes('nicht möbliert')) {
    return 'not_furnished';
  }

  return undefined;
}

/**
 * Normalize building type
 */
function normalizeBuildingType(buildingType?: string): string | undefined {
  if (!buildingType) return undefined;

  const buildingTypeLower = buildingType.toLowerCase();

  // German terms
  if (buildingTypeLower.includes('einfamilienhaus') || buildingTypeLower.includes('detached')) {
    return 'detached';
  }
  if (buildingTypeLower.includes('doppelhaushälfte') || buildingTypeLower.includes('semi-detached')) {
    return 'semi_detached';
  }
  if (buildingTypeLower.includes('reihenhaus') || buildingTypeLower.includes('terraced')) {
    return 'terraced';
  }
  if (buildingTypeLower.includes('mehrfamilienhaus') || buildingTypeLower.includes('multi-family')) {
    return 'multi_family';
  }
  if (buildingTypeLower.includes('villa')) {
    return 'villa';
  }
  if (buildingTypeLower.includes('bungalow')) {
    return 'bungalow';
  }
  if (buildingTypeLower.includes('hochhaus') || buildingTypeLower.includes('high-rise')) {
    return 'high_rise';
  }
  if (buildingTypeLower.includes('niedrigenergiehaus') || buildingTypeLower.includes('low energy')) {
    return 'low_energy';
  }

  return undefined;
}

/**
 * Normalize ownership type to standard format
 */
function normalizeOwnershipType(ownershipType?: string): AustrianSpecificFields['ownership_type'] {
  if (!ownershipType) return undefined;

  const ownershipMap: Record<string, AustrianSpecificFields['ownership_type']> = {
    'eigentum': 'eigentumsrecht',
    'eigentumsrecht': 'eigentumsrecht',
    'baurecht': 'baurecht',
    'mietkauf': 'mietkauf',
    'erbpacht': 'erbpacht',
    'genossenschaft': 'genossenschaft',
    'freehold': 'eigentumsrecht',
    'leasehold': 'baurecht',
    'cooperative': 'genossenschaft'
  };

  return ownershipMap[ownershipType.toLowerCase().trim()] || 'other';
}
