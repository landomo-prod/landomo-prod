import { NehnutelnostiListing } from '../types/nehnutelnostiTypes';

/**
 * Shared helper functions for all transformers
 */

/**
 * Extract coordinates from various possible fields
 */
export function extractCoordinates(listing: NehnutelnostiListing): { lat: number; lon: number } | undefined {
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
export function extractCity(locality: string): string {
  if (!locality) return 'Unknown';

  // Extract city from "Bratislava - Staré Mesto" → "Bratislava"
  const cityMatch = locality.match(/^([^,-]+)/);
  return cityMatch ? cityMatch[1].trim() : locality.split(/[-,]/)[0]?.trim() || locality;
}

/**
 * Extract bedroom count from rooms or disposition
 */
export function extractBedrooms(listing: NehnutelnostiListing): number | undefined {
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
export function extractBathrooms(listing: NehnutelnostiListing): number | undefined {
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
export function extractSqm(listing: NehnutelnostiListing): number | undefined {
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
export function extractFloor(listing: NehnutelnostiListing): number | undefined {
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
export function extractRoomsFromDisposition(disposition?: string): number | undefined {
  if (!disposition) return undefined;

  // Extract from "2-izbový" or "3 izbový"
  const match = disposition.match(/(\d)\s*[-\s]?izb/i);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract images from various possible fields
 */
export function extractImages(listing: NehnutelnostiListing): string[] {
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
 * Map Slovak ownership to English canonical values
 */
export function mapOwnershipToEnglish(slovakOwnership: any): 'personal' | 'cooperative' | 'state' | 'municipal' | 'other' | undefined {
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
 * Map Slovak condition to English canonical values
 */
export function mapConditionToEnglish(slovakCondition: any): string | undefined {
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
 * Map Slovak furnished to English canonical values
 */
export function mapFurnishedToEnglish(slovakFurnished: any): 'furnished' | 'partially_furnished' | 'unfurnished' | undefined {
  if (!slovakFurnished) return undefined;
  const mapping: Record<string, 'furnished' | 'partially_furnished' | 'unfurnished'> = {
    'zariadený': 'furnished',
    'čiastočne_zariadený': 'partially_furnished',
    'nezariadený': 'unfurnished'
  };
  return mapping[slovakFurnished];
}

/**
 * Map Slovak heating to English canonical values
 */
export function mapHeatingToEnglish(slovakHeating: any): string | undefined {
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
 * Map Slovak construction type to English canonical values
 */
export function mapConstructionToEnglish(slovakConstruction: any): string | undefined {
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
 * Map API category value to Slovak disposition format
 * Example: "TWO_ROOM_APARTMENT" → "2-room"
 */
export function mapCategoryToDisposition(categoryValue: string): string | undefined {
  if (!categoryValue) return undefined;

  const mapping: Record<string, string> = {
    'STUDIO': 'studio',
    'ONE_ROOM_APARTMENT': '1-room',
    'TWO_ROOM_APARTMENT': '2-room',
    'THREE_ROOM_APARTMENT': '3-room',
    'FOUR_ROOM_APARTMENT': '4-room',
    'FIVE_ROOM_APARTMENT': '5-room',
    'SIX_ROOM_APARTMENT': '6-room',
    'MULTIROOM_APARTMENT': 'multi-room',
    'LOFT': 'loft',
    'ATYPICAL': 'atypical'
  };

  return mapping[categoryValue];
}

/**
 * Extract available_from date from listing
 */
export function extractAvailableFrom(listing: NehnutelnostiListing): string | undefined {
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
 */
export function extractDeposit(listing: NehnutelnostiListing): number | undefined {
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
 */
export function extractParkingSpaces(listing: NehnutelnostiListing): number | undefined {
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
export function ensureAbsoluteUrl(url: string): string {
  if (!url) return 'https://www.nehnutelnosti.sk';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://www.nehnutelnosti.sk${url}`;
  return `https://www.nehnutelnosti.sk/${url}`;
}

/**
 * Extract renovation year from listing
 */
export function extractRenovationYear(listing: NehnutelnostiListing): number | undefined {
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

/**
 * Extract land area in sqm
 */
export function extractLandArea(listing: NehnutelnostiListing): number | undefined {
  if (listing.area_land) return listing.area_land;

  if (!listing.items) return undefined;

  const landItem = listing.items.find(i => {
    const name = (i.name || '').toLowerCase();
    return name.includes('výmera pozemku') || name.includes('vymera pozemku') ||
           name.includes('land area') || name.includes('plot area');
  });

  if (!landItem?.value) return undefined;

  const match = landItem.value.replace(/\s/g, '').match(/(\d+)/);
  return match ? parseFloat(match[1]) : undefined;
}

/**
 * Extract year built
 */
export function extractYearBuilt(listing: NehnutelnostiListing): number | undefined {
  if (listing.year_built) return listing.year_built;

  if (!listing.items) return undefined;

  const yearItem = listing.items.find(i => {
    const name = (i.name || '').toLowerCase();
    return name.includes('rok výstavby') || name.includes('rok vystavby') ||
           name.includes('year built') || name.includes('built');
  });

  if (!yearItem?.value) return undefined;

  const match = yearItem.value.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
  const year = match ? parseInt(match[0]) : undefined;
  return year && year >= 1800 && year <= 2100 ? year : undefined;
}
