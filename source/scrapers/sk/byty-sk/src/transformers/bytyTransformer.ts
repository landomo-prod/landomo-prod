import { StandardProperty } from '@landomo/core';
import { BytyListing } from '../types/bytyTypes';

type SlovakCondition = 'new' | 'excellent' | 'very_good' | 'good' | 'after_renovation' |
  'after_partial_renovation' | 'before_renovation' | 'original' |
  'under_construction' | 'neglected';

export function transformBytyToStandard(listing: BytyListing): StandardProperty & Record<string, any> {
  // Extract rooms from details
  const rooms = extractRoomsFromDetails(listing.details);

  return {
    // Category (required for partition routing)
    property_category: mapPropertyType(listing.propertyType) as 'apartment' | 'house' | 'land',

    title: listing.title,
    price: listing.price,
    currency: listing.currency || 'EUR',
    property_type: mapPropertyType(listing.propertyType),
    transaction_type: mapTransactionType(listing.transactionType),
    source_url: listing.url,

    location: {
      address: listing.location,
      city: extractCity(listing.location),
      country: 'sk',
      coordinates: undefined
    },

    details: {
      bedrooms: rooms,
      bathrooms: rooms ? Math.max(1, Math.floor(rooms / 2)) : undefined,
      sqm: listing.area,
      floor: listing.floor,
      rooms: rooms,
      renovation_year: extractRenovationYearFromDetails(listing.details),
      parking_spaces: extractParkingFromDetails(listing.details) ? 1 : undefined,
    },

    price_per_sqm: listing.price && listing.area ? Math.round(listing.price / listing.area) : undefined,

    // Universal Tier 1 fields (promoted from country_specific for cross-country querying)
    condition: mapConditionToEnglish(extractConditionFromDetails(listing.details)),
    heating_type: undefined,
    furnished: undefined,
    construction_type: undefined,
    available_from: undefined,
    published_date: listing.date,
    deposit: undefined,
    parking_spaces: extractParkingFromDetails(listing.details) ? 1 : undefined,

    portal_metadata: {
      byty_sk: {
        original_id: listing.id,
        date: listing.date,
        details: listing.details
      }
    },

    // Country-specific fields (Slovakia) - uses SlovakSpecificFields interface
    country_specific: {
      disposition: rooms ? normalizeDisposition(`${rooms}-izbový`) : undefined,
      ownership: 'other' as const,
      condition: mapConditionToEnglish(extractConditionFromDetails(listing.details)),
      furnished: undefined,
      energy_rating: undefined,
      heating_type: undefined,
      construction_type: undefined
    },
    // Dedicated DB columns for bulk-operations extraction
    ...({ slovak_disposition: rooms ? normalizeDisposition(`${rooms}-izbový`) : undefined, slovak_ownership: 'iné' } as Record<string, unknown>),

    images: listing.imageUrl ? [listing.imageUrl] : [],
    description: listing.description,
    description_language: 'sk',
    status: 'active'
  };
}

/**
 * SAFETY FIX: Unknown types mapped to 'house' to prevent transformation errors
 * Full category routing pending - see task #14
 */
function mapPropertyType(propertyType: string): string {
  const typeMap: Record<string, string> = {
    'byty': 'apartment',
    'domy': 'house',
    'pozemky': 'land',
    // Safety mappings
    'komerčné': 'house',
    'komercne': 'house',
    'garáže': 'house',
    'garaze': 'house'
  };
  return typeMap[propertyType.toLowerCase()] || 'house';  // Default to house
}

function mapTransactionType(transactionType: string): 'sale' | 'rent' {
  const typeMap: Record<string, 'sale' | 'rent'> = {
    'predaj': 'sale',
    'prenajom': 'rent'
  };
  return typeMap[transactionType.toLowerCase()] || 'sale';
}

function extractCity(location: string): string {
  if (!location) return '';
  return location.split(/[-,]/)[0].trim().replace(/\s*\d+$/, '') || location;
}

function extractRoomsFromDetails(details?: string[]): number | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const match = detail.match(/(\d)\s*izb/i);
    if (match) {
      return parseInt(match[1]);
    }
  }

  return undefined;
}

function extractConditionFromDetails(details?: string[]): string | undefined {
  if (!details) return undefined;

  const conditionKeywords = ['novostavba', 'nový', 'new', 'rekonštrukcia', 'renovation'];

  for (const detail of details) {
    const lower = detail.toLowerCase();
    for (const keyword of conditionKeywords) {
      if (lower.includes(keyword)) {
        if (keyword.includes('novo')) return 'novostavba';
        if (keyword.includes('rekonštruk')) return 'po_rekonštrukcii';
      }
    }
  }

  return undefined;
}

/**
 * Normalize disposition string to standard format (e.g. "2-izbový" -> "2-room")
 */
function normalizeDisposition(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const match = input.match(/(\d)\s*[-\s]?\s*izb/i);
  if (match) {
    const rooms = parseInt(match[1]);
    if (rooms >= 1 && rooms <= 6) return `${rooms}-room`;
    if (rooms > 6) return '6-room-plus';
  }
  return undefined;
}

/**
 * Map Slovak condition to English canonical values for SlovakSpecificFields
 */
function mapConditionToEnglish(slovakCondition: string | undefined): SlovakCondition | undefined {
  if (!slovakCondition) return undefined;
  const mapping: Record<string, SlovakCondition> = {
    'novostavba': 'new',
    'po_rekonštrukcii': 'after_renovation'
  };
  return mapping[slovakCondition];
}

/**
 * Extract renovation year from details array
 */
function extractRenovationYearFromDetails(details?: string[]): number | undefined {
  if (!details) return undefined;

  for (const detail of details) {
    const match = detail.match(/rekonštruk.*?(\d{4})/i);
    if (match) {
      const year = parseInt(match[1]);
      if (year >= 1800 && year <= 2100) return year;
    }
  }

  return undefined;
}

/**
 * Extract parking availability from details array
 */
function extractParkingFromDetails(details?: string[]): boolean {
  if (!details) return false;

  for (const detail of details) {
    const lower = detail.toLowerCase();
    if (lower.includes('parkovani') || lower.includes('parkovac') ||
        lower.includes('garáž') || lower.includes('garaz') || lower.includes('parking')) {
      return true;
    }
  }

  return false;
}
