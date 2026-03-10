import { StandardProperty, GermanSpecificFields } from '@landomo/core';
import { KleinanzeigenListing } from '../types/kleinanzeigenTypes';

/**
 * Transform Kleinanzeigen listing to StandardProperty format
 */
export function transformKleinanzeigenToStandard(listing: KleinanzeigenListing): StandardProperty & Record<string, any> {
  // Extract basic info
  const price = listing.price?.amount || 0;
  const currency = listing.price?.currencyIsoCode || 'EUR';

  // Determine transaction type
  const transactionType = determineTransactionType(listing);

  // Extract property details
  const sqm = extractSqm(listing);
  const rooms = extractRooms(listing);

  const mappedType = mapPropertyType(listing);

  return {
    // Category (required for ingest)
    property_category: mapPropertyCategory(mappedType),

    // Basic info
    title: listing.title || 'Unknown',
    price: price,
    currency: currency,
    property_type: mappedType,
    transaction_type: transactionType,
    source_url: buildSourceUrl(listing),
    source_platform: 'kleinanzeigen',

    // Location
    location: {
      address: buildAddress(listing.location),
      city: listing.location?.city || 'Unknown',
      region: listing.location?.state,
      country: 'Germany',
      postal_code: listing.location?.zipCode,
      coordinates: listing.location?.latitude && listing.location?.longitude ? {
        lat: listing.location.latitude,
        lon: listing.location.longitude
      } : undefined
    },

    // Details
    details: {
      bedrooms: extractBedrooms(listing),
      bathrooms: undefined, // Kleinanzeigen typically doesn't provide this
      sqm: sqm,
      floor: listing.floor,
      total_floors: listing.numberOfFloors,
      rooms: rooms,
      year_built: listing.constructionYear,
      parking_spaces: listing.parking || listing.garage ? 1 : undefined,
    },

    // Financial details
    price_per_sqm: sqm && price ? Math.round(price / sqm) : undefined,

    // Portal metadata
    portal_metadata: {
      kleinanzeigen: {
        ad_id: listing.id,
        category_id: listing.categoryId,
        ad_type: listing.adType,
        start_date: listing.startDate,
        poster_name: listing.posterContact?.name || listing.imprint?.name,
        company_name: listing.imprint?.companyName,
        real_estate_type: listing.realEstateType,
        price_type: listing.price?.priceType
      }
    },

    // ============ Universal Tier 1 fields ============
    condition: normalizeCondition(listing.condition),
    heating_type: normalizeHeatingType(listing.heatingType),
    furnished: normalizeFurnished(listing.furnished),
    construction_type: undefined, // Kleinanzeigen does not provide construction material type
    available_from: (listing as any).availableFrom || undefined,
    published_date: listing.startDate || undefined,
    deposit: (listing as any).deposit || undefined,
    parking_spaces: listing.parking || listing.garage ? 1 : undefined,

    // Country-specific fields (German real estate)
    country_specific: {
      // Condition
      condition: normalizeCondition(listing.condition),

      // Furnished status
      furnished: normalizeFurnished(listing.furnished),

      // Energy rating
      energy_rating: (listing as any).energyRating ? normalizeEnergyRating((listing as any).energyRating) : undefined,

      // Heating
      heating_type: normalizeHeatingType(listing.heatingType),

      // Areas
      area_living: listing.livingSpace,
      area_plot: listing.plotArea,

      // Building details
      total_floors: listing.numberOfFloors,

      // Year
      year_built: listing.constructionYear,

      // Availability
      available_from: (listing as any).availableFrom || undefined,

      // Financial
      deposit: (listing as any).deposit || undefined,
    } as GermanSpecificFields,

    // German-specific indexed columns (top-level for bulk-operations.ts)
    german_ownership: undefined,
    german_hausgeld: undefined,
    german_courtage: undefined,
    german_kfw_standard: undefined,
    german_is_denkmalschutz: false,

    // Amenities
    amenities: extractAmenities(listing),

    // Media
    media: {
      images: extractImages(listing),
      total_images: (listing.images?.length || 0) + (listing.pictures?.length || 0)
    },

    // Description
    description: extractDescription(listing),
    description_language: 'de',

    // Backward compatibility
    images: extractImageUrls(listing),

    // Status
    status: 'active'
  } as any;
}

/**
 * Determine transaction type from listing
 */
function determineTransactionType(listing: KleinanzeigenListing): 'sale' | 'rent' {
  // Check category ID or price type
  const categoryId = listing.categoryId || listing.category?.id;

  // Rent categories: 203 (apartments for rent), 205 (houses for rent), 199 (WG-Zimmer)
  const rentCategories = [203, 205, 199];

  if (categoryId && rentCategories.includes(categoryId)) {
    return 'rent';
  }

  // Sale categories: 196 (apartments for sale), 208 (houses for sale), 207 (land/gardens)
  const saleCategories = [196, 208, 207];

  if (categoryId && saleCategories.includes(categoryId)) {
    return 'sale';
  }

  // Fallback: check price type
  if (listing.price?.priceType?.toLowerCase().includes('miete')) {
    return 'rent';
  }

  return 'sale'; // Default
}

