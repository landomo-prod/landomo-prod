import { StandardProperty, SlovakSpecificFields } from '@landomo/core';
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeFurnished,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType
} from '../shared/slovak-value-mappings';
import { NehnutelnostiListing } from '../types/nehnutelnostiTypes';

/**
 * Transform Nehnutelnosti.sk listing to StandardProperty format
 */
export function transformNehnutelnostiToStandard(listing: NehnutelnostiListing): StandardProperty & Record<string, any> {
  const sqm = extractSqm(listing);
  const propertyId = String(listing.id || listing.hash_id || '');

  return {
    // Category (required for partition routing)
    property_category: mapPropertyType(listing.property_type || listing.category) as 'apartment' | 'house' | 'land',

    // Basic info
    title: listing.name || listing.title || listing.headline || 'Unknown',
    price: listing.price || listing.price_value || listing.price_eur || 0,
    currency: listing.currency || 'EUR',
    property_type: mapPropertyType(listing.property_type || listing.category),
    transaction_type: mapTransactionType(listing.transaction_type),
    source_url: ensureAbsoluteUrl(listing.url || listing.detail_url || `/detail/${propertyId}`),

    // Location
    location: {
      address: listing.address || listing.locality,
      city: extractCity(listing.city || listing.locality || ''),
      region: listing.region || listing.district,
      country: 'sk',
      coordinates: extractCoordinates(listing)
    },

    // Details
    details: {
      bedrooms: extractBedrooms(listing),
      bathrooms: listing.bathrooms ?? extractBathrooms(listing),
      sqm: sqm,
      floor: extractFloor(listing),
      total_floors: listing.total_floors,
      rooms: listing.rooms || extractRoomsFromDisposition(listing.disposition),
      renovation_year: extractRenovationYear(listing),
      parking_spaces: extractParkingSpaces(listing),
    },

    // Detail-enriched boolean amenities (promoted to top level for apartment/house TierI)
    ...(listing.year_built !== undefined ? { year_built: listing.year_built } : {}),
    ...(listing.has_elevator !== undefined ? { has_elevator: listing.has_elevator } : {}),
    ...(listing.has_balcony !== undefined ? { has_balcony: listing.has_balcony } : {}),
    ...(listing.has_basement !== undefined ? { has_basement: listing.has_basement } : {}),
    ...(listing.has_parking !== undefined ? { has_parking: listing.has_parking } : {}),

    // Financial details
    price_per_sqm: listing.price && sqm ? Math.round(listing.price / sqm) : undefined,

    // Portal metadata (Nehnutelnosti.sk-specific fields)
    portal_metadata: {
      nehnutelnosti: {
        id: propertyId,
        category: listing.category,
        category_main_cb: listing.category_main_cb,
        category_type_cb: listing.category_type_cb,
        locality: listing.locality,
        district: listing.district,
        price_note: listing.price_note,
        image_count: listing.image_count || listing.photo_count,
        is_active: listing.is_active,
        created_at: listing.created_at,
        updated_at: listing.updated_at
      }
    },

    // Universal Tier 1 fields (promoted from country_specific for cross-country querying)
    condition: mapConditionToEnglish(normalizeCondition(listing.condition)) as SlovakSpecificFields['condition'],
    heating_type: mapHeatingToEnglish(normalizeHeatingType(listing.heating)) as SlovakSpecificFields['heating_type'],
    furnished: mapFurnishedToEnglish(normalizeFurnished(listing.furnished)),
    construction_type: mapConstructionToEnglish(normalizeConstructionType(listing.construction_type)) as SlovakSpecificFields['construction_type'],
    available_from: extractAvailableFrom(listing),
    published_date: listing.published_at || listing.created_at,
    deposit: extractDeposit(listing),
    parking_spaces: extractParkingSpaces(listing),

    // Country-specific fields (Slovakia) - uses SlovakSpecificFields interface
    country_specific: {
      disposition: normalizeDisposition(listing.disposition),
      ownership: mapOwnershipToEnglish(normalizeOwnership(listing.ownership)),
      condition: mapConditionToEnglish(normalizeCondition(listing.condition)) as SlovakSpecificFields['condition'],
      furnished: mapFurnishedToEnglish(normalizeFurnished(listing.furnished)),
      energy_rating: normalizeEnergyRating(listing.energy_rating),
      heating_type: mapHeatingToEnglish(normalizeHeatingType(listing.heating)) as SlovakSpecificFields['heating_type'],
      construction_type: mapConstructionToEnglish(normalizeConstructionType(listing.construction_type)) as SlovakSpecificFields['construction_type']
    },
    // Dedicated DB columns for bulk-operations extraction
    ...({ slovak_disposition: normalizeDisposition(listing.disposition), slovak_ownership: normalizeOwnership(listing.ownership) } as Record<string, unknown>),

    // Media
    images: extractImages(listing),
    description: listing.description || listing.text,
    description_language: 'sk',

    // Features
    features: listing.features || listing.amenities || listing.equipment,

    // Status
    status: listing.status === 'active' || listing.is_active ? 'active' : 'removed'
  };
}

