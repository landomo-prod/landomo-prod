import { StandardProperty, AustrianSpecificFields } from '@landomo/core';
import { ImmoScout24Property, PropertyObjectData } from '../types/immoscout24Types';

/**
 * Transform ImmoScout24 property to StandardProperty format
 */
export function transformImmoScout24ToStandard(
  property: ImmoScout24Property
): StandardProperty & Record<string, any> {
  const obj = property.objectData || {};
  const price = obj.priceInformation?.price || 0;
  const sqm = obj.area?.livingArea || obj.area?.usableArea;

  // Map to valid property_category for partitioned tables
  const propType = mapPropertyType(obj.characteristics?.propertyType);
  const propertyCategory = mapPropertyCategory(propType);

  return {
    // Category (required for partitioned ingestion)
    property_category: propertyCategory,

    // Basic info
    title: obj.title || obj.description?.substring(0, 100) || 'Property',
    price: price,
    currency: obj.priceInformation?.currency || 'EUR',
    property_type: mapPropertyType(obj.characteristics?.propertyType),
    transaction_type: mapTransactionType(obj.characteristics?.transactionType),
    source_url: `https://www.immobilienscout24.at/expose/${property.id}`,
    source_platform: 'immobilienscout24-at',

    // Location
    location: {
      address: buildAddress(obj.localization),
      city: obj.localization?.city || 'Unknown',
      region: obj.localization?.region || obj.localization?.district,
      country: 'Austria',
      postal_code: obj.localization?.postalCode,
      coordinates: obj.localization?.latitude && obj.localization?.longitude ? {
        lat: obj.localization.latitude,
        lon: obj.localization.longitude
      } : undefined
    },

    // Details
    details: {
      bedrooms: obj.area?.numberOfBedrooms,
      bathrooms: obj.area?.numberOfBathrooms,
      sqm: sqm,
      floor: obj.area?.floor,
      total_floors: obj.area?.totalFloors,
      rooms: obj.area?.numberOfRooms,
      year_built: obj.characteristics?.constructionYear,
      renovation_year: obj.characteristics?.renovationYear,
      parking_spaces: countParkingSpacesFromCharacteristics(obj.characteristics)
    },

    // Amenities
    amenities: extractAmenities(obj.characteristics),

    // Energy rating
    energy_rating: normalizeEnergyRating(obj.characteristics?.energyRating),

    // Price calculations
    price_per_sqm: price && sqm ? Math.round(price / sqm) : undefined,

    // Additional costs
    hoa_fees: obj.priceInformation?.operatingCosts || obj.priceInformation?.additionalCosts,

    // Media
    media: {
      images: obj.pictures?.map(pic => ({
        url: pic.url || pic.urlLarge || pic.urlMedium || '',
        thumbnail_url: pic.urlSmall,
        alt: pic.caption,
        order: pic.order,
        is_main: pic.isMainPicture,
        width: pic.width,
        height: pic.height,
        image_id: pic.id
      })),
      virtual_tour_url: obj.virtualTours?.[0]?.url,
      floor_plan_urls: obj.floorPlans?.map(fp => fp.url || '').filter(Boolean),
      total_images: obj.pictures?.length || 0
    },

    // Backward compatibility
    images: obj.pictures?.map(pic => pic.url || pic.urlLarge || pic.urlMedium || '').filter(Boolean),
    description: obj.description,
    description_language: 'de',

    // Agent info
    agent: property.contactData ? {
      name: property.contactData.name || property.contactData.company || 'Unknown',
      phone: property.contactData.phone || property.contactData.mobile,
      email: property.contactData.email,
      agency: property.contactData.agencyName || property.contactData.company,
      agency_logo: property.contactData.agencyLogo
    } : undefined,

    // Features list
    features: extractFeatures(obj),

    // Universal Tier 1 fields (also in country_specific for backward compat)
    condition: normalizeCondition(obj.characteristics?.condition),
    heating_type: normalizeHeatingType(obj.characteristics?.heatingType),
    furnished: normalizeFurnishedStatus(obj.characteristics?.furnished, obj.characteristics?.furnishedType),
    construction_type: normalizeConstructionType(obj.characteristics?.buildingType),
    available_from: undefined, // not available from immoscout24-at
    published_date: property.publishedDate,
    deposit: obj.priceInformation?.deposit,
    parking_spaces: countParkingSpacesFromCharacteristics(obj.characteristics),

    // Portal metadata (ImmoScout24-specific fields)
    portal_metadata: {
      immobilienscout24: {
        expose_id: property.id,
        property_type: obj.characteristics?.propertyType,
        property_sub_type: obj.characteristics?.propertySubType,
        transaction_type: obj.characteristics?.transactionType,
        price_type: obj.priceInformation?.priceType,
        price_interval_type: obj.priceInformation?.priceIntervalType,
        original_price: obj.priceInformation?.originalPrice,
        price_reduction: obj.priceInformation?.priceReduction,
        additional_costs: obj.priceInformation?.additionalCosts,
        heating_costs: obj.priceInformation?.heatingCosts,
        operating_costs: obj.priceInformation?.operatingCosts,
        deposit: obj.priceInformation?.deposit,
        provision_free: property.advertisementData?.provisionFree,
        advertisement_type: property.advertisementData?.advertisementType,
        external_id: property.advertisementData?.externalId,
        creation_date: property.creationDate,
        last_modification_date: property.lastModificationDate,
        published_date: property.publishedDate,
        precise_location: obj.localization?.preciseLocation,
        building_type: obj.characteristics?.buildingType,
        heating_type: obj.characteristics?.heatingType
      }
    },

    // Top-level Austrian DB columns (read by bulk-operations.ts)
    austrian_ownership: normalizeOwnershipType(obj.characteristics?.ownershipType),
    austrian_operating_costs: obj.priceInformation?.operatingCosts,
    austrian_heating_costs: obj.priceInformation?.heatingCosts,

    // Country-specific fields (Austrian real estate)
    country_specific: {
      // Condition
      condition: normalizeCondition(obj.characteristics?.condition),

      // Furnished
      furnished: normalizeFurnishedStatus(obj.characteristics?.furnished, obj.characteristics?.furnishedType),

      // Energy rating (standardized)
      energy_rating: normalizeEnergyRating(obj.characteristics?.energyRating),

      // Heating type
      heating_type: normalizeHeatingType(obj.characteristics?.heatingType),

      // Construction type
      construction_type: normalizeConstructionType(obj.characteristics?.buildingType),

      // Ownership
      ownership_type: normalizeOwnershipType(obj.characteristics?.ownershipType),

      // Building details
      building_type: normalizeBuildingType(obj.characteristics?.buildingType),
      year_built: obj.characteristics?.constructionYear,
      renovation_year: obj.characteristics?.renovationYear,

      // Cost breakdown
      operating_costs: obj.priceInformation?.operatingCosts,
      heating_costs: obj.priceInformation?.heatingCosts,

      // Areas
      area_living: obj.area?.livingArea,
      area_total: obj.area?.usableArea,
      area_plot: obj.area?.plotArea,

      // Additional Austrian-specific fields
      accessible: obj.characteristics?.accessible,
      pets_allowed: obj.characteristics?.petsAllowed
    } as AustrianSpecificFields,

    // Status
    status: 'active'
  } as StandardProperty & Record<string, any>;
}

