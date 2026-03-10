import { StandardProperty, AustrianSpecificFields } from '@landomo/core';
import { WohnnetListing, WohnnetJsonLd } from '../types/wohnnetTypes';

/**
 * Transform Wohnnet listing to StandardProperty format
 */
export function transformWohnnetToStandard(listing: WohnnetListing): StandardProperty & Record<string, any> {
  // Use JSON-LD data if available for more accurate information
  const jsonLd = listing.jsonLd;

  // Extract basic information
  const title = listing.title || jsonLd?.name || 'Unknown Property';
  const price = listing.price || parsePrice(jsonLd?.offers?.price);
  const currency = listing.currency || jsonLd?.offers?.priceCurrency || 'EUR';

  // Extract location
  const location = {
    address: listing.location?.address || jsonLd?.address?.streetAddress,
    city: listing.location?.city || extractCity(jsonLd?.address?.addressLocality || listing.location?.address || ''),
    region: listing.location?.region || jsonLd?.address?.addressRegion,
    postalCode: listing.location?.postalCode || jsonLd?.address?.postalCode,
    country: 'Austria',
    coordinates: listing.coordinates || extractCoordinates(jsonLd?.geo)
  };

  // Extract details
  const sqm = listing.details?.sqm || parseFloorSize(jsonLd?.floorSize);
  const rooms = listing.details?.rooms || parseNumber(jsonLd?.numberOfRooms);

  const details = {
    bedrooms: listing.details?.bedrooms,
    bathrooms: listing.details?.bathrooms || 1, // Default to 1 if not specified
    sqm,
    floor: listing.details?.floor,
    rooms,
    renovation_year: undefined as number | undefined, // not available from wohnnet
    parking_spaces: undefined as number | undefined  // not available from wohnnet
  };

  // Extract property type from title or URL
  const propertyType = listing.details?.propertyType || inferPropertyType(title, listing.url);
  const transactionType = listing.details?.transactionType || inferTransactionType(title, listing.url);

  // Extract images
  const images = listing.images || extractImagesFromJsonLd(jsonLd);

  // Calculate price per sqm
  const pricePerSqm = price && sqm ? Math.round(price / sqm) : undefined;

  const standardProperty = {
    // Category (required for partitioned DB)
    property_category: mapPropertyCategory(propertyType),

    // Basic info
    title,
    price: price || 0,
    currency,
    property_type: propertyType,
    transaction_type: transactionType as 'sale' | 'rent',
    source_url: listing.url,
    source_platform: 'wohnnet',

    // Location
    location: {
      ...location,
      city: location.city || 'Unknown'
    },

    // Details
    details,

    // Financial
    price_per_sqm: pricePerSqm,

    // Media
    images,
    description: listing.description || jsonLd?.description,
    description_language: 'de',

    // Media (enhanced)
    media: {
      images: images || [],
      total_images: images?.length || 0
    },

    // Universal Tier 1 fields (also in country_specific for backward compat)
    condition: extractCondition(listing, jsonLd),
    heating_type: extractHeatingType(listing, jsonLd),
    furnished: extractFurnishedStatus(listing, jsonLd),
    construction_type: undefined, // not available from wohnnet
    available_from: undefined, // not available from wohnnet
    published_date: undefined, // not available from wohnnet
    deposit: undefined, // not available from wohnnet
    parking_spaces: undefined, // not available from wohnnet

    // Portal metadata (Wohnnet-specific fields)
    portal_metadata: {
      wohnnet: {
        id: listing.id,
        json_ld: jsonLd,
        raw_title: listing.title,
        original_url: listing.url
      }
    },

    // Top-level Austrian DB columns (read by bulk-operations.ts)
    austrian_ownership: normalizeOwnershipType(listing.details?.ownershipType),
    austrian_operating_costs: listing.details?.operatingCosts,
    austrian_heating_costs: listing.details?.heatingCosts,

    // Country-specific fields (Austria)
    country_specific: {
      // Condition
      condition: extractCondition(listing, jsonLd),

      // Furnished
      furnished: extractFurnishedStatus(listing, jsonLd),

      // Energy rating (standardized)
      energy_rating: extractEnergyRating(listing, jsonLd),

      // Heating type
      heating_type: extractHeatingType(listing, jsonLd),

      // Ownership
      ownership_type: normalizeOwnershipType(listing.details?.ownershipType),

      // Building details
      year_built: listing.details?.yearBuilt,

      // Cost breakdown
      operating_costs: listing.details?.operatingCosts,
      heating_costs: listing.details?.heatingCosts,

      // Areas
      area_living: listing.details?.sqm,
      area_total: listing.details?.sqm,

      // Additional Austrian-specific fields
      accessible: listing.details?.accessible,
      pets_allowed: listing.details?.petsAllowed
    } as AustrianSpecificFields,

    // Status
    status: 'active'
  } as any;

  return standardProperty;
}

/**
 * Parse price from various formats
 */