/**
 * Map property type to standard type
 */
/**
 * SAFETY FIX: Commercial/recreational/garage/studio mapped to appropriate categories
 * to prevent transformation errors. Full category routing pending - see task #14
 */
function mapPropertyType(type?: string): string {
  if (!type) return 'house';  // Default to house instead of 'other'

  const typeMap: Record<string, string> = {
    'byt': 'apartment',
    'byty': 'apartment',
    'apartment': 'apartment',
    'apartments': 'apartment',
    'dom': 'house',
    'domy': 'house',
    'house': 'house',
    'houses': 'house',
    'rodinný dom': 'house',
    'rodinny dom': 'house',
    'pozemok': 'land',
    'pozemky': 'land',
    'land': 'land',
    'lands': 'land',
    // Safety mappings to prevent data loss
    'komerčné': 'house',      // commercial buildings
    'komercne': 'house',
    'commercial': 'house',
    'garáž': 'house',         // garages
    'garaz': 'house',
    'garsónka': 'apartment',  // studio apartments
    'garsonka': 'apartment',
    'studio': 'apartment'
  };

  const normalized = type.toLowerCase().trim();
  return typeMap[normalized] || 'house';  // Default to house instead of 'other'
}

/**
 * Map transaction type
 */
function mapTransactionType(type?: string): 'sale' | 'rent' {
  if (!type) return 'sale';

  const normalized = type.toLowerCase().trim();

  if (normalized.includes('prenajom') || normalized.includes('rent') || normalized.includes('najom')) {
    return 'rent';
  }

  return 'sale';
}

/**
 * Extract coordinates from various possible fields
 */
function extractCoordinates(listing: NehnutelnostiListing): { lat: number; lon: number } | undefined {
  // Try location object first
  if (listing.location?.lat && listing.location?.lon) {
    return {
      lat: listing.location.lat,
      lon: listing.location.lon
    };
  }

  if (listing.location?.latitude && listing.location?.longitude) {
    return {
      lat: listing.location.latitude,
      lon: listing.location.longitude
    };
  }

  // Try gps object
  if (listing.gps?.lat && listing.gps?.lon) {
    return {
      lat: listing.gps.lat,
      lon: listing.gps.lon
    };
  }

  if (listing.gps?.latitude && listing.gps?.longitude) {
    return {
      lat: listing.gps.latitude,
      lon: listing.gps.longitude
    };
  }

  return undefined;
}

/**
 * Extract city from locality string
 */
function extractCity(locality: string): string {
  if (!locality) return 'Unknown';

  // Extract city from "Bratislava - Staré Mesto" → "Bratislava"
  const cityMatch = locality.match(/^([^,-]+)/);
  return cityMatch ? cityMatch[1].trim() : locality.split(/[-,]/)[0]?.trim() || locality;
}

/**
 * Extract bedroom count from rooms or disposition
 */
function extractBedrooms(listing: NehnutelnostiListing): number | undefined {
  // Direct rooms count
  if (listing.rooms && listing.rooms > 0) {
    return listing.rooms;
  }

  // Extract from disposition
  if (listing.disposition) {
    const match = listing.disposition.match(/(\d)\s*[-\s]?izb/i);
    return match ? parseInt(match[1]) : undefined;
  }

  // Look in items array
  if (listing.items) {
    const roomItem = listing.items.find(i =>
      i.name?.toLowerCase().includes('počet izieb') ||
      i.name?.toLowerCase().includes('pocet izieb') ||
      i.name?.toLowerCase().includes('rooms')
    );
    if (roomItem?.value) {
      const numMatch = roomItem.value.match(/(\d+)/);
      return numMatch ? parseInt(numMatch[1]) : undefined;
    }
  }

  return undefined;
}

/**
 * Extract bathroom count
 */
function extractBathrooms(listing: NehnutelnostiListing): number | undefined {
  // Look in items array
  if (listing.items) {
    const bathroomItem = listing.items.find(i =>
      i.name?.toLowerCase().includes('kúpeľ') ||
      i.name?.toLowerCase().includes('kupel') ||
      i.name?.toLowerCase().includes('bathroom') ||
      i.name?.toLowerCase().includes('wc')
    );
    if (bathroomItem?.value) {
      const numMatch = bathroomItem.value.match(/(\d+)/);
      return numMatch ? parseInt(numMatch[1]) : undefined;
    }
  }

  // Default to 1 for apartments/houses
  return 1;
}

