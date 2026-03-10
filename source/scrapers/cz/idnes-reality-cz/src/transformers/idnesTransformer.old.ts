import { StandardProperty } from '@landomo/core';
import { IdnesListing } from '../types/idnesTypes';
import {
  normalizeDisposition,
  normalizeCondition,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType,
  normalizeOwnership,
  normalizeFurnished,
  parseCzechFeatures
} from '../../../shared/czech-value-mappings';

/**
 * Transform Reality.idnes.cz listing to StandardProperty format
 */
export function transformIdnesToStandard(listing: IdnesListing): StandardProperty & Record<string, any> {
  const transactionType = mapTransactionType(listing.transactionType);
  const propertyType = mapPropertyType(listing.propertyType, listing.title);
  const propertyCategory = detectPropertyCategory(propertyType, listing.title);
  const city = listing.location?.city || extractCityFromLocation(listing.location) || 'Unknown';

  return {
    // Basic info
    title: listing.title || 'Untitled',
    description: listing.description || listing.title || '',
    source_url: listing.url,
    source_platform: 'idnes-reality',
    price: listing.price || 0,
    currency: 'CZK',

    // Transaction details
    transaction_type: transactionType,
    property_type: propertyType,
    property_category: propertyCategory,

    // Location
    location: {
      country: 'Czech Republic',
      city: city,
      region: listing.location?.district,
      address: listing.location?.address,
      coordinates: listing.coordinates ? {
        lat: listing.coordinates.lat,
        lon: listing.coordinates.lng
      } : undefined
    },

    // Property details
    details: {
      sqm: listing.area,
      rooms: parseRooms(listing.rooms),
      floor: listing.floor,
      renovation_year: extractRenovationYearFromAttrs(listing._attributes),
      parking_spaces: extractParkingSpacesFromFeatures(listing.features),
    },

    // Price per square meter (calculated)
    price_per_sqm: listing.price && listing.area ? Math.round(listing.price / listing.area) : undefined,

    // ============ Universal property attributes (Tier 1) ============
    condition: listing.condition ? normalizeCondition(listing.condition) : undefined,
    heating_type: listing.heatingType ? normalizeHeatingType(listing.heatingType) : undefined,
    furnished: listing.furnished ? normalizeFurnished(listing.furnished) as StandardProperty['furnished'] : undefined,
    construction_type: listing.constructionType ? normalizeConstructionType(listing.constructionType) : undefined,
    available_from: extractAvailableFromAttrs(listing._attributes),
    published_date: listing.metadata?.published || undefined,
    deposit: extractDepositFromAttrs(listing._attributes),

    // Portal metadata (Idnes-specific fields) - TIER 3
    portal_metadata: {
      idnes: {
        // ===== IDENTITY =====
        id: listing.id,
        url: listing.url,

        // ===== CLASSIFICATION =====
        property_type: listing.propertyType,
        transaction_type: listing.transactionType,

        // ===== CZECH FIELDS (raw from detail pages) =====
        rooms_text: listing.rooms,
        condition: listing.condition,
        ownership: listing.ownership,
        energy_rating: listing.energyRating,
        heating_type: listing.heatingType,
        construction_type: listing.constructionType,
        furnished: listing.furnished,

        // ===== AREA BREAKDOWN =====
        area: listing.area,
        plot_area: listing.plotArea,

        // ===== LOCATION DETAILS =====
        location: {
          city: listing.location?.city,
          district: listing.location?.district,
          address: listing.location?.address
        },
        coordinates: listing.coordinates,

        // ===== MEDIA & TOURS =====
        images: listing.images,
        image_count: listing.images?.length || 0,
        virtual_tour_url: extractVirtualTourUrl(listing),
        // Floor plans might be in features
        floor_plans: extractFloorPlans(listing.features),

        // ===== REALTOR INFO =====
        realtor_name: listing.realtor?.name,
        realtor_phone: listing.realtor?.phone,
        realtor_email: listing.realtor?.email,

        // ===== TEMPORAL INFO =====
        views: listing.metadata?.views,
        published_date: listing.metadata?.published,
        updated_date: listing.metadata?.updated,
        price_text: listing.priceText,

        // ===== FEATURES & DESCRIPTION =====
        features: listing.features,
        description: listing.description,

        // ===== RAW DATA =====
        raw_html: listing.rawHtml,
        extracted_attributes: listing._attributes
      }
    },

    // Media (enhanced)
    media: {
      images: listing.images || [],
      total_images: listing.images?.length || 0,
      // Virtual tour URL if available from detail page
      virtual_tour_url: extractVirtualTourUrl(listing)
    },

    // Backward compatibility
    images: listing.images || [],

    // Features
    features: listing.features || [],

    // Amenities parsed from Czech features array
    amenities: {
      ...parseCzechFeatures(listing.features)
    },

    // Country-specific data - TIER 2
    country_specific: {
      // ===== NORMALIZED CZECH CLASSIFICATIONS =====
      czech_disposition: listing.rooms ? normalizeDisposition(listing.rooms) : undefined,
      czech_ownership: listing.ownership ? normalizeOwnership(listing.ownership) : undefined,
      condition: listing.condition ? normalizeCondition(listing.condition) : undefined,
      energy_rating: listing.energyRating ? normalizeEnergyRating(listing.energyRating) : undefined,
      heating_type: listing.heatingType ? normalizeHeatingType(listing.heatingType) : undefined,
      construction_type: listing.constructionType ? normalizeConstructionType(listing.constructionType) : undefined,
      furnished: listing.furnished ? normalizeFurnished(listing.furnished) : undefined,

      // ===== RAW CZECH VALUES FOR REFERENCE =====
      building_type: listing.constructionType,
      ownership_type: listing.ownership,

      // ===== AREA BREAKDOWN =====
      area_living: listing.area,
      area_plot: listing.plotArea,

      // ===== BUILDING STRUCTURE =====
      floor_location: extractFloorLocation(listing.floor),
      floor_number: listing.floor,

      // ===== COORDINATES =====
      coordinates: listing.coordinates ? {
        lat: listing.coordinates.lat,
        lon: listing.coordinates.lng
      } : undefined,

      // ===== MEDIA =====
      image_urls: listing.images || [],
      image_count: listing.images?.length || 0,
      floor_plan_urls: extractFloorPlans(listing.features),
      virtual_tour_url: extractVirtualTourUrl(listing),

      // ===== TEMPORAL INFO =====
      days_on_market: listing.metadata?.published ? calculateDaysOnMarket(listing.metadata.published) : undefined,
      published_date: listing.metadata?.published,
      updated_date: listing.metadata?.updated,
      views_count: listing.metadata?.views
    }
  };
}

