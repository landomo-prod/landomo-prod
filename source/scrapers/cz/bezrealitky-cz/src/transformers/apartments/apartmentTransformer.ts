import { ApartmentPropertyTierI, PropertyLocation, PropertyImage } from '@landomo/core';
import { BezRealitkyListingItem } from '../../types/bezrealitkyTypes';
import {
  bedroomsFromDisposition,
  normalizeBezrealitkyDisposition,
  parseFloor,
  normalizeOwnership,
  extractFloorLocation,
} from '../../utils/bezrealitkyHelpers';
import {
  normalizeDisposition,
  normalizeCondition,
  normalizeFurnished,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType,
} from '../../../../shared/czech-value-mappings';
import { parseRenovationYear } from '../../utils/bezrealitkyHelpers';

/**
 * Transform Bezrealitky Apartment (BYT) to ApartmentPropertyTierI
 *
 * Advantages over SReality:
 * - GraphQL API provides structured data (no HTML parsing)
 * - Direct bedrooms field (sometimes available)
 * - Multiple area fields (balcony, loggia, terrace, cellar)
 * - Boolean amenity flags (no string parsing)
 * - 95%+ field completion rate
 */
export function transformBezrealitkyApartment(
  listing: BezRealitkyListingItem
): ApartmentPropertyTierI {
  // ============ Core Identification ============
  const title = listing.title || 'Unknown';
  const price = listing.price ?? 0;
  const currency = listing.currency || 'CZK';
  const transaction_type = listing.offerType === 'PRODEJ' ? 'sale' : 'rent';

  // ============ Location ============
  const location: PropertyLocation = {
    address: listing.address || `${listing.street || ''} ${listing.houseNumber || ''}`.trim(),
    city: listing.city || 'Unknown',
    region: listing.region?.name,
    country: 'Czech Republic',
    postal_code: listing.zip,
    coordinates: listing.gps ? {
      lat: listing.gps.lat,
      lon: listing.gps.lng,
    } : undefined,
  };

  // ============ Bedrooms (Prefer direct field, fallback to disposition) ============
  const bedrooms = bedroomsFromDisposition(listing.disposition || '');

  // ============ Apartment-Specific Details ============
  const sqm = listing.surface ?? 0;
  const floor = listing.floor ? parseFloor(listing.floor) : undefined;
  const total_floors = listing.totalFloors;

  // Calculate total rooms (Czech: 2+kk = 2 rooms)
  const rooms = extractRooms(normalizeBezrealitkyDisposition(listing.disposition || ''));

  // ============ Amenities (GraphQL boolean fields - reliable!) ============
  const has_elevator = listing.lift ?? false;
  const has_balcony = listing.balcony ?? false;
  const has_parking = listing.parking ?? false;
  const has_basement = listing.cellar ?? false;
  const has_loggia = listing.loggia ?? false;
  const has_terrace = listing.terrace ?? false;
  const has_garage = listing.garage ?? false;

  // ============ Area Measurements (Polymorphic with boolean flags) ============
  const balcony_area = listing.balconySurface;
  const loggia_area = listing.loggiaSurface;
  const cellar_area = listing.cellarSurface;
  const terrace_area = listing.terraceSurface;

  // ============ Building Context ============
  const year_built = listing.age ? new Date().getFullYear() - listing.age : undefined;
  const constructionTypeRaw = normalizeConstructionType(listing.construction);
  const construction_type: 'panel' | 'brick' | 'concrete' | 'mixed' | undefined =
    constructionTypeRaw === 'other' || constructionTypeRaw === 'stone' || constructionTypeRaw === 'wood'
      ? undefined
      : constructionTypeRaw;

  const conditionRaw = normalizeCondition(listing.condition);
  const condition: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined =
    conditionRaw === 'very_good' || conditionRaw === 'before_renovation' || conditionRaw === 'project' || conditionRaw === 'under_construction'
      ? 'good'
      : conditionRaw;

  const heating_type = normalizeHeatingType(listing.heating);
  const energy_class = normalizeEnergyRating(listing.penb);

  // Floor location (filter out semi_basement if not supported)
  const floorLocationRaw = extractFloorLocation(listing.floor, listing.totalFloors);
  const floor_location: 'ground_floor' | 'middle_floor' | 'top_floor' | undefined =
    floorLocationRaw === 'semi_basement' ? 'ground_floor' : floorLocationRaw;

  // ============ Tier 1 Universal Fields ============
  const furnished = normalizeFurnished(listing.equipped);
  const renovation_year = parseRenovationYear(listing.reconstruction);
  const published_date = listing.timeActivated
    ? new Date(parseInt(listing.timeActivated) * 1000).toISOString()
    : undefined;

  // ============ Financials ============
  const hoa_fees = listing.serviceCharges;
  const deposit = listing.deposit;
  const utility_charges = listing.utilityCharges;
  const service_charges = listing.serviceCharges ?? listing.charges;

  // ============ Rental-Specific Fields ============
  // Convert Unix epoch timestamp to ISO 8601 string
  const available_from = listing.availableFrom
    ? new Date(parseInt(listing.availableFrom) * 1000).toISOString()
    : undefined;
  const min_rent_days = listing.minRentDays;
  const max_rent_days = listing.maxRentDays;

  // ============ Media ============
  const richImages: PropertyImage[] = (listing.publicImages || []).map((img) => ({
    url: img.url,
    order: img.order,
    is_main: img.main || undefined,
    filename: img.filename,
    image_id: img.id,
  }));
  const media = {
    images: richImages.length > 0 ? richImages : [] as PropertyImage[],
    tour_360_url: listing.tour360,
  };

  // ============ Portal & Lifecycle ============
  const uri = listing.uri?.startsWith('/') ? listing.uri : `/${listing.uri}`;
  const source_url = `https://www.bezrealitky.cz/nemovitosti-byty-domy${uri}`;
  const source_platform = 'bezrealitky';
  const portal_id = `bezrealitky-${listing.id}`;
  const status = listing.active ? 'active' : 'removed';

  // ============ Features ============
  const features = extractFeatures(listing);

  // ============ Description ============
  const description = listing.description;

  // ============ Assemble ApartmentPropertyTierI ============
  return {
    // Category
    property_category: 'apartment' as const,

    // Core
    title,
    price,
    currency,
    transaction_type,

    // Location
    location,

    // Classification
    property_subtype: detectPropertySubtype(listing),

    // Tier II Czech-Specific Fields
    country_specific: {
      czech_disposition: normalizeDisposition(normalizeBezrealitkyDisposition(listing.disposition || '')),
      czech_ownership: listing.ownership ? normalizeOwnership(listing.ownership) : undefined,
      city_district: listing.cityDistrict,
      is_prague: listing.isPrague,
      is_brno: listing.isBrno,
      is_prague_west: listing.isPragueWest,
      is_prague_east: listing.isPragueEast,
      ruian_id: listing.ruianId,
      water_supply: listing.water,
      sewage_type: listing.sewage,
      service_charges_note: listing.serviceChargesNote,
      utility_charges_note: listing.utilityChargesNote,
    },

    // Apartment Details
    bedrooms,
    bathrooms: 1,
    sqm,
    floor,
    total_floors,
    rooms,

    // Amenities
    has_elevator,
    has_balcony,
    balcony_area,
    has_parking,
    parking_spaces: has_parking ? 1 : undefined,
    has_basement,
    cellar_area,
    has_loggia,
    loggia_area,
    has_terrace,
    terrace_area,
    has_garage,
    garage_count: has_garage ? 1 : undefined,

    // Building Context
    year_built,
    construction_type,
    condition,
    heating_type,
    energy_class,
    floor_location,

    // Tier 1 Universal Fields
    furnished,
    renovation_year,
    published_date,

    // Financials
    hoa_fees,
    deposit,
    utility_charges,
    service_charges,
    is_commission: listing.fee !== undefined && listing.fee > 0,
    commission_note: listing.fee !== undefined && listing.fee > 0 ? `Agency fee: ${listing.fee} CZK` : undefined,

    // Rental-Specific
    available_from,
    min_rent_days,
    max_rent_days,

    // Media & Agent
    media,
    images: richImages.map(img => img.url),

    // Features
    features,
    description,

    // Portal metadata
    portal_metadata: {
      bezrealitky: {
        reserved: listing.reserved,
        original_price: listing.originalPrice,
        is_discounted: listing.isDiscounted,
        visit_count: listing.visitCount,
        conversation_count: listing.conversationCount,
      },
    },

    // Portal & Lifecycle
    source_url,
    source_platform,
    portal_id,
    status: status as 'active' | 'removed' | 'sold' | 'rented',
  };
}