/**
 * Extract square meters (living area)
 */
function extractSqm(listing: NehnutelnostiListing): number | undefined {
  // Direct area fields
  if (listing.area) return listing.area;
  if (listing.usable_area) return listing.usable_area;
  if (listing.floor_area) return listing.floor_area;

  // Look in items array
  if (listing.items) {
    const areaItem = listing.items.find(i =>
      i.name?.toLowerCase().includes('výmera') ||
      i.name?.toLowerCase().includes('vymera') ||
      i.name?.toLowerCase().includes('plocha') ||
      i.name?.toLowerCase().includes('area')
    );

    if (areaItem?.value) {
      // Extract number from "75 m²" or "75"
      const match = areaItem.value.replace(/\s/g, '').match(/(\d+)/);
      return match ? parseFloat(match[1]) : undefined;
    }
  }

  return undefined;
}

/**
 * Extract floor number
 */
function extractFloor(listing: NehnutelnostiListing): number | undefined {
  // Direct floor field
  if (listing.floor !== undefined) return listing.floor;
  if (listing.floor_number !== undefined) return listing.floor_number;

  // Look in items array
  if (listing.items) {
    const floorItem = listing.items.find(i =>
      i.name?.toLowerCase().includes('poschodie') ||
      i.name?.toLowerCase().includes('podlaž') ||
      i.name?.toLowerCase().includes('floor')
    );

    if (floorItem?.value) {
      const value = floorItem.value.toLowerCase();

      // Check for ground floor
      if (value.includes('prízemie') || value.includes('prizemie') || value.includes('ground')) {
        return 0;
      }

      // Extract number
      const match = value.match(/(\d+)/);
      return match ? parseInt(match[1]) : undefined;
    }
  }

  return undefined;
}

/**
 * Extract rooms from disposition string
 */
