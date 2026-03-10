/**
 * Shared helper functions for SReality transformers
 * Used across all category-specific transformers (apartments, houses, land)
 */

import { SRealityListing } from '../types/srealityTypes';

// Czech transaction type mappings
const TRANSACTION_MAP: Record<number, string> = {
  1: 'prodej',      // Sale
  2: 'pronajem',    // Rent
  3: 'drazby',      // Auction
  4: 'podily'       // Shared (co-ownership)
};

// Czech property type mappings
const PROPERTY_TYPE_MAP: Record<number, string> = {
  1: 'byt',         // Apartment
  2: 'dum',         // House
  3: 'pozemek',     // Land
  4: 'komercni',    // Commercial
  5: 'ostatni'      // Other
};

// Per-category subcategory mappings (category_sub_cb → URL slug)
// Keyed by category_main_cb, then by category_sub_cb
const SUBCATEGORY_MAPS: Record<number, Record<number, string>> = {
  // Apartments (category_main_cb = 1)
  1: {
    2: '1+kk',
    3: '1+1',
    4: '2+kk',
    5: '2+1',
    6: '3+kk',
    7: '3+1',
    8: '4+kk',
    9: '4+1',
    10: '5+kk',
    11: '5+1',
    12: '6-a-vice',
    16: 'atypicky',
    40: 'pokoj',
  },

  // Houses (category_main_cb = 2)
  2: {
    33: 'chalupa',
    37: 'rodinny',
    38: 'cinzovni',
    39: 'chata',
    43: 'vila',
    44: 'na-klic',
    46: 'chalupa',
    47: 'zemedelska',
    55: 'vicegeneracni',
  },

  // Land (category_main_cb = 3)
  3: {
    18: 'komercni',
    19: 'bydleni',
    20: 'pole',
    21: 'louka',
    22: 'les',
    23: 'zahrada',
    24: 'ostatni-pozemky',
  },

  // Commercial (category_main_cb = 4)
  4: {
    25: 'kancelare',
    26: 'sklad',
    27: 'vyrobni-prostor',
    28: 'obchodni-prostor',
    29: 'ubytovani',
    30: 'restaurace',
    31: 'zemedelsky',
    32: 'ostatni-komercni-prostory',
    38: 'cinzovni-dum',
    56: 'ordinace',
    57: 'apartman',
  },

  // Other (category_main_cb = 5)
  5: {
    34: 'garaz',
    36: 'jine-nemovitosti',
    51: 'pudni-prostor',
    52: 'garazove-stani',
    53: 'mobilni-domek',
  },
};

/**
 * Numeric category_sub_cb → Czech disposition string (for apartment disposition fallback)
 * Used when disposition cannot be extracted from title or items array
 */
export const DISPOSITION_CODES: Record<number, string> = {
  2: '1+kk', 3: '1+1', 4: '2+kk', 5: '2+1',
  6: '3+kk', 7: '3+1', 8: '4+kk', 9: '4+1',
  10: '5+kk', 11: '5+1', 12: '6+', 16: 'atypický', 40: 'pokoj'
};

/**
 * Extract the correct source URL from SReality listing
 * Constructs SEO-friendly URL from listing data
 * Format: https://www.sreality.cz/detail/prodej/byt/2+kk/praha-smichov-strakonicka/3586114124
 *
 * Falls back to simple hash_id format if required data not available
 */
export function extractSourceUrl(listing: SRealityListing, hashId: number): string {
  try {
    const categoryType = listing.seo?.category_type_cb;
    const categoryMain = listing.seo?.category_main_cb;
    const categorySub = listing.seo?.category_sub_cb;
    const locality = listing.seo?.locality;

    // Need at least transaction type and property type
    if (typeof categoryType !== 'number' || typeof categoryMain !== 'number' || !hashId) {
      return `https://www.sreality.cz/detail/${hashId}`;
    }

    const transaction = TRANSACTION_MAP[categoryType as number];
    const propertyType = PROPERTY_TYPE_MAP[categoryMain as number];

    if (!transaction || !propertyType) {
      return `https://www.sreality.cz/detail/${hashId}`;
    }

    // Build URL parts
    const parts = ['/detail', transaction, propertyType];

    // Add subcategory (disposition/subtype) if available
    const categorySubMap = SUBCATEGORY_MAPS[categoryMain];
    if (typeof categorySub === 'number' && categorySubMap?.[categorySub]) {
      parts.push(categorySubMap[categorySub]);
    }

    // Add locality slug if available
    if (locality) {
      parts.push(locality);
    }

    // Add hash_id
    parts.push(String(hashId));

    return `https://www.sreality.cz${parts.join('/')}`;
  } catch (error) {
    // Fallback to simple format on any error
    return `https://www.sreality.cz/detail/${hashId}`;
  }
}

