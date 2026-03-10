import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { TopRealityListing } from '../../types/toprealityTypes';
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
  extractCity,
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
  extractAreaPlotFromText,
  extractAmenitiesFromText,
  mapConditionToEnglish,
  mapFurnishedToEnglish,
  mapHeatingToEnglish,
  mapConstructionToEnglish,
  mapTransactionType
} from '../shared/helpers';

/**
 * Transform TopReality.sk apartment listing to ApartmentPropertyTierI
 *
 * Apartment-specific:
 * - Floor and total_floors are critical
 * - Disposition (1+kk, 2+1, etc.) from rooms
 * - Elevator, balcony, loggia common amenities
 * - Construction type (panel, brick) important
 */
export function transformApartmentToStandard(listing: TopRealityListing): ApartmentPropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  // Extract enriched data from title + description text
  // Detail-enriched fields take precedence over text extraction
  const parsedCondition = listing.condition || extractConditionFromText(allText);
  const parsedHeating = listing.heating || extractHeatingFromText(allText);
  const parsedFurnished = listing.furnished || extractFurnishedFromText(allText);
  const parsedConstructionType = listing.constructionType || extractConstructionTypeFromText(allText);
  const parsedFloor = listing.floor ?? extractFloorFromText(allText);
  const parsedTotalFloors = listing.totalFloors ?? extractTotalFloorsFromText(allText);
  const parsedYearBuilt = listing.yearBuilt ?? extractYearBuiltFromText(allText);
  const parsedRenovationYear = listing.renovation_year ?? extractRenovationYearFromText(allText);
  const parsedEnergyRating = normalizeEnergyRating(listing.energyRating || extractEnergyRatingFromText(allText));
  const parsedDeposit = extractDepositFromText(allText);
  const parsedAreaLiving = listing.area;
  const amenities = extractAmenitiesFromText(allText);

  // Normalize Slovak values to canonical forms
  const normalizedCondition = normalizeCondition(parsedCondition);
  const normalizedHeating = normalizeHeatingType(parsedHeating);
  const normalizedFurnished = normalizeFurnished(parsedFurnished);
  const normalizedConstruction = normalizeConstructionType(parsedConstructionType);

  // Map to English for Tier 1 / country_specific
  const conditionEn = mapConditionToEnglish(normalizedCondition);
  const heatingEn = mapHeatingToEnglish(normalizedHeating);
  const furnishedEn = mapFurnishedToEnglish(normalizedFurnished);
  const constructionEn = mapConstructionToEnglish(normalizedConstruction);

  // Generate disposition from rooms (e.g., 2 rooms -> "2-izbovy")
  const disposition = listing.rooms ? `${listing.rooms}-izbový` : undefined;

  // Map construction type to allowed values for ApartmentPropertyTierI
  const constructionTypeRaw = constructionEn as any;
  const construction_type: 'panel' | 'brick' | 'concrete' | 'mixed' | undefined =
    constructionTypeRaw === 'stone' || constructionTypeRaw === 'wood' || constructionTypeRaw === 'other'
      ? undefined
      : constructionTypeRaw;

  // Map condition to allowed values
  const conditionRaw = conditionEn as any;
  const condition: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined =
    conditionRaw === 'very_good' ? 'excellent' :
    conditionRaw === 'before_renovation' || conditionRaw === 'under_construction' ? 'good' :
    conditionRaw;

  const heating_type = heatingEn || undefined;
  const furnished = (furnishedEn as 'furnished' | 'partially_furnished' | 'not_furnished' | undefined) || undefined;

  return {
    // Category (apartment partition)
    property_category: 'apartment' as const,

    // Core fields
    portal_id: String(listing.id || ''),
    title: listing.title,
    price: listing.price,
    currency: listing.currency || 'EUR',
    transaction_type: mapTransactionType(listing.transactionType),
    source_url: listing.url,
    source_platform: 'topreality-sk',
    status: 'active' as const,

    // Location
    location: {
      address: listing.location,
      city: extractCity(listing.location),
      country: 'sk',
      coordinates: listing.lat && listing.lon ? { lat: listing.lat, lon: listing.lon } : undefined
    } as PropertyLocation,

    // Apartment-specific flat fields (read directly by upsertApartments)
    bedrooms: listing.bedrooms_count ?? listing.rooms ?? 1,
    bathrooms: listing.bathrooms ?? (listing.rooms ? Math.max(1, Math.floor(listing.rooms / 2)) : undefined),
    sqm: listing.area || 0,
    floor: parsedFloor,
    total_floors: parsedTotalFloors,
    rooms: listing.rooms,

    // Amenities (required boolean fields) - detail-enriched fields take precedence
    has_elevator: listing.hasElevator ?? amenities.has_elevator ?? false,
    has_balcony: listing.hasBalcony ?? amenities.has_balcony ?? false,
    has_parking: listing.hasParking ?? amenities.has_parking ?? false,
    has_basement: listing.hasBasement ?? amenities.has_basement ?? false,
    has_loggia: listing.hasLoggia ?? amenities.has_loggia ?? false,
    has_terrace: listing.hasTerrace ?? amenities.has_terrace ?? false,
    has_garage: listing.hasGarage ?? amenities.has_garage ?? false,

    // Building context
    year_built: parsedYearBuilt,
    renovation_year: parsedRenovationYear,
    construction_type,
    condition,
    heating_type,
    energy_class: parsedEnergyRating,

    // Financials
    deposit: parsedDeposit,
    parking_spaces: amenities.has_parking ? 1 : undefined,

    // Tier 1 universal fields
    furnished,
    available_from: undefined,
    published_date: listing.updated_at || undefined,

    // Media
    images: listing.images || [],
    description: listing.description,

    // Portal metadata
    portal_metadata: {
      topreality_sk: {
        original_id: listing.id,
        source_url: listing.url,
        property_category: listing.propertyType,
        transaction_category: listing.transactionType,
        agent_name: listing.agent_name,
        agency_name: listing.agency_name,
        agent_profile_url: listing.agent_profile_url,
        agency_profile_url: listing.agency_profile_url,
        agency_address: listing.agency_address,
        phone_partial: listing.phone_partial,
        phone: listing.phone,
      }
    },

    // Country-specific fields (Slovakia)
    country_specific: {
      slovakia: {
        disposition: disposition ? normalizeDisposition(disposition) : undefined,
        ownership: 'other',
        condition: conditionEn,
        furnished: furnishedEn,
        energy_rating: parsedEnergyRating,
        heating_type: heatingEn,
        construction_type: constructionEn,
        area_living: parsedAreaLiving,
        area_plot: undefined,
        year_built: parsedYearBuilt,
        renovation_year: parsedRenovationYear,
        floor: parsedFloor,
        total_floors: parsedTotalFloors,
        rooms: listing.rooms,
        balcony: amenities.has_balcony || undefined,
        terrace: amenities.has_terrace || undefined,
        elevator: amenities.has_elevator || undefined,
        garage: amenities.has_garage || undefined,
        garden: amenities.has_garden || undefined,
        loggia: amenities.has_loggia || undefined,
        pool: amenities.has_pool || undefined,
        deposit: parsedDeposit,
      }
    },
  };
}