function extractRoomsFromDisposition(disposition?: string): number | undefined {
  if (!disposition) return undefined;

  // Extract from "2-izbový" or "3 izbový"
  const match = disposition.match(/(\d)\s*[-\s]?izb/i);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract images from various possible fields
 */
function extractImages(listing: NehnutelnostiListing): string[] {
  const images: string[] = [];

  // Direct images array
  if (listing.images && Array.isArray(listing.images)) {
    images.push(...listing.images);
  }

  // Photos array
  if (listing.photos && Array.isArray(listing.photos)) {
    listing.photos.forEach(photo => {
      if (typeof photo === 'string') {
        images.push(photo);
      } else if (photo.url) {
        images.push(photo.url);
      } else if (photo.href) {
        images.push(photo.href);
      } else if (photo.src) {
        images.push(photo.src);
      }
    });
  }

  // _links.images
  if (listing._links?.images) {
    listing._links.images.forEach(img => {
      if (img.href) {
        images.push(img.href);
      }
    });
  }

  // _links.photos
  if (listing._links?.photos) {
    listing._links.photos.forEach(photo => {
      if (photo.href) {
        images.push(photo.href);
      }
    });
  }

  // Remove duplicates
  return [...new Set(images)];
}

/**
 * Map Slovak ownership to English canonical values for SlovakSpecificFields
 */
function mapOwnershipToEnglish(slovakOwnership: any): 'personal' | 'cooperative' | 'state' | 'municipal' | 'other' | undefined {
  if (!slovakOwnership) return undefined;
  const mapping: Record<string, 'personal' | 'cooperative' | 'state' | 'municipal' | 'other'> = {
    'osobné': 'personal',
    'družstevné': 'cooperative',
    'štátne': 'state',
    'iné': 'other'
  };
  return mapping[slovakOwnership];
}

/**
 * Map Slovak condition to English canonical values for SlovakSpecificFields
 */
function mapConditionToEnglish(slovakCondition: any): string | undefined {
  if (!slovakCondition) return undefined;
  const mapping: Record<string, string> = {
    'novostavba': 'new',
    'výborný': 'excellent',
    'veľmi_dobrý': 'very_good',
    'dobrý': 'good',
    'po_rekonštrukcii': 'after_renovation',
    'pred_rekonštrukciou': 'before_renovation',
    'vyžaduje_rekonštrukciu': 'before_renovation',
    'projekt': 'under_construction',
    'vo_výstavbe': 'under_construction'
  };
  return mapping[slovakCondition];
}

/**
 * Map Slovak furnished to English canonical values for SlovakSpecificFields
 */
function mapFurnishedToEnglish(slovakFurnished: any): 'furnished' | 'partially_furnished' | 'unfurnished' | undefined {
  if (!slovakFurnished) return undefined;
  const mapping: Record<string, 'furnished' | 'partially_furnished' | 'unfurnished'> = {
    'zariadený': 'furnished',
    'čiastočne_zariadený': 'partially_furnished',
    'nezariadený': 'unfurnished'
  };
  return mapping[slovakFurnished];
}

/**
 * Map Slovak heating to English canonical values for SlovakSpecificFields
 */
function mapHeatingToEnglish(slovakHeating: any): string | undefined {
  if (!slovakHeating) return undefined;
  const mapping: Record<string, string> = {
    'ústredné': 'central_heating',
    'lokálne': 'individual_heating',
    'elektrické': 'electric_heating',
    'plynové': 'gas_heating',
    'kotol': 'gas_heating',
    'tepelné_čerpadlo': 'heat_pump',
    'iné': 'other'
  };
  return mapping[slovakHeating];
}

/**
 * Map Slovak construction type to English canonical values for SlovakSpecificFields
 */
function mapConstructionToEnglish(slovakConstruction: any): string | undefined {
  if (!slovakConstruction) return undefined;
  const mapping: Record<string, string> = {
    'panel': 'panel',
    'tehla': 'brick',
    'murovaný': 'stone',
    'drevo': 'wood',
    'betón': 'concrete',
    'zmiešaný': 'mixed',
    'iný': 'other'
  };
  return mapping[slovakConstruction];
}

/**
 * Extract available_from date from listing
 * Slovak terms: "Dostupné od", "Voľné od", "K nasťahovaniu"
 */
function extractAvailableFrom(listing: NehnutelnostiListing): string | undefined {
  if (listing.available_from) return listing.available_from;

  if (!listing.items) return undefined;

  const availItem = listing.items.find(i => {
    const name = (i.name || '').toLowerCase();
    return name.includes('dostupné od') || name.includes('voľné od') ||
           name.includes('nasťahovani') || name.includes('available');
  });

  if (!availItem?.value) return undefined;

  // Try DD.MM.YYYY format
  const skDateMatch = availItem.value.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (skDateMatch) {
    const [, day, month, year] = skDateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try ISO date
  try {
    const date = new Date(availItem.value);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch { /* not a date */ }

  return undefined;
}

/**
 * Extract deposit amount from listing
 * Slovak terms: "Kaucia", "Depozit"
 */
function extractDeposit(listing: NehnutelnostiListing): number | undefined {
  if (listing.deposit) return typeof listing.deposit === 'number' ? listing.deposit : undefined;

  if (!listing.items) return undefined;

  const depositItem = listing.items.find(i => {
    const name = (i.name || '').toLowerCase();
    return name.includes('kaucia') || name.includes('depozit') || name.includes('deposit');
  });

  if (!depositItem?.value) return undefined;

  const cleaned = depositItem.value.replace(/[€\s]/g, '').replace(/,/g, '.');
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract parking spaces count from listing
 * Slovak terms: "Parkovanie", "Parkovacie miesta"
 */
function extractParkingSpaces(listing: NehnutelnostiListing): number | undefined {
  if (listing.parking_spaces) return listing.parking_spaces;

  if (!listing.items) return undefined;

  const parkingItem = listing.items.find(i => {
    const name = (i.name || '').toLowerCase();
    return name.includes('parkovani') || name.includes('parkovac') || name.includes('parking');
  });

  if (!parkingItem?.value) return undefined;

  const match = parkingItem.value.match(/(\d+)/);
  if (match) {
    const count = parseInt(match[1]);
    if (count > 0 && count < 100) return count;
  }

  // If value is affirmative, return 1
  const val = parkingItem.value.toLowerCase().trim();
  if (val === 'áno' || val === 'ano' || val === 'yes') return 1;

  return undefined;
}

/**
 * Ensure a URL is absolute (starts with http:// or https://)
 */
function ensureAbsoluteUrl(url: string): string {
  if (!url) return 'https://www.nehnutelnosti.sk';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://www.nehnutelnosti.sk${url}`;
  return `https://www.nehnutelnosti.sk/${url}`;
}

/**
 * Extract renovation year from listing
 * Slovak terms: "Rok rekonštrukcie", "Rok renovacie"
 */
function extractRenovationYear(listing: NehnutelnostiListing): number | undefined {
  if (listing.renovation_year) return listing.renovation_year;

  if (!listing.items) return undefined;

  const renovItem = listing.items.find(i => {
    const name = (i.name || '').toLowerCase();
    return name.includes('rok rekonštrukci') || name.includes('rok renovac') ||
           name.includes('renovation year');
  });

  if (!renovItem?.value) return undefined;

  const match = renovItem.value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
  const year = match ? parseInt(match[0]) : undefined;
  return year && year >= 1800 && year <= 2100 ? year : undefined;
}