/**
 * Extract bedrooms from Czech disposition notation
 *
 * Examples:
 *   "2+kk" → 1 (2 rooms, kitchenette = 1 bedroom)
 *   "3+1" → 2 (3 rooms + kitchen = 2 bedrooms)
 *   "4+kk" → 3
 */
export function bedroomsFromDisposition(disposition?: string): number | undefined {
  if (!disposition) return undefined;

  const match = disposition.match(/^(\d)\+(?:kk|1)/i);
  if (!match) return undefined;

  const roomCount = parseInt(match[1]);

  // Logic: disposition - 1 = bedrooms (one room is living room)
  // "1+kk" → 0 bedrooms (studio)
  // "2+kk" → 1 bedroom
  // "3+1" → 2 bedrooms
  return Math.max(0, roomCount - 1);
}

/**
 * Extract disposition from title string
 * Sreality API doesn't provide disposition as a separate field - it's embedded in the title
 *
 * Examples:
 *   "Prodej bytu 2+kk 45 m²" → "2+kk"
 *   "Pronájem bytu 3+1 80 m²" → "3+1"
 *   "Prodej bytu 4+1 132 m² (Mezonet)" → "4+1"
 *   "Pronájem pokoje 10 m²" → undefined (no disposition)
 */
export function extractDispositionFromTitle(title?: string): string | undefined {
  if (!title) return undefined;

  // Match pattern: digit + (+kk or +1)
  // Handles: 1+kk, 2+1, 3+kk, 4+1, etc.
  // Match standard disposition: 1+kk, 2+1, 3+kk, etc.
  const match = title.match(/(\d\+(?:kk|1))/i);
  if (match) return match[1];

  // Match atypical layouts
  if (/atyp/i.test(title)) return 'atypický';

  return undefined;
}

/**
 * Map Czech ownership type to normalized enum
 *
 * Czech → English:
 *   "Osobní" → "personal"
 *   "Družstevní" → "cooperative"
 *   "Státní" → "state"
 */
export function mapOwnership(raw?: string): 'personal' | 'cooperative' | 'state' | 'municipal' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().trim();

  if (normalized.includes('osobní') || normalized.includes('ov')) return 'personal';
  if (normalized.includes('družstevní') || normalized.includes('db')) return 'cooperative';
  if (normalized.includes('státní')) return 'state';
  if (normalized.includes('obecní') || normalized.includes('městský')) return 'municipal';

  return undefined;
}

/**
 * Extract floor information from Czech format
 *
 * Examples:
 *   "3. podlaží" → { floor: 3 }
 *   "přízemí" → { floor: 0 }
 *   "3/5" → { floor: 3, total_floors: 5 }
 */