/**
 * Map property type to valid property_category for partitioned tables
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  if (propertyType === 'apartment') return 'apartment';
  if (propertyType === 'house') return 'house';
  if (propertyType === 'land') return 'land';
  if (propertyType === 'commercial') return 'commercial';
  return 'apartment';
}

/**
 * Map ImmoScout24 property type to standard type
 */
function mapPropertyType(propertyType?: string): string {
  if (!propertyType) return 'other';

  const typeMap: Record<string, string> = {
    'APARTMENT': 'apartment',
    'HOUSE': 'house',
    'SINGLE_FAMILY_HOUSE': 'house',
    'MULTI_FAMILY_HOUSE': 'house',
    'VILLA': 'house',
    'TOWNHOUSE': 'house',
    'LAND': 'land',
    'COMMERCIAL': 'commercial',
    'OFFICE': 'commercial',
    'RETAIL': 'commercial',
    'GARAGE': 'other',
    'PARKING': 'other'
  };

  return typeMap[propertyType.toUpperCase()] || 'other';
}

/**
 * Map transaction type to standard format
 */
function mapTransactionType(transactionType?: string): 'sale' | 'rent' {
  if (!transactionType) return 'sale';

  const type = transactionType.toUpperCase();
  return type === 'RENT' || type === 'LEASE' ? 'rent' : 'sale';
}

