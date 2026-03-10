import { StandardProperty, GermanSpecificFields, ImmoweltDEPortalMetadata } from '@landomo/core';
import { ImmoweltListing } from '../types/immoweltTypes';

/**
 * Transform Immowelt.de listing to StandardProperty format
 */
export function transformImmoweltToStandard(listing: ImmoweltListing): StandardProperty & Record<string, any> {
  const transactionType = mapTransactionType(listing.transactionType);
  const propertyType = mapPropertyType(listing.propertyType, listing.title);
  const city = listing.location?.city || 'Unknown';

  // Map property type to category for partition routing
  const propertyCategory = mapPropertyCategory(propertyType);

  return {
    // Category (required for partition routing)
    property_category: propertyCategory,

    // Basic info
    title: listing.title || 'Untitled',
    description: listing.description || listing.title || '',
    source_url: listing.url,
    source_platform: 'immowelt-de',
    price: listing.price || 0,
    currency: 'EUR',

    // Transaction details
    transaction_type: transactionType,
    property_type: propertyType,

    // Location
    location: {
      country: 'Germany',
      city: city,
      region: listing.location?.state || listing.location?.district,
      postal_code: listing.location?.zipCode,
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
      floor: listing.floor,
      year_built: listing.constructionYear,
      parking_spaces: listing.parkingSpaces,
    },

    // Price per square meter (calculated)
    price_per_sqm: listing.price && listing.area ? Math.round(listing.price / listing.area) : undefined,

    // Portal metadata (Immowelt-specific fields) - TIER 3
    portal_metadata: {
      immowelt: {
        // Identity
        id: listing.id,
        expose_id: listing.id,
        online_id: listing.id,
        object_number: listing.metadata?.objectNumber,
        global_object_key: listing.metadata?.objectNumber,

        // Classification
        estate_type: listing.propertyType,
        marketing_type: listing.transactionType,

        // Pricing
        price: listing.price,
        rental_price: listing.price,

        // Location
        address: listing.location ? {
          street: listing.location.address,
          city: listing.location.city,
          postal_code: listing.location.zipCode,
          quarter: listing.location.district,
          state: listing.location.state,
        } : undefined,

        // Geographic
        geo_location: listing.coordinates ? {
          latitude: listing.coordinates.lat,
          longitude: listing.coordinates.lng
        } : undefined,

        // Building details
        construction_year: listing.constructionYear,
        object_condition: listing.condition,

        // Features
        equipment: listing.features,
        special_features: [
          listing.balcony ? 'Balcony' : null,
          listing.terrace ? 'Terrace' : null,
          listing.garden ? 'Garden' : null,
          listing.elevator ? 'Elevator' : null,
          listing.cellar ? 'Cellar' : null,
          listing.guestToilet ? 'Guest Toilet' : null,
        ].filter(Boolean) as string[],

        // Media
        attachments: listing.images?.map(img => ({
          url: img,
          type: 'image',
        })),

        // Contact
        contact: listing.realtor ? {
          name: listing.realtor.name,
          company: listing.realtor.company,
          email: listing.realtor.email,
          phone: listing.realtor.phone,
        } : undefined,

        // Additional metadata
        metadata: listing.metadata,
      } as ImmoweltDEPortalMetadata
    },

    // Media
    media: {
      images: listing.images || [],
      total_images: listing.images?.length || 0,
    },

    // Backward compatibility
    images: listing.images || [],

    // Features
    features: listing.features || [],

    // Amenities
    amenities: {
      has_balcony: listing.balcony,
      has_terrace: listing.terrace,
      has_garden: listing.garden,
      has_elevator: listing.elevator,
      has_basement: listing.cellar,
      has_parking: listing.parkingSpaces ? listing.parkingSpaces > 0 : undefined,
    },

    // Energy rating
    energy_rating: listing.energyRating,

    // ============ Universal Tier 1 fields ============
    condition: listing.condition ? normalizeCondition(listing.condition) : undefined,
    heating_type: listing.heatingType ? normalizeHeatingType(listing.heatingType) : undefined,
    furnished: listing.furnished ? normalizeFurnished(listing.furnished) : undefined,
    construction_type: undefined, // Immowelt does not provide construction material type
    available_from: listing.availableFrom,
    published_date: listing.metadata?.published || undefined,
    deposit: undefined, // Not available from Immowelt listing data
    parking_spaces: listing.parkingSpaces,

    // Agent
    agent: listing.realtor ? {
      name: listing.realtor.name || 'Unknown',
      agency: listing.realtor.company,
      phone: listing.realtor.phone,
      email: listing.realtor.email,
    } : undefined,

    // Description language
    description_language: 'de',

    // Country-specific data - TIER 2
    country_specific: {
      // Normalized German fields
      condition: listing.condition ? normalizeCondition(listing.condition) : undefined,
      energy_rating: listing.energyRating ? normalizeEnergyRating(listing.energyRating) : undefined,
      heating_type: listing.heatingType ? normalizeHeatingType(listing.heatingType) : undefined,
      furnished: listing.furnished ? normalizeFurnished(listing.furnished) : undefined,

      // Area breakdown
      area_living: listing.area,
      area_plot: listing.plotArea,

      // Construction
      year_built: listing.constructionYear,
      available_from: listing.availableFrom,

      // Images
      image_urls: listing.images || [],
      image_count: listing.images?.length || 0,
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
 * Map property type to category for DB partition routing
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (propertyType) {
    case 'apartment': return 'apartment';
    case 'house': return 'house';
    case 'land': return 'land';
    case 'commercial': return 'commercial';
    default: return 'apartment';
  }
}

/**
 * Map Immowelt transaction type to StandardProperty
 */
function mapTransactionType(type?: string): 'sale' | 'rent' {
  if (!type) return 'sale';

  const typeNormalized = type.toLowerCase();

  if (typeNormalized.includes('rent') || typeNormalized.includes('miete')) {
    return 'rent';
  }

  return 'sale';
}

/**
 * Map Immowelt property type to StandardProperty
 */
function mapPropertyType(type?: string, title?: string): string {
  const searchText = `${type || ''} ${title || ''}`.toLowerCase();

  if (searchText.includes('wohnung') || searchText.includes('apartment') || searchText.includes('flat')) {
    return 'apartment';
  }

  if (searchText.includes('haus') || searchText.includes('house') || searchText.includes('einfamilienhaus') || searchText.includes('reihenhaus')) {
    return 'house';
  }

  if (searchText.includes('grundstück') || searchText.includes('grundstueck') || searchText.includes('land')) {
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
 * Normalize German condition values
 */
function normalizeCondition(condition: string): GermanSpecificFields['condition'] {
  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('erstbezug') || conditionLower.includes('neuwertig')) {
    return 'new';
  }

  if (conditionLower.includes('saniert') || conditionLower.includes('renoviert')) {
    return 'after_renovation';
  }

  if (conditionLower.includes('gepflegt') || conditionLower.includes('gut')) {
    return 'good';
  }

  if (conditionLower.includes('modernisiert')) {
    return 'very_good';
  }

  if (conditionLower.includes('sanierungs') || conditionLower.includes('renovierungs')) {
    return 'requires_renovation';
  }

  if (conditionLower.includes('projekt')) {
    return 'project';
  }

  if (conditionLower.includes('im bau') || conditionLower.includes('neubau')) {
    return 'under_construction';
  }

  return undefined;
}

/**
 * Normalize German energy rating
 */
function normalizeEnergyRating(rating: string): GermanSpecificFields['energy_rating'] {
  // German energy ratings: A+ to H
  const ratingUpper = rating.toUpperCase().trim();

  // Extract letter rating
  const match = ratingUpper.match(/([A-G])[+]?/);
  if (match) {
    const letter = match[1].toLowerCase();
    if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(letter)) {
      return letter as 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
    }
  }

  return 'unknown';
}

/**
 * Normalize German heating types
 */
function normalizeHeatingType(heating: string): GermanSpecificFields['heating_type'] {
  const heatingLower = heating.toLowerCase();

  if (heatingLower.includes('zentralheizung')) {
    return 'central_heating';
  }

  if (heatingLower.includes('fernwärme')) {
    return 'district_heating';
  }

  if (heatingLower.includes('fußbodenheizung')) {
    return 'floor_heating';
  }

  if (heatingLower.includes('gas')) {
    return 'gas_heating';
  }

  if (heatingLower.includes('öl')) {
    return 'oil_heating';
  }

  if (heatingLower.includes('wärmepumpe')) {
    return 'heat_pump';
  }

  if (heatingLower.includes('elektro')) {
    return 'electric_heating';
  }

  if (heatingLower.includes('warm') && heatingLower.includes('wasser')) {
    return 'hot_water';
  }

  if (heatingLower.includes('solar')) {
    return 'other';
  }

  return 'unknown';
}

/**
 * Normalize German furnished status
 */
function normalizeFurnished(furnished: string): GermanSpecificFields['furnished'] {
  const furnishedLower = furnished.toLowerCase();

  // Check specific variants before generic 'möbliert' to avoid false matches
  if (furnishedLower.includes('unmöbliert') || furnishedLower.includes('keine') || furnishedLower.includes('nicht')) {
    return 'not_furnished';
  }

  if (furnishedLower.includes('teilmöbliert') || furnishedLower.includes('teil')) {
    return 'partially_furnished';
  }

  if (furnishedLower.includes('möbliert') || furnishedLower.includes('voll')) {
    return 'furnished';
  }

  return 'not_furnished';
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
