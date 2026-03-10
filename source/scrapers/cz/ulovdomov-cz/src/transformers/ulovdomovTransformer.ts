import { StandardProperty, PropertyImage, CzechSpecificFields } from '@landomo/core';
import {
  normalizeDisposition,
  normalizeCondition,
  normalizeFurnished,
  normalizeConstructionType,
  normalizeOwnership,
  normalizeEnergyRating,
  normalizeHeatingType
} from '../../../shared/czech-value-mappings';
import { UlovDomovOffer, UlovDomovDetailParameters } from '../types/ulovdomovTypes';

/**
 * Transform UlovDomov listing to StandardProperty format
 *
 * Combines listing API data with detail page __NEXT_DATA__ parameters.
 * Detail data is stored in offer._detail when available.
 */
export function transformUlovDomovToStandard(offer: UlovDomovOffer): StandardProperty & Record<string, any> {
  const propertyCategory = mapPropertyType(offer.propertyType);
  const price = offer.rentalPrice?.value ?? null;
  const richImages: PropertyImage[] = (offer.photos || []).map((p, i) => ({
    url: p.path,
    alt: p.alt || undefined,
    image_id: String(p.id),
    order: i,
  }));
  const imageUrls = richImages.map(img => img.url);
  const allConvenience = [...(offer.convenience || []), ...(offer.houseConvenience || [])];

  // Detail page data
  const params = offer._detail?.parameters;
  const owner = offer._detail?.owner;
  const detailDistrict = offer._detail?.district?.name;
  const detailRegion = offer._detail?.region?.name;
  const publishedAt = offer._detail?.publishedAt;
  const matterportUrl = offer._detail?.matterportUrl;

  // Extract normalized values from detail page parameters
  const energyClass = normalizeEnergyRating(getFirstOptionId(params?.energyEfficiencyRating));
  const condition = normalizeCondition(mapUlovDomovCondition(getFirstOptionId(params?.buildingCondition)));
  const constructionType = normalizeConstructionType(mapUlovDomovMaterial(getFirstOptionId(params?.material)));
  const furnished = normalizeFurnished(mapUlovDomovFurnished(getFirstOptionId(params?.furnished)));
  const ownership = normalizeOwnership(mapUlovDomovOwnership(getFirstOptionId(params?.ownership)));
  const heatingType = normalizeHeatingType(mapUlovDomovHeating(getFirstOptionId(params?.heating)));
  const yearBuilt = parseYearBuilt(params?.acceptanceYear?.value);
  const renovationYear = parseRenovationYear(params?.reconstructionYear?.value);
  const totalFloors = typeof params?.floors?.value === 'number' ? params.floors.value : undefined;
  const gardenArea = parseAreaValue(params?.gardenArea?.value);
  const estateArea = parseAreaValue(params?.estateArea?.value);
  const hasPool = paramIsYes(params?.pool?.value) || hasConvenience(allConvenience, 'pool') || undefined;
  const hasElevator = paramIsYes(params?.lift?.value) || hasConvenience(allConvenience, 'elevator') || undefined;
  const isLowEnergy = paramIsYes(params?.lowEnergy?.value);
  const isBarrierFree = paramIsYes(params?.wheelchairAccessible?.value);

  // Published date: prefer detail page publishedAt, fall back to API published
  const publishedDate = parseCzechDate(publishedAt) || offer.published;

  // Agent info from detail page owner block
  const agentName = owner ? [owner.firstName, owner.surname].filter(Boolean).join(' ') : undefined;
  const agent = agentName ? {
    name: agentName,
    phone: owner?.phone || undefined,
  } : undefined;

  // Features from convenience arrays
  const features = buildFeatures(allConvenience);

  // Floor location classification (now with total_floors for top_floor detection)
  const floorLocation = classifyFloorLocation(offer.floorLevel, totalFloors);

  // Category-specific Tier I fields
  const categoryFields = buildCategoryFields(propertyCategory, offer, allConvenience, {
    totalFloors,
    gardenArea,
    estateArea,
    hasPool,
    hasElevator,
    floorLocation,
  });

  // Classify property_type for land and commercial
  const propertyType = (propertyCategory === 'land')
    ? classifyLandPropertyType(offer.title || '')
    : (propertyCategory === 'commercial')
      ? classifyCommercialPropertyType(offer.title || '')
      : propertyCategory;

  return {
    // Basic info
    title: offer.title || 'Unknown',
    price: price as any,
    currency: 'CZK',
    property_type: propertyType,
    property_category: propertyCategory,
    transaction_type: offer.offerType === 'sale' ? 'sale' : 'rent',
    source_url: offer.absoluteUrl || `https://www.ulovdomov.cz/inzerat/${offer.seo}/${offer.id}`,
    source_platform: 'ulovdomov',
    portal_id: String(offer.id),

    // Czech country fields (top-level for DB column)
    czech_disposition: normalizeDisposition(camelToDisposition(offer.disposition)),

    // Classification
    property_subtype: mapPropertySubtype(propertyCategory, offer),

    // Category-specific Tier I fields
    ...categoryFields,

    // Location
    location: {
      address: buildAddress(offer),
      city: offer.village?.title || 'Unknown',
      region: detailRegion || undefined,
      country: 'Czech Republic',
      coordinates: offer.geoCoordinates ? {
        lat: offer.geoCoordinates.lat,
        lon: offer.geoCoordinates.lng
      } : undefined
    },

    // Details
    details: {
      bedrooms: extractBedrooms(offer.disposition),
      sqm: offer.area,
      floor: offer.floorLevel ?? undefined,
      total_floors: totalFloors,
      rooms: extractRooms(offer.disposition),
      year_built: yearBuilt,
      renovation_year: renovationYear,
      parking_spaces: hasConvenience(allConvenience, 'parking') ? 1 : undefined,
    },

    price_per_sqm: price != null && offer.area ? Math.round(price / offer.area) : undefined,

    // Universal Tier 1 fields
    energy_class: energyClass,
    condition,
    furnished: furnished as any,
    construction_type: constructionType,
    heating_type: heatingType,
    year_built: yearBuilt,
    renovation_year: renovationYear,
    available_from: offer.availableFrom || undefined,
    published_date: publishedDate,
    deposit: offer.depositPrice?.value || undefined,
    hoa_fees: offer.monthlyFeesPrice?.value || undefined,
    is_commission: offer.isNoCommission === true ? false : offer.isNoCommission === false ? true : undefined,
    commission_note: offer.priceNote || undefined,
    parking_spaces: hasConvenience(allConvenience, 'parking') ? 1 : undefined,

    // Agent
    agent,

    // Features
    features,

    // Portal metadata (UlovDomov-specific)
    portal_metadata: {
      ulovdomov: {
        id: offer.id,
        url: offer.absoluteUrl,
        offer_type: offer.offerType,
        property_type: offer.propertyType,
        disposition: offer.disposition,
        house_type: offer.houseType,
        floor_level: offer.floorLevel,
        price_unit: offer.priceUnit,
        price_note: offer.priceNote,
        is_no_commission: offer.isNoCommission,
        monthly_fees: offer.monthlyFeesPrice?.value,
        deposit: offer.depositPrice?.value,
        convenience: offer.convenience,
        house_convenience: offer.houseConvenience,
        village: offer.village?.title,
        village_part: offer.villagePart?.title,
        street: offer.street?.title,
        geo: offer.geoCoordinates,
        published: offer.published,
        available_from: offer.availableFrom,
        is_top: offer.isTop,
        matterport_url: matterportUrl || undefined,
      }
    },

    // Country-specific (Czech Republic) - TIER 2
    country_specific: {
      czech_disposition: normalizeDisposition(camelToDisposition(offer.disposition)),
      czech_ownership: ownership,
      condition,
      furnished: furnished as any,
      energy_rating: energyClass,
      heating_type: heatingType,
      construction_type: constructionType,
      area_living: offer.area,
      area_plot: estateArea,
      area_garden: gardenArea,
      year_built: yearBuilt,
      renovation_year: renovationYear,
      total_floors: totalFloors,
      low_energy: isLowEnergy || undefined,
      floor_number: offer.floorLevel,
      floor_location: floorLocation,
      district: detailDistrict || offer.villagePart?.title,
      city: offer.village?.title,
      street: offer.street?.title,
      coordinates: offer.geoCoordinates ? {
        lat: offer.geoCoordinates.lat,
        lon: offer.geoCoordinates.lng
      } : undefined,
      image_urls: imageUrls,
      image_count: imageUrls.length,
      published_date: publishedDate,
      available_from: offer.availableFrom,
      virtual_tour_url: matterportUrl || undefined,
    } as CzechSpecificFields,

    // Amenities
    amenities: {
      has_parking: hasConvenience(allConvenience, 'parking'),
      has_balcony: hasConvenience(allConvenience, 'balcony'),
      has_terrace: hasConvenience(allConvenience, 'terrace'),
      has_basement: hasConvenience(allConvenience, 'cellar'),
      has_elevator: hasElevator ?? undefined,
      has_garden: hasConvenience(allConvenience, 'garden'),
      has_garage: hasConvenience(allConvenience, 'garage'),
      has_pool: hasPool ?? undefined,
      is_barrier_free: isBarrierFree || undefined,
      is_low_energy: isLowEnergy || undefined,
    },

    // Media
    media: {
      images: richImages,
      total_images: richImages.length,
      virtual_tour_url: matterportUrl || undefined,
    },

    images: imageUrls,
    description: offer.description,
    description_language: 'cs',
    status: 'active'
  };
}

