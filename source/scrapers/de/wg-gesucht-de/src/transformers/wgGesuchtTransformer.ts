import { StandardProperty, GermanSpecificFields } from '@landomo/core';
import { WGGesuchtOffer } from '../types/wgGesuchtTypes';

/**
 * Transform WG-Gesucht offer to StandardProperty format
 */
export function transformWGGesuchtToStandard(offer: WGGesuchtOffer): StandardProperty & Record<string, any> {
  const sqm = offer.size || offer.apartment_size;
  const price = offer.rent || offer.rent_cold || 0;

  const propertyType = mapPropertyType(offer.category);

  return {
    // Category (required for partitioned DB)
    property_category: mapPropertyCategory(propertyType),

    // Basic info
    title: offer.title || `${offer.category || 'Room'} in ${offer.city || 'Germany'}`,
    price: price,
    currency: 'EUR',
    property_type: propertyType,
    transaction_type: 'rent',
    source_url: offer.url || `https://www.wg-gesucht.de/${offer.id}`,
    source_platform: 'wg-gesucht',

    // Location
    location: {
      address: offer.street,
      city: offer.city || 'Unknown',
      region: offer.district,
      country: 'Germany',
      postal_code: offer.zip_code,
      coordinates: offer.latitude && offer.longitude ? {
        lat: offer.latitude,
        lon: offer.longitude
      } : undefined
    },

    // Details
    details: {
      bedrooms: extractBedrooms(offer),
      bathrooms: undefined, // Typically shared in WG, not reliably available
      sqm: sqm,
      floor: offer.floor,
      total_floors: offer.total_floors,
      rooms: offer.rooms,
      year_built: offer.year_built,
      renovation_year: undefined, // Not available from WG-Gesucht
    },

    // Financial details
    price_per_sqm: price && sqm ? Math.round(price / sqm) : undefined,
    hoa_fees: offer.utilities,

    // ============ Universal Tier 1 fields ============
    condition: undefined, // Not available from WG-Gesucht
    heating_type: undefined, // Not available from WG-Gesucht
    furnished: normalizeFurnished(offer.furniture || offer.furnished),
    construction_type: undefined, // Not available from WG-Gesucht
    available_from: offer.available_from,
    published_date: offer.online_since || undefined,
    deposit: offer.deposit,
    parking_spaces: offer.parking ? 1 : undefined,

    // Portal metadata (WG-Gesucht-specific fields)
    portal_metadata: {
      wg_gesucht: {
        offer_id: offer.id || offer.offer_id,
        category: offer.category,
        offer_type: offer.offer_type,
        rent_type: offer.rent_type,
        rent_cold: offer.rent_cold,
        utilities: offer.utilities,
        deposit: offer.deposit,
        available_from: offer.available_from,
        available_to: offer.available_to,
        available_duration: offer.available_duration,
        furniture: offer.furniture,
        flatmates: offer.flatmates,
        online_since: offer.online_since,
        last_modified: offer.last_modified,
        views: offer.views,
        user_id: offer.user_id
      }
    },

    // Country-specific fields (Germany)
    country_specific: {
      // German-specific fields
      furnished: normalizeFurnished(offer.furniture || offer.furnished),

      // Availability
      available_from: offer.available_from,
      available_to: offer.available_to,

      // WG-specific (shared housing)
      wg_type: offer.category === 'WG-Zimmer' ? 'shared_flat' : undefined,
      flatmates_total: offer.flatmates?.total,
      flatmates_male: offer.flatmates?.male,
      flatmates_female: offer.flatmates?.female,
      looking_for_gender: offer.flatmates?.looking_for,
      flatmate_age_range: offer.flatmates?.age_min && offer.flatmates?.age_max
        ? `${offer.flatmates.age_min}-${offer.flatmates.age_max}`
        : undefined,

      // Features
      has_internet: offer.internet,
      has_kitchen: offer.kitchen,
      smoking_allowed: (offer as any).features?.smoking,
      pets_allowed: (offer as any).features?.pets,

      // Building
      apartment_size: offer.apartment_size,
      bedroom_size: offer.bedroom_size,

      // Areas
      area_living: sqm,

      // Building details
      year_built: offer.year_built,
      total_floors: offer.total_floors,

      // Images
      image_urls: offer.images || [],
      image_count: offer.image_count || offer.images?.length || 0,
      thumbnail_url: offer.thumbnail
    } as GermanSpecificFields,

    // German-specific indexed columns (top-level for bulk-operations.ts)
    german_ownership: undefined,
    german_hausgeld: undefined,
    german_courtage: undefined,
    german_kfw_standard: undefined,
    german_is_denkmalschutz: false,

    // Amenities - extracted from offer fields
    amenities: {
      has_parking: offer.parking,
      has_balcony: offer.balcony,
      has_garden: offer.garden,
      has_elevator: offer.elevator,
      is_barrier_free: offer.barrier_free,
      has_wifi: offer.internet,
      is_furnished: offer.furnished || offer.furniture === 'furnished',
      is_pet_friendly: (offer as any).features?.pets
    },

    // Media
    media: {
      images: offer.images || [],
      total_images: offer.image_count || offer.images?.length || 0
    },

    // Agent/Contact
    agent: offer.contact ? {
      name: offer.contact.name || 'Unknown',
      phone: offer.contact.phone,
      email: offer.contact.email
    } : undefined,

    // Backward compatibility
    images: offer.images || [],
    description: offer.description || (offer as any).description_long,
    description_language: 'de',

    // Status
    status: 'active'
  } as any;
}

