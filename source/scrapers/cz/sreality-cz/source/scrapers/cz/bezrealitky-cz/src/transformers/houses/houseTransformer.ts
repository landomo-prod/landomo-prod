/**
 * Bezrealitky House Transformer
 *
 * Transforms Bezrealitky house listings (estateType === 'DUM') to HousePropertyTierI
 *
 * Bezrealitky Advantages for Houses:
 * - GraphQL API provides structured boolean amenity fields
 * - Direct surface area fields (surface, surfaceLand, cellarSurface, terraceSurface)
 * - Water and sewage type fields (not available in most portals)
 * - 95%+ field completion rate
 */

import { HousePropertyTierI, PropertyLocation, PropertyImage } from '@landomo/core';
import { BezRealitkyListingItem } from '../../types/bezrealitkyTypes';
import { bedroomsFromDisposition, normalizeBezrealitkyDisposition, normalizeOwnership, parseRenovationYear } from '../../utils/bezrealitkyHelpers';
import {
  normalizeCondition,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType,
  normalizeDisposition,
  normalizeFurnished,
} from '../../../../shared/czech-value-mappings';

/**
 * Transform Bezrealitky House (DUM) to HousePropertyTierI
 *
 * Houses require:
 * - sqm_living (living area)
 * - sqm_plot (plot area - CRITICAL!)
 * - Boolean amenities (garden, garage, parking, basement)
 */