function parsePrice(price: any): number | undefined {
  if (!price) return undefined;

  if (typeof price === 'number') return price;

  if (typeof price === 'string') {
    // Remove currency symbols and parse
    const cleaned = price.replace(/[€$£\s,]/g, '').replace(/\./g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

/**
 * Parse floor size from JSON-LD format
 */
function parseFloorSize(floorSize: any): number | undefined {
  if (!floorSize) return undefined;

  if (typeof floorSize === 'number') return floorSize;

  if (typeof floorSize === 'object' && floorSize.value) {
    return parseNumber(floorSize.value);
  }

  return undefined;
}

/**
 * Parse number from string or number
 */
function parseNumber(value: any): number | undefined {
  if (!value) return undefined;

  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

/**
 * Extract coordinates from JSON-LD geo data
 */
function extractCoordinates(geo: any): { lat: number; lon: number } | undefined {
  if (!geo) return undefined;

  const lat = parseNumber(geo.latitude);
  const lon = parseNumber(geo.longitude);

  if (lat && lon) {
    return { lat, lon };
  }

  return undefined;
}

/**
 * Extract images from JSON-LD
 */
function extractImagesFromJsonLd(jsonLd?: WohnnetJsonLd): string[] | undefined {
  if (!jsonLd?.image) return undefined;

  if (typeof jsonLd.image === 'string') {
    return [jsonLd.image];
  }

  if (Array.isArray(jsonLd.image)) {
    return jsonLd.image;
  }

  return undefined;
}

/**
 * Extract city from locality string
 */
function extractCity(locality: string): string | undefined {
  if (!locality) return undefined;

  // Common Austrian cities
  const cities = ['Wien', 'Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt'];

  for (const city of cities) {
    if (locality.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
  }

  // Extract first part before comma or numbers
  const cityMatch = locality.match(/^([^,\d]+)/);
  return cityMatch ? cityMatch[1].trim() : locality;
}

/**
 * Map property type to category partition
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (propertyType) {
    case 'apartment':
      return 'apartment';
    case 'house':
      return 'house';
    case 'land':
      return 'land';
    case 'commercial':
    case 'other':
      return 'commercial';
    default:
      return 'apartment';
  }
}

/**
 * Infer property type from title and URL
 */
function inferPropertyType(title: string, url: string): string {
  const combined = (title + ' ' + url).toLowerCase();

  if (combined.includes('wohnung') || combined.includes('apartment')) return 'apartment';
  if (combined.includes('haus') || combined.includes('house')) return 'house';
  if (combined.includes('grundstück') || combined.includes('land')) return 'land';
  if (combined.includes('büro') || combined.includes('office')) return 'commercial';
  if (combined.includes('gewerbe') || combined.includes('commercial')) return 'commercial';
  if (combined.includes('garage') || combined.includes('parkplatz')) return 'other';

  return 'apartment'; // Default to apartment for Austria
}

/**
 * Infer transaction type from title and URL
 */
function inferTransactionType(title: string, url: string): string {
  const combined = (title + ' ' + url).toLowerCase();

  if (combined.includes('miete') || combined.includes('rent') || combined.includes('mieten')) {
    return 'rent';
  }

  if (combined.includes('kauf') || combined.includes('sale') || combined.includes('kaufen') || combined.includes('verkauf')) {
    return 'sale';
  }

  // Default to rent for Austria (more common)
  return 'rent';
}

/**
 * Extract condition from listing data
 */
function extractCondition(listing: WohnnetListing, jsonLd?: WohnnetJsonLd): AustrianSpecificFields['condition'] {
  const condition = listing.details?.condition;
  if (!condition) return undefined;

  const conditionMap: Record<string, AustrianSpecificFields['condition']> = {
    'new': 'new',
    'neu': 'new',
    'excellent': 'excellent',
    'sehr gut': 'excellent',
    'good': 'good',
    'gut': 'good',
    'renovated': 'after_renovation',
    'saniert': 'after_renovation',
    'needs renovation': 'requires_renovation',
    'renovierungsbedürftig': 'requires_renovation',
    'project': 'project',
    'under construction': 'under_construction',
    'im bau': 'under_construction'
  };

  const normalized = condition.toLowerCase().trim();
  return conditionMap[normalized] || undefined;
}

/**
 * Extract furnished status from listing data
 */
function extractFurnishedStatus(listing: WohnnetListing, jsonLd?: WohnnetJsonLd): AustrianSpecificFields['furnished'] {
  const furnished = listing.details?.furnished;
  if (furnished === undefined || furnished === null) return undefined;

  return furnished ? 'furnished' : 'not_furnished';
}

/**
 * Extract energy rating from listing data
 */
function extractEnergyRating(listing: WohnnetListing, jsonLd?: WohnnetJsonLd): AustrianSpecificFields['energy_rating'] {
  const rating = listing.details?.energyRating;
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
 * Extract heating type from listing data
 */
function extractHeatingType(listing: WohnnetListing, jsonLd?: WohnnetJsonLd): AustrianSpecificFields['heating_type'] {
  const heatingType = listing.details?.heatingType;
  if (!heatingType) return undefined;

  const heatingMap: Record<string, AustrianSpecificFields['heating_type']> = {
    'central': 'central_heating',
    'zentralheizung': 'central_heating',
    'fernwärme': 'district_heating',
    'district heating': 'district_heating',
    'gas': 'gas_heating',
    'gasheizung': 'gas_heating',
    'electric': 'electric_heating',
    'elektroheizung': 'electric_heating',
    'heat pump': 'heat_pump',
    'wärmepumpe': 'heat_pump',
    'oil': 'oil_heating',
    'ölheizung': 'oil_heating',
    'floor heating': 'floor_heating',
    'fußbodenheizung': 'floor_heating',
    'wood': 'other',
    'holz': 'other',
    'solar': 'other'
  };

  const normalized = heatingType.toLowerCase().trim();
  return heatingMap[normalized] || 'other';
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