/**
 * Extract total room count from Czech disposition
 * Czech: 2+kk = 2 rooms total, 3+1 = 4 rooms total
 */
function extractRooms(disposition?: string): number | undefined {
  if (!disposition) return undefined;

  const match = disposition.match(/^(\d)\+(\d|kk)/i);
  if (!match) return undefined;

  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1;
  return baseRooms + additional;
}

/**
 * Detect property subtype (studio, penthouse, etc.)
 */
function detectPropertySubtype(
  listing: BezRealitkyListingItem
): 'standard' | 'penthouse' | 'loft' | 'atelier' | 'maisonette' | 'studio' | undefined {
  const title = listing.title?.toLowerCase() || '';
  const description = listing.description?.toLowerCase() || '';
  const disposition = listing.disposition?.toLowerCase() || '';

  // Studio (1+kk)
  if (disposition === '1+kk' || disposition === '1+0') {
    return 'studio';
  }

  // Penthouse (top floor + premium keywords)
  if (
    title.includes('penthouse') ||
    description.includes('penthouse') ||
    (listing.floor?.toLowerCase().includes('podkroví') && listing.price && listing.price > 10000000)
  ) {
    return 'penthouse';
  }

  // Loft
  if (title.includes('loft') || description.includes('loft')) {
    return 'loft';
  }

  // Atelier
  if (title.includes('atelier') || description.includes('ateliér')) {
    return 'atelier';
  }

  // Maisonette (multi-floor apartment)
  if (title.includes('maisonette') || description.includes('maisonette')) {
    return 'maisonette';
  }

  return 'standard';
}

/**
 * Extract features from listing
 */
function extractFeatures(listing: BezRealitkyListingItem): string[] {
  const features: string[] = [];

  // Amenities
  if (listing.balcony) features.push('balcony');
  if (listing.terrace) features.push('terrace');
  if (listing.loggia) features.push('loggia');
  if (listing.cellar) features.push('cellar');
  if (listing.parking) features.push('parking');
  if (listing.garage) features.push('garage');
  if (listing.lift) features.push('elevator');

  // Building features
  if (listing.newBuilding) features.push('new_building');
  if (listing.lowEnergy) features.push('low_energy');

  // Living conditions
  if (listing.petFriendly) features.push('pet_friendly');
  if (listing.barrierFree) features.push('barrier_free');
  if (listing.equipped === 'EQUIPPED') features.push('furnished');

  // Media
  if (listing.tour360) features.push('virtual_tour');

  // Short-term rental
  if (listing.shortTerm) features.push('short_term_rental');

  return features;
}