export function extractFloorInfo(raw?: string): { floor?: number; total_floors?: number } {
  if (!raw) return {};

  const str = raw.toLowerCase();

  // Ground floor
  if (str.includes('přízemí') || str.includes('prizemi')) {
    return { floor: 0 };
  }

  // Format: "3/5" (floor 3 of 5)
  const slashMatch = str.match(/(\d+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    return {
      floor: parseInt(slashMatch[1]),
      total_floors: parseInt(slashMatch[2])
    };
  }

  // Format: "3. podlaží z celkem 5 včetně 1 podzemního"
  // Also handles: "3. podlazi z celkem 5"
  const celkemMatch = str.match(/(\d+)\.\s*podla[zž][ií]\s+z\s+celkem\s+(\d+)/);
  if (celkemMatch) {
    return {
      floor: parseInt(celkemMatch[1]),
      total_floors: parseInt(celkemMatch[2])
    };
  }

  // Format: "3. podlaží" (floor only, no total)
  const floorMatch = str.match(/(\d+)/);
  if (floorMatch) {
    return { floor: parseInt(floorMatch[1]) };
  }

  return {};
}

/**
 * Map SReality category_sub_cb to property subtype
 *
 * Subtypes (from SReality API):
 *   7 → "detached" (Rodinný dům)
 *   11 → "terraced" (Řadový dům)
 *   8 → "semi_detached" (Dvojdomek)
 *
 * Note: API can return either numeric ID or string SEO slug
 * This function handles numeric IDs only (ignores string slugs)
 */
export function mapSubType(categorySubId?: number | string): string | undefined {
  // Ignore string SEO slugs (e.g., "byt-2-kk")
  if (typeof categorySubId === 'string') {
    return undefined;
  }

  if (!categorySubId) {
    return undefined;
  }

  const subTypeMap: Record<number, string> = {
    7: 'detached',
    11: 'terraced',
    8: 'semi_detached',
    47: 'villa',
    52: 'farm'
  };

  return subTypeMap[categorySubId];
}

/**
 * Parse numeric area from Czech format
 *
 * Examples:
 *   "150 m²" → 150
 *   "150,5 m²" → 150.5
 *   "150" → 150
 */
export function parseArea(raw?: string): number | undefined {
  if (!raw) return undefined;

  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/m²|m2/gi, '')
    .replace(',', '.')
    .trim();

  const parsed = parseFloat(normalized);
  return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Extract value from SReality items array
 */
export function findItemValue(
  items: Array<{ name: string; value: any }> | undefined,
  ...fieldNames: string[]
): string | undefined {
  if (!items) return undefined;

  const item = items.find(i => fieldNames.includes(i.name));
  return item ? getItemValueAsString(item.value) : undefined;
}

/**
 * Convert item value to string (handles various formats)
 */
export function getItemValueAsString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0];
    if (typeof firstItem === 'object' && 'value' in firstItem) {
      return getItemValueAsString(firstItem.value);
    }
    if (typeof firstItem === 'string') return firstItem;
  }
  return String(value);
}

/**
 * Handle SReality fields that can be either a plain string or {value: string}
 * List API returns plain strings, detail API returns objects
 */
export function getStringOrValue(field: any): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field.value) return String(field.value);
  return undefined;
}

/**
 * Extract city from locality string
 * Example: "Praha 6 - Dejvice, Podbaba" → "Praha"
 */
export function extractCity(locality: string): string {
  if (!locality) return 'Unknown';

  // Extract city from "Praha 6 - Dejvice, Podbaba" → "Praha"
  const cityMatch = locality.match(/^([^,-\d]+)/);
  return cityMatch ? cityMatch[1].trim() : locality.split(/[-,]/)[0]?.trim() || locality;
}

/**
 * Check if value indicates a positive boolean (handles both numeric and string values)
 *
 * Examples:
 *   "Ano" → true
 *   "ano" → true
 *   "Yes" → true
 *   3 → true (area value)
 *   13 → true (area value)
 *   "Ne" → false
 *   "no" → false
 */
export function isPositiveValue(value: any): boolean {
  if (value === undefined || value === null) return false;

  // Numeric values > 0 are positive (areas, counts, etc.)
  if (typeof value === 'number') {
    return value > 0;
  }

  // String values
  const str = String(value).toLowerCase().trim();

  if (str === '' || str === 'ne' || str === 'no' || str === 'false') {
    return false;
  }

  // Check if string is a numeric value > 0 (handles "3", "13", "150,5", "150.5")
  const numValue = parseFloat(str.replace(',', '.'));
  if (!isNaN(numValue) && numValue > 0) {
    return true;
  }

  // Check for positive indicators
  return str.includes('ano') ||
         str.includes('yes') ||
         str.includes('true') ||
         str.includes('connected');
}

/**
 * Ensure boolean value is never undefined
 * Converts boolean | undefined → boolean (always false if undefined)
 *
 * @param value Boolean value or undefined
 * @returns Boolean (never undefined)
 *
 * Example:
 * ```typescript
 * const hasElevator = ensureBoolean(someValue); // Always boolean, never undefined
 * ```
 */
export function ensureBoolean(value: boolean | undefined): boolean {
  return value === true;
}

/**
 * Extract hash_id from SReality API self URL
 *
 * Examples:
 *   "/cs/v2/estates/2013881164" → 2013881164
 *   "https://www.sreality.cz/api/cs/v2/estates/2013881164" → 2013881164
 */