// ============================================================================
// Detail Page Parameter Helpers
// ============================================================================

/** Get the first option ID from a parameter with options array */
function getFirstOptionId(param: { options?: { id: string }[] } | undefined): string | undefined {
  return param?.options?.[0]?.id;
}

/** Check if a parameter value is "Ano" (Yes) */
function paramIsYes(value: string | number | undefined): boolean {
  if (typeof value === 'string') return value.toLowerCase() === 'ano';
  return false;
}

/** Parse an area value like "22 m2" or "104 m2" to a number */
function parseAreaValue(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/^([\d.,]+)/);
    if (match) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      return isNaN(parsed) ? undefined : parsed;
    }
  }
  return undefined;
}

/** Parse year built from acceptanceYear value, validate range */
function parseYearBuilt(value: string | number | undefined): number | undefined {
  if (!value) return undefined;
  const year = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(year) || year < 1800 || year > 2100) return undefined;
  return year;
}

/** Parse renovation year, skip if 0 */
function parseRenovationYear(value: string | number | undefined): number | undefined {
  if (!value) return undefined;
  const year = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(year) || year === 0) return undefined;
  if (year < 1800 || year > 2100) return undefined;
  return year;
}

/** Parse Czech date format DD.MM.YYYY to ISO string */
function parseCzechDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Already ISO format or similar
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr;
  return dateStr;
}