/**
 * Map property type to category partition
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (propertyType) {
    case 'house':
      return 'house';
    default:
      return 'apartment'; // room, apartment, studio all map to apartment partition
  }
}

/**
 * Map WG-Gesucht category to standard property type
 */
function mapPropertyType(category?: string): string {
  if (!category) return 'room';

  const lower = category.toLowerCase();

  if (lower.includes('wg') || lower.includes('zimmer')) {
    return 'room'; // Shared flat room
  } else if (lower.includes('wohnung') || lower.includes('apartment')) {
    return 'apartment';
  } else if (lower.includes('haus') || lower.includes('house')) {
    return 'house';
  } else if (lower.includes('studio') || lower.includes('1-zimmer')) {
    return 'studio';
  }

  return 'room';
}

/**
 * Extract bedroom count
 * For WG rooms, typically 1 bedroom (the rented room)
 * For apartments, use rooms count
 */
function extractBedrooms(offer: WGGesuchtOffer): number | undefined {
  if (offer.category?.toLowerCase().includes('wg') || offer.category?.toLowerCase().includes('zimmer')) {
    return 1; // WG room is typically 1 bedroom
  }

  return offer.rooms;
}

/**
 * Normalize furnished status from various formats
 */
function normalizeFurnished(input?: string | boolean): GermanSpecificFields['furnished'] {
  if (input === undefined || input === null) return undefined;

  if (typeof input === 'boolean') {
    return input ? 'furnished' : 'not_furnished';
  }

  const lower = String(input).toLowerCase().trim();

  if (lower === 'furnished' || lower === 'möbliert' || lower === 'mobliert' || lower === 'vollmöbliert') {
    return 'furnished';
  }

  if (lower === 'partially_furnished' || lower === 'teilmöbliert' || lower === 'teilmobliert') {
    return 'partially_furnished';
  }

  if (lower === 'unfurnished' || lower === 'unmöbliert' || lower === 'unmobliert' || lower === 'leer') {
    return 'not_furnished';
  }

  return undefined;
}

/**
 * Extract city name from location string
 */
function extractCity(location?: string): string {
  if (!location) return 'Unknown';

  // Extract city from location string
  const parts = location.split(',');
  return parts[0]?.trim() || location;
}
