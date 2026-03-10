import { StandardProperty, GermanSpecificFields } from '@landomo/core';
import { ImmonetListing } from '../types/immonetTypes';

/**
 * Transform Immonet.de listing to StandardProperty format
 */
export function transformImmonetToStandard(listing: ImmonetListing): StandardProperty & Record<string, any> {
  const transactionType = mapTransactionType(listing.transactionType);
  const propertyType = mapPropertyType(listing.propertyType, listing.title);
  const city = listing.location?.city || 'Unknown';

  // Map property type to category
  const propertyCategory = mapPropertyCategory(propertyType);

  return {
    // Category (required for partitioned DB)
    property_category: propertyCategory,

    // Basic info
    title: listing.title || 'Untitled',
    description: listing.description || listing.title || '',
    source_url: listing.url,
    source_platform: 'immonet-de',
    price: listing.price || 0,
    currency: 'EUR',

    // Transaction details
    transaction_type: transactionType,
    property_type: propertyType,

    // Location
    location: {
      country: 'Germany',
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
      year_built: listing.constructionYear,
      parking_spaces: listing.parkingSpaces,
    },

    // Price per square meter (calculated)
    price_per_sqm: listing.price && listing.area ? Math.round(listing.price / listing.area) : undefined,

    // Portal metadata (Immonet-specific fields) - TIER 3
    portal_metadata: {
      immonet: {
        // Identity
        id: listing.id,
        listing_id: listing.metadata?.listingId,
        estate_id: listing.metadata?.estateId,

        // Classification
        property_type: listing.propertyType,
        transaction_type: listing.transactionType,

        // Property attributes
        condition: listing.condition,
        energy_rating: listing.energyRating,
        heating_type: listing.heatingType,
        furnished: listing.furnished,

        // Areas
        area: listing.area,
        plot_area: listing.plotArea,

        // Features
        parking_spaces: listing.parkingSpaces,
        balcony: listing.balcony,
        terrace: listing.terrace,
        garden: listing.garden,
        elevator: listing.elevator,
        cellar: listing.cellar,

        // Contact & Realtor
        realtor_name: listing.realtor?.name,
        realtor_company: listing.realtor?.company,
        realtor_phone: listing.realtor?.phone,
        realtor_email: listing.realtor?.email,
        realtor_logo: listing.realtor?.logo,

        // Metadata
        published: listing.metadata?.published,
        updated: listing.metadata?.updated,
        views: listing.metadata?.views
      }
    },

    // Media (enhanced)
    media: {
      images: listing.images || [],
      total_images: listing.images?.length || 0
    },

    // Backward compatibility
    images: listing.images || [],

    // Features
    features: listing.features || [],

    // Amenities
    amenities: {
      has_parking: listing.parkingSpaces ? listing.parkingSpaces > 0 : undefined,
      has_garage: listing.parkingSpaces ? listing.parkingSpaces > 0 : undefined,
      has_balcony: listing.balcony,
      has_terrace: listing.terrace,
      has_garden: listing.garden,
      has_elevator: listing.elevator,
      has_basement: listing.cellar || listing.features?.some(f =>
        f.toLowerCase().includes('keller') ||
        f.toLowerCase().includes('cellar')
      )
    },

    // Energy rating
    energy_rating: listing.energyRating,

    // ============ Universal Tier 1 fields ============
    condition: normalizeCondition(listing.condition),
    heating_type: normalizeHeatingType(listing.heatingType),
    furnished: normalizeFurnished(listing.furnished),
    construction_type: undefined, // Immonet does not provide construction material type
    available_from: undefined, // Not available from Immonet listing data
    published_date: listing.metadata?.published || undefined,
    deposit: undefined, // Not available from Immonet listing data
    parking_spaces: listing.parkingSpaces,

    // Agent
    agent: listing.realtor ? {
      name: listing.realtor.name || 'Unknown',
      agency: listing.realtor.company,
      phone: listing.realtor.phone,
      email: listing.realtor.email,
      agency_logo: listing.realtor.logo
    } : undefined,

    // Country-specific data - TIER 2
    country_specific: {
      // Core German classifications
      condition: normalizeCondition(listing.condition),
      furnished: normalizeFurnished(listing.furnished),
      energy_rating: normalizeEnergyRating(listing.energyRating),
      heating_type: normalizeHeatingType(listing.heatingType),

      // Building details
      year_built: listing.constructionYear,

      // Areas & dimensions
      area_living: listing.area,
      area_plot: listing.plotArea,

      // Building structure
      total_floors: listing.totalFloors,

      // Media
      image_urls: listing.images || [],
      image_count: listing.images?.length || 0
    } as GermanSpecificFields,

    // German-specific indexed columns (top-level for bulk-operations.ts)
    german_ownership: normalizeOwnership(listing.ownershipType),
    german_hausgeld: listing.hausgeld,
    german_courtage: listing.courtage,
    german_kfw_standard: listing.kfwStandard,
    german_is_denkmalschutz: listing.denkmalschutz || false,
  } as any;
}

/**
 * Map Immonet transaction type to StandardProperty
 */
function mapTransactionType(type?: string): 'sale' | 'rent' {
  if (!type) return 'sale';

  const typeNormalized = type.toLowerCase();

  if (typeNormalized.includes('rent') ||
      typeNormalized.includes('miete') ||
      typeNormalized.includes('vermietung')) {
    return 'rent';
  }

  return 'sale';
}