// ============================================================================
// UlovDomov Value Mappers → Czech Canonical Values
// ============================================================================

/** Map UlovDomov buildingCondition IDs to strings the normalizer understands */
function mapUlovDomovCondition(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    'new': 'new',
    'veryGood': 'very_good',
    'good': 'good',
    'bad': 'requires_renovation',
    'afterReconstruction': 'after_renovation',
    'beforeReconstruction': 'before_renovation',
    'inConstruction': 'under_construction',
    'project': 'project',
  };
  return map[id] || id;
}

/** Map UlovDomov material IDs to strings the normalizer understands */
function mapUlovDomovMaterial(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    'brick': 'brick',
    'panel': 'panel',
    'mixed': 'mixed',
    'skeleton': 'concrete',
    'wood': 'wood',
    'stone': 'stone',
    'other': 'other',
  };
  return map[id] || id;
}

/** Map UlovDomov furnished IDs to strings the normalizer understands */
function mapUlovDomovFurnished(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    'complete': 'furnished',
    'partial': 'partially_furnished',
    'no': 'not_furnished',
  };
  return map[id] || id;
}

/** Map UlovDomov ownership IDs to strings the normalizer understands */
function mapUlovDomovOwnership(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    'personal': 'personal',
    'cooperative': 'cooperative',
    'state': 'state',
    'other': 'other',
  };
  return map[id] || id;
}

/** Map UlovDomov heating IDs to strings the normalizer understands */
function mapUlovDomovHeating(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    'central': 'central_heating',
    'local': 'individual_heating',
    'electric': 'electric_heating',
    'gas': 'gas_heating',
    'heatPump': 'heat_pump',
    'other': 'other',
  };
  return map[id] || id;
}

// ============================================================================
// Land Utility Mappers
// ============================================================================

/** Map UlovDomov water/gully (sewage) option IDs to utility status */
function mapUtilityStatus(id: string | undefined): 'mains' | 'well' | 'connection_available' | 'none' | undefined {
  if (!id) return undefined;
  const map: Record<string, 'mains' | 'well' | 'connection_available' | 'none'> = {
    'yes': 'mains',
    'public': 'mains',
    'own': 'well',
    'well': 'well',
    'nearby': 'connection_available',
    'no': 'none',
  };
  return map[id] || undefined;
}

/** Map UlovDomov gas option IDs to gas status */
function mapGasStatus(id: string | undefined): 'connected' | 'connection_available' | 'none' | undefined {
  if (!id) return undefined;
  const map: Record<string, 'connected' | 'connection_available' | 'none'> = {
    'yes': 'connected',
    'public': 'connected',
    'nearby': 'connection_available',
    'no': 'none',
  };
  return map[id] || undefined;
}