export function extractHashIdFromUrl(url?: string): number | undefined {
  if (!url) return undefined;

  const match = url.match(/\/estates\/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Numeric ownership code → normalized string
 * Source: codeItems.ownership in detail API response
 */
export const OWNERSHIP_CODES: Record<number, 'personal' | 'cooperative' | 'state'> = {
  1: 'personal',
  2: 'cooperative',
  3: 'state',
};

/**
 * Numeric building type code → normalized string
 * Source: codeItems.building_type_search in detail API response
 */
export const BUILDING_TYPE_CODES: Record<number, string> = {
  1: 'wood',
  2: 'brick',
  3: 'stone',
  4: 'prefab',
  5: 'panel',
  6: 'skeleton',
  7: 'mixed',
  8: 'modular',
};

/**
 * Extract seller information from _embedded.seller using actual detail API fields.
 *
 * The detail API uses:
 *   seller.user_name   → agent's name
 *   seller.phones[]    → array of {code, type, number}
 *   seller.email       → agent's direct email
 *   seller._embedded.premise.name  → agency name
 *
 * @param embedded _embedded section from SReality API response
 * @returns Seller info object or undefined
 */
export function extractSellerInfo(embedded: any): {
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
  agent_agency?: string;
  logo_url?: string;
} | undefined {
  if (!embedded || !embedded.seller) return undefined;

  const seller = embedded.seller;

  // Build phone: prefer phones[] array with country code prefix
  let agent_phone: string | undefined;
  if (Array.isArray(seller.phones) && seller.phones.length > 0) {
    const p = seller.phones[0];
    agent_phone = p.code ? `+${p.code}${p.number}` : p.number;
  } else if (seller.phone) {
    agent_phone = seller.phone;
  }

  return {
    agent_name: seller.user_name || seller.name || seller.company_name,
    agent_phone,
    agent_email: seller.email,
    agent_agency: seller._embedded?.premise?.name || seller.company_name || seller.company,
    logo_url: seller.logo?._links?.self?.href || seller.logo_url,
  };
}

/**
 * Extract feature booleans from labelsAll[0] tag array (list API).
 * This supplements items[] boolean extraction and is the primary source
 * when detail data is not available (unchanged listings that skip detail fetch).
 *
 * @param labelsAll labelsAll field from list API response
 * @returns Object of feature flags
 */
export function extractLabelsFeatures(labelsAll?: string[][]): {
  has_balcony: boolean;
  has_elevator: boolean;
  has_basement: boolean;
  has_garage: boolean;
  has_parking: boolean;
  has_terrace: boolean;
  has_loggia: boolean;
  furnished?: 'furnished' | 'partially_furnished';
  condition?: 'new';
  ownership?: 'personal';
} {
  const tags = labelsAll?.[0] || [];
  return {
    has_balcony: tags.includes('balcony'),
    has_elevator: tags.includes('elevator'),
    has_basement: tags.includes('cellar'),
    has_garage: tags.includes('garage'),
    has_parking: tags.includes('parking'),
    has_terrace: tags.includes('terrace'),
    has_loggia: tags.includes('loggia'),
    furnished: tags.includes('furnished') ? 'furnished'
      : tags.includes('partly_furnished') ? 'partially_furnished'
      : undefined,
    condition: tags.includes('new_building') ? 'new' : undefined,
    ownership: tags.includes('personal') ? 'personal' : undefined,
  };
}

/**
 * Extract structured image data from listing
 * Handles both _links and _embedded.images formats
 *
 * @param listing SReality listing object
 * @returns Array of image objects with multiple sizes
 *
 * Format returned:
 * ```typescript
 * [
 *   {
 *     thumbnail: "https://...",  // dynamicDown - 400x300
 *     preview: "https://...",    // dynamicUp - 800x600
 *     full: "https://..."        // gallery - original
 *   }
 * ]
 * ```
 */
/**
 * Replace template placeholders in SReality image URL with concrete dimensions.
 * SReality dynamic URLs contain {width} and {height} placeholders.
 */
function resolveImageUrl(href: string | undefined, width: number, height: number): string | undefined {
  if (!href) return undefined;
  return href.replace('{width}', String(width)).replace('{height}', String(height));
}

export function extractImages(listing: any): Array<{
  thumbnail?: string;
  preview?: string;
  full?: string;
}> {
  const images: Array<{ thumbnail?: string; preview?: string; full?: string }> = [];

  // Method 1: Extract from _embedded.images (detail endpoint)
  // Sort by order field if present, then extract URLs.
  // Priority for full-res: self.href (1920×1080) > view.href (749×562) > dynamicUp resolved
  if (listing._embedded?.images && Array.isArray(listing._embedded.images)) {
    const sorted = [...listing._embedded.images].sort((a: any, b: any) =>
      (a.order ?? 0) - (b.order ?? 0)
    );
    for (const img of sorted) {
      if (img._links) {
        images.push({
          thumbnail: resolveImageUrl(img._links.dynamicDown?.href, 400, 300),
          preview: resolveImageUrl(img._links.dynamicUp?.href, 800, 600),
          // Prefer view (fixed 749x562) over template dynamicUp; self.href is highest res
          full: img._links.self?.href || img._links.view?.href || resolveImageUrl(img._links.dynamicUp?.href, 1200, 900),
        });
      }
    }
  }

  // Method 2: Extract from _links.dynamicUp/dynamicDown (list endpoint)
  // These are already resolved URLs (no {width}/{height} template)
  if (images.length === 0 && listing._links) {
    const dynamicUp = listing._links.dynamicUp || [];
    const dynamicDown = listing._links.dynamicDown || [];

    const maxLength = Math.max(dynamicUp.length, dynamicDown.length);

    for (let i = 0; i < maxLength; i++) {
      images.push({
        thumbnail: dynamicDown[i]?.href,
        preview: dynamicUp[i]?.href,
        full: dynamicUp[i]?.href,
      });
    }
  }

  return images;
}

/**
 * Extract virtual tour URL (360° panorama) from listing
 * Checks multiple possible locations for Matterport/panorama URLs
 *
 * @param listing SReality listing object (can include _embedded)
 * @returns Virtual tour URL or undefined
 *
 * Example:
 * ```typescript
 * const virtualTour = extractVirtualTourUrl(listing);
 * // "https://my.matterport.com/show/?m=..."
 * ```
 */
export function extractVirtualTourUrl(listing: any): string | undefined {
  // Check _embedded.matterport_url
  if (listing._embedded?.matterport_url) {
    return listing._embedded.matterport_url;
  }

  // Check top-level matterport_url
  if (listing.matterport_url) {
    return listing.matterport_url;
  }

  // Check has_panorama flag
  if (listing.has_panorama === 1) {
    // Virtual tour exists but URL not directly available
    // Return a flag to indicate availability
    return 'available'; // Caller can check for this
  }

  return undefined;
}

/**
 * Extract video URL from listing
 *
 * @param listing SReality listing object
 * @returns Video URL or undefined
 */
export function extractVideoUrl(listing: any): string | undefined {
  return listing._embedded?.video?.url || listing.video?.url;
}

/**
 * Extract area (sqm) from listing title as fallback
 * ~50% of listings only have area in the title string
 *
 * Examples:
 *   "Prodej bytu 2+kk 42 m²" → 42
 *   "Pronájem bytu 3+1 80m2" → 80
 *   "Prodej pozemku 1500 m²" → 1500
 */
export function extractAreaFromTitle(title: string): number | undefined {
  if (!title) return undefined;
  const match = title.match(/(\d+)\s*m[²2]/i);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Extract commission info from the SReality price note field (Poznamka k cene).
 *
 * SReality has no structured boolean for commission — only the free-text price note.
 * We pass the raw note through as commission_note without inferring is_commission.
 *
 * @param priceNote listing.price_czk?.name value from SReality API
 * @returns Object with optional commission_note string (is_commission never set)
 */
export function extractCommissionInfo(priceNote: string | undefined): {
  commission_note?: string;
} {
  if (!priceNote) return {};
  return { commission_note: priceNote };
}

/**
 * Parse available_from string from SReality API into an ISO date string.
 * Returns undefined for non-date values like "Ihned" (Immediately), "Na dohodě" (By agreement).
 * Handles Czech date format DD.MM.YYYY → YYYY-MM-DD.
 */
export function parseAvailableFrom(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Czech DD.MM.YYYY format
  const czMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (czMatch) {
    const [, day, month, year] = czMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Any other non-date string (Ihned, Na dohodě, etc.) → discard
  return undefined;
}