/**
 * Map Immonet property type to StandardProperty
 */
function mapPropertyType(type?: string, title?: string): string {
  const searchText = `${type || ''} ${title || ''}`.toLowerCase();

  // Apartments
  if (searchText.includes('wohnung') ||
      searchText.includes('apartment') ||
      searchText.includes('flat')) {
    return 'apartment';
  }

  // Houses
  if (searchText.includes('haus') ||
      searchText.includes('house') ||
      searchText.includes('einfamilienhaus') ||
      searchText.includes('reihenhaus') ||
      searchText.includes('doppelhaushälfte')) {
    return 'house';
  }

  // Land
  if (searchText.includes('grundstück') ||
      searchText.includes('land') ||
      searchText.includes('bauland')) {
    return 'land';
  }

  // Commercial
  if (searchText.includes('gewerbe') ||
      searchText.includes('commercial') ||
      searchText.includes('büro') ||
      searchText.includes('laden')) {
    return 'commercial';
  }

  // Garage
  if (searchText.includes('garage') ||
      searchText.includes('stellplatz')) {
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
      return 'apartment';
    case 'house':
    case 'multi-family-house':
      return 'house';
    case 'land':
    case 'agriculture':
      return 'land';
    case 'office':
    case 'retail':
    case 'warehouse':
    case 'commercial':
    case 'parking':
    case 'hotel':
    case 'investment':
      return 'commercial';
    default:
      return 'apartment';
  }
}

/**
 * Normalize condition values
 */
function normalizeCondition(condition?: string): GermanSpecificFields['condition'] {
  if (!condition) return undefined;

  const normalized = condition.toLowerCase();

  if (normalized.includes('neuwertig') || normalized.includes('new')) return 'new';
  if (normalized.includes('saniert') || normalized.includes('renovated')) return 'after_renovation';
  if (normalized.includes('gepflegt') || normalized.includes('good')) return 'good';
  if (normalized.includes('modernisiert') || normalized.includes('modernized')) return 'after_renovation';
  if (normalized.includes('renovierungsbedürftig') || normalized.includes('needs renovation')) return 'requires_renovation';
  if (normalized.includes('neubau') || normalized.includes('construction')) return 'under_construction';
  if (normalized.includes('projekt')) return 'project';

  return undefined;
}

/**
 * Normalize heating type values
 */
function normalizeHeatingType(heatingType?: string): GermanSpecificFields['heating_type'] {
  if (!heatingType) return undefined;

  const normalized = heatingType.toLowerCase();

  if (normalized.includes('gas')) return 'gas_heating';
  if (normalized.includes('öl') || normalized.includes('oil')) return 'oil_heating';
  if (normalized.includes('fernwärme') || normalized.includes('district')) return 'district_heating';
  if (normalized.includes('elektro') || normalized.includes('electric')) return 'electric_heating';
  if (normalized.includes('wärmepumpe') || normalized.includes('heat pump')) return 'heat_pump';
  if (normalized.includes('zentral') || normalized.includes('central')) return 'central_heating';
  if (normalized.includes('fußboden') || normalized.includes('floor')) return 'floor_heating';
  if (normalized.includes('wasser') || normalized.includes('water')) return 'water_heating';

  return 'other';
}

/**
 * Normalize furnished values
 */
function normalizeFurnished(furnished?: string): GermanSpecificFields['furnished'] {
  if (!furnished) return undefined;

  const normalized = furnished.toLowerCase();

  if (normalized.includes('möbliert') && !normalized.includes('teil') && !normalized.includes('un')) return 'furnished';
  if (normalized.includes('teilmöbliert') || normalized.includes('partly')) return 'partially_furnished';
  if (normalized.includes('unmöbliert') || normalized.includes('unfurnished') || normalized.includes('not furnished')) return 'not_furnished';

  return 'not_furnished';
}

/**
 * Normalize energy rating values (extract A-G ratings)
 */
function normalizeEnergyRating(rating?: string): GermanSpecificFields['energy_rating'] {
  if (!rating) return undefined;
  const normalized = rating.toUpperCase().replace(/[^A-G]/g, '');
  const lower = normalized.toLowerCase();
  if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(lower)) {
    return lower as 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
  }
  return 'unknown';
}

/**
 * Parse price from German format text
 * Examples: "500.000 €", "1.200 €/Monat"
 */
export function parsePrice(priceText?: string): number | undefined {
  if (!priceText) return undefined;

  // Remove common German price suffixes
  const cleaned = priceText
    .replace(/€.*$/i, '')
    .replace(/EUR.*$/i, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '') // Remove thousand separators
    .replace(',', '.'); // Convert decimal comma to dot

  const price = parseFloat(cleaned);
  return isNaN(price) ? undefined : price;
}

/**
 * Normalize ownership type for German indexed column
 */
function normalizeOwnership(ownership?: string): string | undefined {
  if (!ownership) return undefined;

  const lower = ownership.toLowerCase();

  if (lower.includes('eigentum') || lower.includes('freehold')) return 'eigentum';
  if (lower.includes('erbbaurecht') || lower.includes('leasehold')) return 'erbbaurecht';
  if (lower.includes('mietkauf')) return 'mietkauf';
  if (lower.includes('genossenschaft') || lower.includes('cooperative')) return 'genossenschaft';
  if (lower.includes('wohnungseigentum')) return 'wohnungseigentum';

  return undefined;
}
