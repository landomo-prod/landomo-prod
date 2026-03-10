import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeFurnished,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType
} from '../../shared/slovak-value-mappings';
import {
  extractConditionFromText,
  extractHeatingFromText,
  extractFurnishedFromText,
  extractConstructionTypeFromText,
  extractFloorFromText,
  extractTotalFloorsFromText,
  extractYearBuiltFromText,
  extractRenovationYearFromText,
  extractEnergyRatingFromText,
  extractDepositFromText,
  extractAmenitiesFromText,
  mapConditionToEnglish,
  mapFurnishedToEnglish,
  mapHeatingToEnglish,
  mapConstructionToEnglish,
  mapTransactionType,
  extractCity
} from '../shared/extractionHelpers';

/**
 * Transform Reality.sk Apartment (byty) to ApartmentPropertyTierI
 *
 * Reality.sk is HTML-only scraper - extracts data from title + description text
 */
export function transformRealityApartment(listing: RealityListing): ApartmentPropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  // Extract from text as fallback, but prefer structured detail data when available
  const parsedCondition = listing.condition || extractConditionFromText(allText);
  const parsedHeating = listing.heating || extractHeatingFromText(allText);
  const parsedFurnished = listing.furnished || extractFurnishedFromText(allText);
  const parsedConstructionType = listing.constructionType || extractConstructionTypeFromText(allText);
  const parsedFloor = listing.floor ?? extractFloorFromText(allText);
  const parsedTotalFloors = listing.totalFloors ?? extractTotalFloorsFromText(allText);
  const parsedYearBuilt = listing.yearBuilt ?? extractYearBuiltFromText(allText);
  // Prefer structured renovation_year from detail page over text extraction
  const parsedRenovationYear = listing.renovation_year ?? extractRenovationYearFromText(allText);
  const parsedEnergyRating = listing.energyRating ? normalizeEnergyRating(listing.energyRating) : normalizeEnergyRating(extractEnergyRatingFromText(allText));
  const parsedDeposit = extractDepositFromText(allText);
  const amenities = extractAmenitiesFromText(allText);
  // Merge detail page boolean amenities with text-extracted ones
  if (listing.hasElevator) amenities.has_elevator = true;
  if (listing.hasBalcony) amenities.has_balcony = true;
  if (listing.hasBasement) amenities.has_basement = true;
  if (listing.hasParking) amenities.has_parking = true;
  if (listing.hasGarage) amenities.has_garage = true;
  if (listing.hasLoggia) amenities.has_loggia = true;
  if (listing.hasTerrace) amenities.has_terrace = true;
  if (listing.hasGarden) amenities.has_garden = true;

  // Normalize Slovak values
  const normalizedCondition = normalizeCondition(parsedCondition);
  const normalizedHeating = normalizeHeatingType(parsedHeating);
  const normalizedFurnished = normalizeFurnished(parsedFurnished);
  const normalizedConstruction = normalizeConstructionType(parsedConstructionType);

  // Map to English
  const conditionEn = mapConditionToEnglish(normalizedCondition);
  const heatingEn = mapHeatingToEnglish(normalizedHeating);
  const furnishedEn = mapFurnishedToEnglish(normalizedFurnished);
  const constructionEn = mapConstructionToEnglish(normalizedConstruction);

  // ============ Core Identification ============
  const title = listing.title || 'Unknown Apartment';
  const price = listing.price || 0;
  const currency = listing.currency || 'EUR';
  const transaction_type = mapTransactionType(listing.transactionType);

  // ============ Location ============
  const location: PropertyLocation = {
    address: listing.location,
    city: extractCity(listing.location),
    country: 'sk',
    coordinates: listing.lat && listing.lon ? { lat: listing.lat, lon: listing.lon } : undefined
  };

  // ============ Apartment-Specific Details ============
  const sqm = listing.sqm || 0;
  // Prefer bedrooms_count (from JSON-LD) over rooms-based derivation
  const bedrooms = listing.bedrooms_count ?? listing.rooms ?? 1; // Required field, default to 1
  const rooms = listing.rooms;
  const floor = parsedFloor;
  const total_floors = parsedTotalFloors;

  // ============ Amenities (required boolean fields) ============
  const has_elevator = amenities.has_elevator || false;
  const has_balcony = amenities.has_balcony || false;
  const has_parking = amenities.has_parking || false;
  const has_basement = amenities.has_basement || false;
  const has_loggia = amenities.has_loggia || false;
  const has_terrace = amenities.has_terrace || false;
  const has_garage = amenities.has_garage || false;
  const has_ac = amenities.has_ac || false;

  // ============ Building Context ============
  const year_built = parsedYearBuilt;
  const renovation_year = parsedRenovationYear;

  const constructionTypeRaw = constructionEn as any;
  const construction_type: 'panel' | 'brick' | 'concrete' | 'mixed' | undefined =
    constructionTypeRaw === 'stone' || constructionTypeRaw === 'wood' || constructionTypeRaw === 'other'
      ? undefined
      : constructionTypeRaw;

  const conditionRaw = conditionEn as any;
  const condition: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined =
    conditionRaw === 'very_good' ? 'excellent' :
    conditionRaw === 'before_renovation' || conditionRaw === 'under_construction' ? 'good' :
    conditionRaw;

  const heating_type = heatingEn as 'central_heating' | 'gas_heating' | 'electric_heating' | 'individual_heating' | undefined;
  const energy_class = parsedEnergyRating;

  // ============ Financials ============
  const price_per_sqm = price && sqm ? Math.round(price / sqm) : undefined;
  const hoa_fees = undefined; // Not available from list page
  const deposit = parsedDeposit;

  // ============ Disposition (Tier II) ============
  const disposition = listing.rooms ? `${listing.rooms}-room` : undefined;

  // ============ Return ApartmentPropertyTierI ============
  return {
    // Category (CRITICAL for partition routing)
    property_category: 'apartment' as const,

    // Core fields
    title,
    price,
    currency,
    transaction_type,
    source_url: listing.url,
    source_platform: 'reality-sk',
    portal_id: String(listing.id || ''),

    // Location
    location,

    // Apartment specifics
    sqm,
    bedrooms,
    rooms,
    floor,
    total_floors,
    floor_location: undefined, // Not determinable from text

    // Amenities
    has_elevator,
    has_balcony,
    has_parking,
    has_basement,
    has_loggia,
    has_terrace,
    has_garage,

    // Building context
    year_built,
    construction_type,
    condition,
    heating_type,
    energy_class,
    renovation_year,
    furnished: normalizeFurnished(parsedFurnished) as 'furnished' | 'partially_furnished' | 'not_furnished' | undefined,
    published_date: listing.published_date,

    // Financials
    hoa_fees,
    deposit,

    // Additional fields
    bathrooms: listing.bathrooms ?? (listing.rooms ? Math.max(1, Math.floor(listing.rooms / 2)) : undefined),
    parking_spaces: listing.outdoor_parking_spaces,
    terrace_area: listing.terrace_area,
    balcony_area: listing.balcony_area,

    // Media & description
    description: listing.description,

    // Status
    status: 'active' as const,

    // ============ Tier III: Portal Metadata ============
    portal_metadata: {
      reality_sk: {
        original_id: listing.id,
        source_url: listing.url,
        property_category: listing.propertyType,
        transaction_category: listing.transactionType,
        agent_name: listing.agent_name,
        agency_profile_url: listing.agency_profile_url,
        agency_address: listing.agency_address,
        phone_partial: listing.phone_partial,
        updated_date: listing.updated_date,
        orientation: listing.orientation,
        property_subtype: listing.property_subtype,
      }
    },

    // ============ Tier II: Country-Specific (Slovakia) ============
    country_specific: {
      slovakia: {
        disposition,
        ownership: listing.ownership || 'other',
        condition: conditionEn,
        furnished: furnishedEn,
        energy_rating: parsedEnergyRating,
        heating_type: heatingEn,
        construction_type: constructionEn,
        area_living: listing.sqm,
        floor: parsedFloor,
        total_floors: parsedTotalFloors,
        year_built: parsedYearBuilt,
        renovation_year: parsedRenovationYear,
        rooms: listing.rooms,
        balcony: amenities.has_balcony || undefined,
        terrace: amenities.has_terrace || undefined,
        elevator: amenities.has_elevator || undefined,
        garage: amenities.has_garage || undefined,
        loggia: amenities.has_loggia || undefined,
        deposit: parsedDeposit,
        orientation: listing.orientation,
        heat_source: listing.heat_source,
        balcony_count: listing.balcony_count,
      }
    }
  };
}