export function transformBezrealitkyHouse(
  listing: BezRealitkyListingItem
): HousePropertyTierI {
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
    coordinates: listing.gps
      ? {
          lat: listing.gps.lat,
          lon: listing.gps.lng,
        }
      : undefined,
  };

  // ============ Bedrooms (Calculate from disposition) ============
  const bedrooms = bedroomsFromDisposition(listing.disposition || '');

  // ============ House-Specific Areas (CRITICAL!) ============
  const sqm_living = listing.surface ?? 0; // Living area
  const sqm_plot = listing.surfaceLand ?? 0; // Plot area (MAIN METRIC for houses!)
  const sqm_total = undefined; // Bezrealitky doesn't provide total built area

  // Calculate total rooms (Czech: 4+1 = 5 rooms total)
  const rooms = extractRooms(normalizeBezrealitkyDisposition(listing.disposition || ''));

  // ============ House Amenities (GraphQL boolean fields - reliable!) ============
  const has_garden = (listing.frontGarden != null && listing.frontGarden > 0) || (sqm_plot != null && sqm_living != null && sqm_plot > sqm_living);
  const garden_area = listing.frontGarden || undefined;

  const has_garage = listing.garage ?? false;
  const garage_count = has_garage ? 1 : undefined;

  const has_parking = listing.parking ?? false;
  const parking_spaces = has_parking ? 1 : undefined;

  const has_basement = listing.cellar ?? (listing.cellarSurface !== undefined && listing.cellarSurface > 0);
  const cellar_area = listing.cellarSurface;

  const has_terrace = listing.terrace ?? (listing.terraceSurface !== undefined && listing.terraceSurface > 0);
  const terrace_area = listing.terraceSurface;

  // Pool and fireplace — Bezrealitky doesn't provide these fields
  const has_pool = undefined;
  const has_fireplace = undefined;

  const has_balcony = listing.balcony ?? false;
  const balcony_area = listing.balconySurface;

  // ============ Building Info ============
  const stories = listing.totalFloors;
  const year_built = listing.age ? new Date().getFullYear() - listing.age : undefined;
  const renovation_year = parseRenovationYear(listing.reconstruction);

  // ============ Construction & Condition ============
  const constructionTypeRaw = normalizeConstructionType(listing.construction);
  const construction_type: 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined =
    constructionTypeRaw === 'panel' || constructionTypeRaw === 'other'
      ? undefined
      : constructionTypeRaw;

  const conditionRaw = normalizeCondition(listing.condition);
  const condition: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined =
    conditionRaw === 'very_good' || conditionRaw === 'before_renovation' || conditionRaw === 'project' || conditionRaw === 'under_construction'
      ? 'good'
      : conditionRaw;

  // ============ Energy & Utilities ============
  const heating_type = normalizeHeatingType(listing.heating);
  const energy_class = normalizeEnergyRating(listing.penb);

  // Bezrealitky has water and sewage type fields (rare advantage!)
  // But these need custom mapping as they're Czech-specific strings

  // ============ Tier 1 Universal Fields ============
  const furnished = normalizeFurnished(listing.equipped);
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
  const source_url = `https://www.bezrealitky.cz${listing.uri}`;
  const source_platform = 'bezrealitky';
  const portal_id = `bezrealitky-${listing.id}`;
  const status = listing.active ? 'active' : 'removed';

  // ============ Features ============
  const features = extractHouseFeatures(listing);

  // ============ Description ============
  const description = listing.description;

  // ============ House Subtype Detection ============
  const property_subtype = detectHouseSubtype(listing);

  // ============ Assemble HousePropertyTierI ============
  return {
    // Category
    property_category: 'house' as const,

    // Core
    title,
    price,
    currency,
    transaction_type,

    // Location
    location,

    // Classification
    property_subtype,

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

    // House Details
    bedrooms,
    bathrooms: 1,
    sqm_living,
    sqm_total,
    sqm_plot, // CRITICAL for houses!
    stories,
    rooms,

    // Amenities
    has_garden,
    garden_area,
    has_garage,
    garage_count,
    has_parking,
    parking_spaces,
    has_basement,
    cellar_area,
    has_pool,
    has_fireplace,
    has_terrace,
    terrace_area,
    has_balcony,
    balcony_area,

    // Building Context
    year_built,
    renovation_year,
    construction_type,
    condition,
    heating_type,
    energy_class,

    // Tier 1 Universal Fields
    furnished,
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
 * Czech: 4+1 = 5 rooms total (4 rooms + 1 kitchen)
 */
function extractRooms(disposition?: string): number | undefined {
  if (!disposition) return undefined;

  const match = disposition.match(/^(\d+)\+(\d+|kk)/i);
  if (!match) return undefined;

  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1;
  return baseRooms + additional;
}

/**
 * Detect house subtype from houseType field and title
 */
function detectHouseSubtype(
  listing: BezRealitkyListingItem
): 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow' | undefined {
  const houseType = listing.houseType?.toLowerCase() || '';
  const title = listing.title?.toLowerCase() || '';
  const description = listing.description?.toLowerCase() || '';
  const estateType = listing.estateType;

  // Recreational objects (REKREACNI_OBJEKT) → cottage
  // These are cabins, cottages, summer houses
  if (estateType === 'REKREACNI_OBJEKT') {
    return 'cottage';
  }

  // Villa (luxury detached)
  if (houseType.includes('vila') || title.includes('vila') || title.includes('villa')) {
    return 'villa';
  }

  // Cottage (Czech: chalupa)
  if (
    houseType.includes('chalupa') ||
    title.includes('chalupa') ||
    description.includes('chalupa')
  ) {
    return 'cottage';
  }

  // Farmhouse (Czech: statek, grunt)
  if (
    houseType.includes('statek') ||
    houseType.includes('grunt') ||
    title.includes('statek') ||
    title.includes('grunt')
  ) {
    return 'farmhouse';
  }

  // Terraced house (Czech: řadový dům)
  if (
    houseType.includes('radovy') ||
    houseType.includes('řadový') ||
    title.includes('řadový') ||
    title.includes('radovy')
  ) {
    return 'terraced';
  }

  // Semi-detached (Czech: dvojdomek)
  if (
    houseType.includes('dvojdomek') ||
    houseType.includes('dvojdom') ||
    title.includes('dvojdomek')
  ) {
    return 'semi_detached';
  }

  // Bungalow (single-story)
  if (
    houseType.includes('bungalov') ||
    title.includes('bungalov') ||
    (listing.totalFloors === 1 && listing.surface && listing.surface > 100)
  ) {
    return 'bungalow';
  }

  // Default: detached house
  return 'detached';
}

/**
 * Extract features from listing
 */
function extractHouseFeatures(listing: BezRealitkyListingItem): string[] {
  const features: string[] = [];

  // Amenities
  if (listing.terrace) features.push('terrace');
  if (listing.balcony) features.push('balcony');
  if (listing.cellar) features.push('cellar');
  if (listing.parking) features.push('parking');
  if (listing.garage) features.push('garage');
  if (listing.frontGarden != null && listing.frontGarden > 0) features.push('garden');

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

  // Infrastructure (basic)
  if (listing.water) features.push('water_connection');
  if (listing.sewage) features.push('sewage_connection');

  return features;
}