/** Map electricity status from parameters (UlovDomov doesn't have a dedicated field, infer from context) */
function mapElectricityStatus(_params: UlovDomovDetailParameters | undefined): 'connected' | 'connection_available' | 'none' | undefined {
  // UlovDomov doesn't expose a dedicated electricity parameter in __NEXT_DATA__
  return undefined;
}

// ============================================================================
// Features Builder
// ============================================================================

/** Build features array from convenience items */
function buildFeatures(allConvenience: string[]): string[] {
  const features: string[] = [];
  const featureMap: Record<string, string> = {
    'dishwasher': 'dishwasher',
    'fridge': 'fridge',
    'washingMachine': 'washing_machine',
    'dryer': 'dryer',
    'balcony': 'balcony',
    'terrace': 'terrace',
    'cellar': 'basement',
    'garden': 'garden',
    'garage': 'garage',
    'parking': 'parking',
    'elevator': 'elevator',
    'lift': 'elevator',
    'loggia': 'loggia',
    'pool': 'pool',
    'furnished': 'furnished',
    'partiallyFurnished': 'partially_furnished',
  };

  for (const item of allConvenience) {
    const mapped = featureMap[item];
    if (mapped && !features.includes(mapped)) {
      features.push(mapped);
    }
  }

  return features;
}

// ============================================================================
// Existing Helper Functions
// ============================================================================

/**
 * Build category-specific Tier I fields based on property category
 */
function buildCategoryFields(
  category: string,
  offer: UlovDomovOffer,
  allConvenience: string[],
  detail: {
    totalFloors?: number;
    gardenArea?: number;
    estateArea?: number;
    hasPool?: boolean;
    hasElevator?: boolean;
    floorLocation?: string;
  }
): Record<string, any> {
  const bedrooms = extractBedrooms(offer.disposition);
  const sqm = offer.area ?? null;

  switch (category) {
    case 'apartment':
      return {
        sqm: sqm ?? null,
        bedrooms,
        bathrooms: 1,
        floor: offer.floorLevel ?? undefined,
        total_floors: detail.totalFloors,
        floor_location: detail.floorLocation,
        has_elevator: (detail.hasElevator || hasConvenience(allConvenience, 'elevator')) ?? undefined,
        has_balcony: hasConvenience(allConvenience, 'balcony') ?? undefined,
        has_loggia: hasConvenience(allConvenience, 'loggia'),
        has_parking: hasConvenience(allConvenience, 'parking') ?? undefined,
        has_basement: hasConvenience(allConvenience, 'cellar') ?? undefined,
        has_terrace: hasConvenience(allConvenience, 'terrace'),
      };
    case 'house':
      return {
        sqm_living: sqm,
        sqm_plot: detail.estateArea ?? null,
        bedrooms,
        bathrooms: 1,
        has_garden: (hasConvenience(allConvenience, 'garden') || (detail.gardenArea != null && detail.gardenArea > 0)) ?? undefined,
        has_garage: hasConvenience(allConvenience, 'garage') ?? undefined,
        has_parking: hasConvenience(allConvenience, 'parking') ?? undefined,
        has_basement: hasConvenience(allConvenience, 'cellar') ?? undefined,
        has_pool: detail.hasPool ?? undefined,
        garden_area: detail.gardenArea,
      };
    case 'land': {
      const params = offer._detail?.parameters;
      return {
        area_plot_sqm: detail.estateArea || sqm || null,
        water_supply: mapUtilityStatus(getFirstOptionId(params?.water)),
        sewage: mapUtilityStatus(getFirstOptionId(params?.gully)),
        gas: mapGasStatus(getFirstOptionId(params?.gas)),
        electricity: mapElectricityStatus(params),
      };
    }
    case 'commercial':
      return {
        sqm_total: sqm,
        has_elevator: (detail.hasElevator || hasConvenience(allConvenience, 'elevator')) ?? undefined,
        has_parking: hasConvenience(allConvenience, 'parking') ?? undefined,
        has_bathrooms: 1,
      };
    default:
      return {};
  }
}

/**
 * Map UlovDomov property type (lowercase) to standard category
 */
function mapPropertyType(propertyType?: string): string {
  const typeMap: Record<string, string> = {
    'flat': 'apartment',
    'house': 'house',
    'room': 'apartment',
    'land': 'land',
    'commercial': 'commercial'
  };
  return propertyType ? (typeMap[propertyType] || 'other') : 'other';
}

/**
 * Build full address string
 */