/**
 * Map Idnes transaction type to StandardProperty
 */
function mapTransactionType(type?: string): 'sale' | 'rent' {
  if (!type) return 'sale';

  const typeNormalized = type.toLowerCase();

  if (typeNormalized.includes('rent') || typeNormalized.includes('pronajem')) {
    return 'rent';
  }

  return 'sale';
}

/**
 * Map Idnes property type to StandardProperty
 */
function mapPropertyType(type?: string, title?: string): string {
  const searchText = `${type || ''} ${title || ''}`.toLowerCase();

  if (searchText.includes('byt') || searchText.includes('flat') || searchText.includes('apartment')) {
    return 'apartment';
  }

  if (searchText.includes('dům') || searchText.includes('dum') || searchText.includes('house') || searchText.includes('rodinný')) {
    return 'house';
  }

  if (searchText.includes('pozemek') || searchText.includes('land') || searchText.includes('parcela')) {
    return 'land';
  }

  if (searchText.includes('komerční') || searchText.includes('commercial') || searchText.includes('kancelář')) {
    return 'commercial';
  }

  if (searchText.includes('garáž') || searchText.includes('garage')) {
    return 'garage';
  }

  // Default to apartment
  return 'apartment';
}

/**
 * Extract city from location object or string
 */
function extractCityFromLocation(location?: { city?: string; district?: string; address?: string }): string | undefined {
  if (!location) return undefined;

  // Try city field first
  if (location.city) return location.city;

  // Try to extract from district or address
  const text = location.district || location.address || '';

  // Common Czech cities
  const cities = [
    'Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc',
    'České Budějovice', 'Hradec Králové', 'Ústí nad Labem', 'Pardubice'
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
 * Parse rooms from Czech format (e.g., "3+kk", "2+1")
 */
function parseRooms(rooms?: string): number | undefined {
  if (!rooms) return undefined;

  // Match patterns like "3+kk", "2+1", "4+1"
  const match = rooms.match(/(\d+)\s*\+/);
  if (match) {
    return parseInt(match[1]);
  }

  // Try to extract just a number
  const numberMatch = rooms.match(/(\d+)/);
  if (numberMatch) {
    return parseInt(numberMatch[1]);
  }

  return undefined;
}

/**
 * Parse floor from Czech format text
 * Examples: "přízemí" (ground floor = 0), "1. podlaží", "3. patro"
 */
function parseFloor(text?: string): number | undefined {
  if (!text) return undefined;

  // Normalize the text
  const normalized = text.toLowerCase().trim();

  // Check for ground floor
  if (normalized.includes('přízemí') || normalized.includes('přízemí')) {
    return 0;
  }

  // Extract number from "N. podlaží" or "N. patro" or "N. floor"
  const match = normalized.match(/(\d+)\.\s*(?:podlaží|patro|floor)/i);
  if (match) {
    return parseInt(match[1]);
  }

  // Also try just extracting a number if it's in the format like "3" or "2. podlaží"
  const numberMatch = normalized.match(/^(\d+)/);
  if (numberMatch) {
    return parseInt(numberMatch[1]);
  }

  return undefined;
}

/**
 * Parse price from Czech format text
 * Examples: "5 000 000 Kč", "15000 Kč/měsíc"
 */
export function parsePrice(priceText?: string): number | undefined {
  if (!priceText) return undefined;

  // Remove common Czech price suffixes
  const cleaned = priceText
    .replace(/Kč.*$/i, '')
    .replace(/CZK.*$/i, '')
    .replace(/\s+/g, '')
    .replace(/[^\d]/g, '');

  const price = parseInt(cleaned);
  return isNaN(price) ? undefined : price;
}

/**
 * Extract virtual tour URL from listing
 * Looks for tour URL patterns in metadata or listing fields
 */
function extractVirtualTourUrl(listing: IdnesListing): string | undefined {
  const listing_ = listing as any;

  // Check common virtual tour fields
  if (listing_._tourUrl) return listing_._tourUrl;
  if (listing_._virtualTour) return listing_._virtualTour;
  if (listing_._matterport) return listing_._matterport;
  if (listing_.virtualTourUrl) return listing_.virtualTourUrl;
  if (listing_.tourUrl) return listing_.tourUrl;

  // Check in metadata
  if (listing_.metadata?.tourUrl) return listing_.metadata.tourUrl;
  if (listing_.metadata?.virtualTour) return listing_.metadata.virtualTour;

  return undefined;
}

/**
 * Extract floor location category from floor number
 */
function extractFloorLocation(floorNum?: number): 'ground_floor' | 'middle_floor' | 'top_floor' | undefined {
  if (floorNum === undefined) return undefined;

  if (floorNum === 0) return 'ground_floor';
  if (floorNum === 1) return 'middle_floor';  // Most Czech apartments start from floor 1
  if (floorNum >= 2) return 'middle_floor';

  return undefined;
}

/**
 * Extract floor plans from features array
 * Looks for floor plan keywords in features
 */
function extractFloorPlans(features?: string[]): string[] {
  if (!features || features.length === 0) return [];

  const floorPlans: string[] = [];
  const floorPlanKeywords = ['půdorys', 'floor plan', 'dispozice', 'floor_plan', 'floorplan'];

  features.forEach(feature => {
    const normalized = feature.toLowerCase().trim();
    if (floorPlanKeywords.some(keyword => normalized.includes(keyword))) {
      // If it looks like a URL, add it
      if (feature.startsWith('http')) {
        floorPlans.push(feature);
      } else {
        // Otherwise it's just a label, skip it
      }
    }
  });

  return floorPlans;
}

/**
 * Calculate days on market from published date
 */
function calculateDaysOnMarket(publishedDate?: string): number | undefined {
  if (!publishedDate) return undefined;

  try {
    const pubDate = new Date(publishedDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - pubDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return undefined;
  }
}

/**
 * Extract renovation year from _attributes (detail page data)
 * Czech terms: "Rok rekonstrukce", "Rekonstrukce"
 */
function extractRenovationYearFromAttrs(attrs?: Record<string, string>): number | undefined {
  if (!attrs) return undefined;

  const keys = ['Rok rekonstrukce', 'Rekonstrukce rok', 'Rok renovace'];
  for (const key of keys) {
    const val = attrs[key];
    if (val) {
      const match = val.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
      if (match) {
        const year = parseInt(match[0]);
        if (year >= 1800 && year <= 2100) return year;
      }
    }
  }
  return undefined;
}

/**
 * Extract parking spaces count from features array
 */
function extractParkingSpacesFromFeatures(features?: string[]): number | undefined {
  if (!features) return undefined;

  for (const feature of features) {
    const f = feature.toLowerCase();
    if (f.includes('parkování') || f.includes('parkovací') || f.includes('parking') || f.includes('garáž')) {
      const match = feature.match(/(\d+)/);
      if (match) {
        const count = parseInt(match[1]);
        if (count > 0 && count < 100) return count;
      }
      return 1;
    }
  }
  return undefined;
}

/**
 * Extract available_from date from _attributes (detail page data)
 * Czech terms: "K nastěhování", "Dostupné od", "Volné od"
 */
function extractAvailableFromAttrs(attrs?: Record<string, string>): string | undefined {
  if (!attrs) return undefined;

  const keys = ['K nastěhování', 'Dostupné od', 'Volné od', 'Nastěhování'];
  for (const key of keys) {
    const val = attrs[key];
    if (val) {
      const czechDateMatch = val.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (czechDateMatch) {
        const [, day, month, year] = czechDateMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      try {
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch {
        // ignore
      }
    }
  }
  return undefined;
}

/**
 * Extract deposit/kauce amount from _attributes (detail page data)
 * Czech terms: "Kauce", "Vratná kauce", "Jistina"
 */
function extractDepositFromAttrs(attrs?: Record<string, string>): number | undefined {
  if (!attrs) return undefined;

  const keys = ['Kauce', 'Vratná kauce', 'Jistina', 'Deposit'];
  for (const key of keys) {
    const val = attrs[key];
    if (val) {
      const cleaned = val.replace(/[Kč€\s]/g, '').replace(/,/g, '').replace(/\./g, '');
      const match = cleaned.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
  }
  return undefined;
}

/**
 * Detect property category for routing to category-specific tables
 * Returns: 'apartment' | 'house' | 'land'
 */
function detectPropertyCategory(propertyType?: string, title?: string): 'apartment' | 'house' | 'land' {
  const searchText = `${propertyType || ''} ${title || ''}`.toLowerCase();

  // Land detection
  if (searchText.includes('land') || searchText.includes('pozemek') || searchText.includes('parcela')) {
    return 'land';
  }

  // House detection
  if (searchText.includes('house') || searchText.includes('dům') || searchText.includes('dum') ||
      searchText.includes('rodinný') || searchText.includes('rodinny') || /\brd\b/.test(searchText)) {
    return 'house';
  }

  // Apartment detection (default for most Czech listings)
  if (searchText.includes('apartment') || searchText.includes('byt') || searchText.includes('flat') ||
      /\d\+(?:kk|1)/.test(searchText)) {
    return 'apartment';
  }

  // Default to apartment (most common in Czech Republic)
  return 'apartment';
}