/**
 * Map standard property type to property_category for DB partitioning
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  switch (propertyType) {
    case 'apartment': return 'apartment';
    case 'house': return 'house';
    case 'land': return 'land';
    case 'commercial': return 'commercial';
    case 'room': return 'apartment';
    case 'studio': return 'apartment';
    case 'parking': return 'commercial';
    default: return 'apartment';
  }
}

/**
 * Map Kleinanzeigen property type to standard type
 */
function mapPropertyType(listing: KleinanzeigenListing): string {
  const realEstateType = listing.realEstateType?.toLowerCase();
  const categoryId = listing.categoryId || listing.category?.id;

  if (realEstateType) {
    if (realEstateType.includes('apartment') || realEstateType.includes('wohnung')) return 'apartment';
    if (realEstateType.includes('house') || realEstateType.includes('haus')) return 'house';
    if (realEstateType.includes('studio')) return 'studio';
    if (realEstateType.includes('room') || realEstateType.includes('zimmer')) return 'room';
    if (realEstateType.includes('plot') || realEstateType.includes('grundstück')) return 'land';
  }

  // Fallback to category mapping (per REAL_ESTATE_CATEGORIES constants)
  if (categoryId === 203 || categoryId === 196) return 'apartment';
  if (categoryId === 205 || categoryId === 208) return 'house';
  if (categoryId === 199) return 'room'; // WG-Zimmer / temporary shared
  if (categoryId === 207) return 'land'; // Grundstücke & Gärten
  if (categoryId === 277) return 'commercial';
  if (categoryId === 197) return 'parking'; // Garagen & Stellplätze

  return 'other';
}

/**
 * Build source URL for listing
 */
function buildSourceUrl(listing: KleinanzeigenListing): string {
  if (listing.link) return listing.link;
  if (listing.url) return listing.url;
  return `https://www.kleinanzeigen.de/s-anzeige/${listing.id}`;
}

/**
 * Build full address string
 */