function buildAddress(offer: UlovDomovOffer): string | undefined {
  const parts = [
    offer.street?.title,
    offer.villagePart?.title,
    offer.village?.title
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Check if a convenience feature is present
 */
function hasConvenience(conveniences: string[], feature: string): boolean | undefined {
  if (!conveniences || conveniences.length === 0) return undefined;
  if (feature === 'elevator') {
    return (conveniences.includes('elevator') || conveniences.includes('lift')) ? true : undefined;
  }
  return conveniences.includes(feature) ? true : undefined;
}

/**
 * Convert camelCase disposition (onePlusKk) to Czech format (1+kk)
 */
function camelToDisposition(disposition: string | null | undefined): string | undefined {
  if (!disposition) return undefined;

  const map: Record<string, string> = {
    'onePlusKk': '1+kk',
    'onePlusOne': '1+1',
    'twoPlusKk': '2+kk',
    'twoPlusOne': '2+1',
    'threePlusKk': '3+kk',
    'threePlusOne': '3+1',
    'fourPlusKk': '4+kk',
    'fourPlusOne': '4+1',
    'fivePlusKk': '5+kk',
    'fivePlusOne': '5+1',
    'sixPlusKk': '6+kk',
    'sixPlusOne': '6+1',
    'sevenPlusKk': '7+kk',
    'sevenPlusOne': '7+1',
    'sixAndMore': 'atypical',
    'atypical': 'atypical',
    'atelier': 'atelier',
    'studio': '1+kk',
  };

  return map[disposition] || disposition;
}

/**
 * Extract bedroom count from camelCase disposition
 */
function extractBedrooms(disposition: string | null | undefined): number | undefined {
  const czech = camelToDisposition(disposition);
  if (!czech) return undefined;

  const match = czech.match(/^(\d)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract total room count from camelCase disposition
 */
function extractRooms(disposition: string | null | undefined): number | undefined {
  const czech = camelToDisposition(disposition);
  if (!czech) return undefined;

  const match = czech.match(/^(\d)\+(\d|kk)/i);
  if (!match) return undefined;

  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1;
  return baseRooms + additional;
}

/**
 * Classify floor location from floor level number and total floors
 */
function classifyFloorLocation(floorLevel: number | null | undefined, totalFloors?: number): 'ground_floor' | 'middle_floor' | 'top_floor' | undefined {
  if (floorLevel === null || floorLevel === undefined) return undefined;
  if (floorLevel === 0) return 'ground_floor';
  if (totalFloors && floorLevel >= totalFloors) return 'top_floor';
  return 'middle_floor';
}

/**
 * Classify land property_type from Czech title
 */
function classifyLandPropertyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('stavební')) return 'building_plot';
  if (t.includes('pole') || t.includes('orná')) return 'field';
  if (t.includes('zahrad')) return 'garden';
  if (t.includes('les')) return 'forest';
  if (t.includes('komerční')) return 'commercial_plot';
  if (t.includes('louk')) return 'meadow';
  if (t.includes('sad') || t.includes('vinic')) return 'orchard';
  if (t.includes('rybník') || t.includes('vodní')) return 'water';
  return 'other';
}

/**
 * Classify commercial property_type from Czech title
 */
function classifyCommercialPropertyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('kancelář') || t.includes('kancelar')) return 'office';
  if (t.includes('sklad')) return 'warehouse';
  if (t.includes('obchod')) return 'retail';
  if (t.includes('výrob') || t.includes('hal')) return 'production';
  if (t.includes('restaur')) return 'restaurant';
  if (t.includes('ubytovací') || t.includes('hotel') || t.includes('penzion')) return 'accommodation';
  if (t.includes('činžovní')) return 'apartment_building';
  if (t.includes('ordinac')) return 'medical_office';
  if (t.includes('zemědělský')) return 'agricultural';
  return 'other';
}

/**
 * Map property subtype from portal data
 */
function mapPropertySubtype(category: string, offer: UlovDomovOffer): string | undefined {
  if (category === 'apartment') {
    if (offer.disposition === 'studio') return 'studio';
    if (offer.disposition === 'atelier') return 'atelier';
    return undefined;
  }

  if (category === 'house' && offer.houseType) {
    const houseTypeMap: Record<string, string> = {
      'familyHouse': 'detached',
      'villa': 'villa',
      'cottage': 'cottage',
      'chalet': 'cottage',
      'farmhouse': 'farmhouse',
      'townhouse': 'townhouse',
      'bungalow': 'bungalow',
      'semiDetached': 'semi_detached',
      'terraced': 'terraced',
    };
    return houseTypeMap[offer.houseType] || undefined;
  }

  return undefined;
}