/**
 * Build full address string from localization data
 */
function buildAddress(localization?: PropertyObjectData['localization']): string | undefined {
  if (!localization) return undefined;

  const parts: string[] = [];

  if (localization.street) {
    let streetPart = localization.street;
    if (localization.houseNumber) {
      streetPart += ` ${localization.houseNumber}`;
    }
    parts.push(streetPart);
  }

  if (localization.postalCode || localization.city) {
    const cityPart = [localization.postalCode, localization.city]
      .filter(Boolean)
      .join(' ');
    if (cityPart) parts.push(cityPart);
  }

  if (localization.district) {
    parts.push(localization.district);
  }

  return parts.length > 0 ? parts.join(', ') : localization.address;
}

/**
 * Extract amenities from characteristics
 */
function extractAmenities(
  characteristics?: PropertyObjectData['characteristics']
): StandardProperty['amenities'] {
  if (!characteristics) return {};

  return {
    has_parking: characteristics.parking,
    has_garage: characteristics.garage,
    has_garden: characteristics.garden,
    has_balcony: characteristics.balcony,
    has_terrace: characteristics.terrace,
    has_basement: characteristics.basement,
    has_elevator: characteristics.elevator,
    is_barrier_free: characteristics.accessible,
    is_pet_friendly: characteristics.petsAllowed,
    is_furnished: characteristics.furnished
  };
}

/**
 * Extract feature list for display
 */
function extractFeatures(obj: PropertyObjectData): string[] {
  const features: string[] = [];
  const chars = obj.characteristics;

  if (!chars) return features;

  // Add property characteristics
  if (chars.balcony) features.push('Balcony');
  if (chars.terrace) features.push('Terrace');
  if (chars.garden) features.push('Garden');
  if (chars.elevator) features.push('Elevator');
  if (chars.parking) features.push('Parking');
  if (chars.garage) features.push('Garage');
  if (chars.basement) features.push('Basement');
  if (chars.furnished) features.push('Furnished');
  if (chars.accessible) features.push('Barrier-free');
  if (chars.petsAllowed) features.push('Pets allowed');

  // Add condition
  if (chars.condition) {
    const conditionLabels: Record<string, string> = {
      'NEW': 'New construction',
      'REFURBISHED': 'Refurbished',
      'RENOVATED': 'Renovated',
      'NEEDS_RENOVATION': 'Needs renovation'
    };
    const label = conditionLabels[chars.condition];
    if (label) features.push(label);
  }

  // Add energy rating
  if (chars.energyRating) {
    features.push(`Energy rating: ${chars.energyRating}`);
  }

  // Add heating type
  if (chars.heatingType) {
    features.push(`Heating: ${chars.heatingType}`);
  }

  return features;
}

/**
 * Normalize condition to standard format
 */
function normalizeCondition(condition?: string): AustrianSpecificFields['condition'] {
  if (!condition) return undefined;

  const conditionMap: Record<string, AustrianSpecificFields['condition']> = {
    'NEW': 'new',
    'REFURBISHED': 'excellent',
    'RENOVATED': 'after_renovation',
    'GOOD': 'good',
    'NEEDS_RENOVATION': 'requires_renovation',
    'PROJECT': 'project',
    'UNDER_CONSTRUCTION': 'under_construction'
  };

  return conditionMap[condition.toUpperCase()] || undefined;
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

  const key = heatingType.toUpperCase().replace(/[^A-Z_]/g, '_');
  return heatingMap[key] || 'other';
}