function buildAddress(location: KleinanzeigenListing['location']): string | undefined {
  if (!location) return undefined;

  const parts: string[] = [];
  if (location.street) parts.push(location.street);
  if (location.zipCode) parts.push(location.zipCode);
  if (location.city) parts.push(location.city);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Extract square meters
 */
function extractSqm(listing: KleinanzeigenListing): number | undefined {
  // Direct field
  if (listing.livingSpace) return listing.livingSpace;

  // Check attributes
  const sqmAttr = listing.attributes?.find(attr =>
    attr.name?.toLowerCase().includes('fläche') ||
    attr.name?.toLowerCase().includes('wohnfläche') ||
    attr.name?.toLowerCase().includes('living space')
  );

  if (sqmAttr?.value) {
    const match = sqmAttr.value.replace(/\s/g, '').match(/(\d+)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  // Check features
  if (listing.features) {
    for (const [key, value] of Object.entries(listing.features)) {
      if (key.toLowerCase().includes('fläche') || key.toLowerCase().includes('sqm')) {
        const match = value.replace(/\s/g, '').match(/(\d+)/);
        if (match) return parseFloat(match[1]);
      }
    }
  }

  return undefined;
}

/**
 * Extract room count
 */
function extractRooms(listing: KleinanzeigenListing): number | undefined {
  // Direct field
  if (listing.rooms) return listing.rooms;

  // Check attributes
  const roomAttr = listing.attributes?.find(attr =>
    attr.name?.toLowerCase().includes('zimmer') ||
    attr.name?.toLowerCase().includes('rooms')
  );

  if (roomAttr?.value) {
    const match = roomAttr.value.match(/(\d+)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  return undefined;
}

/**
 * Extract bedroom count (approximate from room count)
 */
function extractBedrooms(listing: KleinanzeigenListing): number | undefined {
  const rooms = extractRooms(listing);

  // German convention: total rooms - 1 (for living room) = bedrooms
  // But only if we have more than 1 room
  if (rooms && rooms > 1) {
    return Math.floor(rooms - 1);
  }

  return undefined;
}

/**
 * Extract amenities from listing
 */
function extractAmenities(listing: KleinanzeigenListing): StandardProperty['amenities'] {
  const amenities: StandardProperty['amenities'] = {};

  // Direct boolean fields
  if (listing.balcony !== undefined) amenities.has_balcony = listing.balcony;
  if (listing.garden !== undefined) amenities.has_garden = listing.garden;
  if (listing.cellar !== undefined) amenities.has_basement = listing.cellar;
  if (listing.lift !== undefined) amenities.has_elevator = listing.lift;
  if (listing.parking !== undefined) amenities.has_parking = listing.parking;
  if (listing.garage !== undefined) amenities.has_garage = listing.garage;

  // Check attributes
  if (listing.attributes) {
    for (const attr of listing.attributes) {
      const name = attr.name?.toLowerCase() || '';
      const value = attr.value?.toLowerCase() || '';

      if (name.includes('balkon') || name.includes('balcony')) {
        amenities.has_balcony = value.includes('ja') || value.includes('yes') || value === 'true';
      }
      if (name.includes('garten') || name.includes('garden')) {
        amenities.has_garden = value.includes('ja') || value.includes('yes') || value === 'true';
      }
      if (name.includes('terrasse') || name.includes('terrace')) {
        amenities.has_terrace = value.includes('ja') || value.includes('yes') || value === 'true';
      }
      if (name.includes('keller') || name.includes('cellar') || name.includes('basement')) {
        amenities.has_basement = value.includes('ja') || value.includes('yes') || value === 'true';
      }
      if (name.includes('aufzug') || name.includes('fahrstuhl') || name.includes('elevator') || name.includes('lift')) {
        amenities.has_elevator = value.includes('ja') || value.includes('yes') || value === 'true';
      }
      if (name.includes('parkplatz') || name.includes('parking')) {
        amenities.has_parking = value.includes('ja') || value.includes('yes') || value === 'true';
      }
      if (name.includes('garage')) {
        amenities.has_garage = value.includes('ja') || value.includes('yes') || value === 'true';
      }
    }
  }

  return amenities;
}

/**
 * Extract images with metadata
 */
function extractImages(listing: KleinanzeigenListing): any[] {
  const images: any[] = [];

  // Process images array
  if (listing.images) {
    listing.images.forEach((img, index) => {
      images.push({
        url: img.largeUrl || img.url || '',
        thumbnail_url: img.thumbnailUrl,
        order: index,
        image_id: img.id
      });
    });
  }

  // Process pictures array (alternative structure)
  if (listing.pictures && listing.pictures.length > 0 && images.length === 0) {
    listing.pictures.forEach((pic, index) => {
      images.push({
        url: pic.large || pic.url || '',
        thumbnail_url: pic.thumbnail,
        order: index,
        image_id: pic.id
      });
    });
  }

  return images;
}

/**
 * Extract image URLs for backward compatibility
 */
function extractImageUrls(listing: KleinanzeigenListing): string[] {
  const urls: string[] = [];

  if (listing.images) {
    listing.images.forEach(img => {
      const url = img.largeUrl || img.url;
      if (url) urls.push(url);
    });
  }

  if (listing.pictures && urls.length === 0) {
    listing.pictures.forEach(pic => {
      const url = pic.large || pic.url;
      if (url) urls.push(url);
    });
  }

  return urls;
}

/**
 * Extract description text
 */
function extractDescription(listing: KleinanzeigenListing): string | undefined {
  if (listing.description?.value) return listing.description.value;
  if (listing.description?.text) return listing.description.text;
  return undefined;
}

/**
 * Normalize condition to standard values
 */
function normalizeCondition(condition?: string): GermanSpecificFields['condition'] {
  if (!condition) return undefined;

  const lower = condition.toLowerCase();

  if (lower.includes('neu') || lower.includes('new') || lower.includes('erstbezug')) return 'new';
  if (lower.includes('renoviert') || lower.includes('renovated') || lower.includes('saniert')) return 'after_renovation';
  if (lower.includes('modernisiert') || lower.includes('modernized')) return 'after_renovation';
  if (lower.includes('gepflegt') || lower.includes('well-maintained')) return 'good';
  if (lower.includes('renovierungsbedürftig')) return 'requires_renovation';

  return undefined;
}

/**
 * Normalize furnished status
 */
function normalizeFurnished(furnished?: string): GermanSpecificFields['furnished'] {
  if (!furnished) return undefined;

  const lower = furnished.toLowerCase();

  if (lower.includes('möbliert') || lower === 'yes' || lower === 'ja') return 'furnished';
  if (lower.includes('teil') || lower.includes('partial')) return 'partially_furnished';
  if (lower === 'no' || lower === 'nein' || lower.includes('unmöbliert')) return 'not_furnished';

  return undefined;
}

/**
 * Normalize energy rating
 */
function normalizeEnergyRating(rating: string): GermanSpecificFields['energy_rating'] {
  const ratingUpper = rating.toUpperCase().trim();
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
 * Normalize heating type
 */
function normalizeHeatingType(heatingType?: string): GermanSpecificFields['heating_type'] {
  if (!heatingType) return undefined;

  const lower = heatingType.toLowerCase();

  if (lower.includes('zentral') || lower.includes('central')) return 'central_heating';
  if (lower.includes('gas')) return 'gas_heating';
  if (lower.includes('elektrisch') || lower.includes('electric')) return 'electric_heating';
  if (lower.includes('fernwärme') || lower.includes('district')) return 'district_heating';
  if (lower.includes('öl') || lower.includes('oil')) return 'oil_heating';
  if (lower.includes('wärmepumpe') || lower.includes('heat pump')) return 'heat_pump';
  if (lower.includes('fußboden') || lower.includes('floor')) return 'floor_heating';

  return 'other';
}