/**
 * Normalize construction type to standard format
 */
function normalizeConstructionType(constructionType?: string): AustrianSpecificFields['construction_type'] {
  if (!constructionType) return undefined;

  const typeMap: Record<string, AustrianSpecificFields['construction_type']> = {
    // German terms
    'ziegel': 'brick',
    'beton': 'concrete',
    'holz': 'wood',
    'stein': 'stone',
    'stahl': 'steel',
    'massiv': 'masonry',
    'fertigteil': 'panel',
    'massivbau': 'masonry',
    'holzbau': 'wood',
    'stahlbeton': 'concrete',
    'ziegelbau': 'brick',
    'steinbau': 'stone',
    'stahlbau': 'steel',
    'gemischt': 'mixed',
    // English terms
    'brick': 'brick',
    'concrete': 'concrete',
    'wood': 'wood',
    'stone': 'stone',
    'steel': 'steel',
    'masonry': 'masonry',
    'panel': 'panel',
    'mixed': 'mixed',
    'other': 'other'
  };

  return typeMap[constructionType.toLowerCase().trim()];
}

/**
 * Normalize building type to standard format
 */
function normalizeBuildingType(buildingType?: string): string | undefined {
  if (!buildingType) return undefined;

  const typeMap: Record<string, string> = {
    // German terms
    'einfamilienhaus': 'detached',
    'einzelhaus': 'detached',
    'mehrfamilienhaus': 'apartment_building',
    'reihenhaus': 'terraced',
    'reihenmittelhaus': 'terraced',
    'reiheneckhaus': 'terraced',
    'doppelhaushälfte': 'semi_detached',
    'doppelhaus': 'semi_detached',
    'villa': 'villa',
    'bungalow': 'bungalow',
    'wohnhaus': 'residential',
    'stadthaus': 'townhouse',
    'ferienhaus': 'holiday_home',
    'bauernhaus': 'farmhouse',
    'landhaus': 'country_house',
    'chalet': 'chalet',
    // English terms
    'detached': 'detached',
    'detached house': 'detached',
    'semi-detached': 'semi_detached',
    'semi detached': 'semi_detached',
    'terraced': 'terraced',
    'terraced house': 'terraced',
    'apartment building': 'apartment_building',
    'apartment_building': 'apartment_building',
    'townhouse': 'townhouse',
    'residential': 'residential',
    'holiday home': 'holiday_home',
    'farmhouse': 'farmhouse',
    'country house': 'country_house'
  };

  const normalized = buildingType.toLowerCase().trim();
  return typeMap[normalized];
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
 * Normalize furnished status with partial support
 */
function normalizeFurnishedStatus(furnished?: boolean, furnishedType?: string): AustrianSpecificFields['furnished'] {
  if (furnishedType) {
    const typeMap: Record<string, AustrianSpecificFields['furnished']> = {
      'FULLY_FURNISHED': 'furnished',
      'FURNISHED': 'furnished',
      'PARTIALLY_FURNISHED': 'partially_furnished',
      'PARTLY': 'partially_furnished',
      'UNFURNISHED': 'not_furnished',
      'NOT_FURNISHED': 'not_furnished'
    };
    return typeMap[furnishedType.toUpperCase()] || (furnished ? 'furnished' : 'not_furnished');
  }

  if (furnished === undefined || furnished === null) return undefined;
  return furnished ? 'furnished' : 'not_furnished';
}

/**
 * Count parking spaces from property characteristics
 * If explicit count not available, infer 1 from parking/garage boolean flags
 */
function countParkingSpacesFromCharacteristics(
  characteristics?: PropertyObjectData['characteristics']
): number | undefined {
  if (!characteristics) return undefined;

  // Count from boolean flags
  let count = 0;
  if (characteristics.parking) count++;
  if (characteristics.garage) count++;

  return count > 0 ? count : undefined;
}
