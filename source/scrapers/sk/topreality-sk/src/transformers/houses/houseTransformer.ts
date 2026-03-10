import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
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
 * Transform TopReality.sk house listing to HousePropertyTierI
 *
 * House-specific:
 * - Plot area (pozemok) is important
 * - Garden, garage, basement more common than apartments
 * - Construction type varies (brick, wood, panel less common)
 * - May have multiple floors (total_floors)
 */
export function transformHouseToStandard(listing: TopRealityListing): HousePropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  // Extract enriched data - detail-enriched fields take precedence over text extraction
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
  const parsedAreaPlot = listing.sqm_plot ?? extractAreaPlotFromText(allText);
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

  // Generate disposition from rooms
  const disposition = listing.rooms ? `${listing.rooms}-izbový` : undefined;

  // Map construction type to allowed values for HousePropertyTierI
  const constructionTypeRaw = constructionEn as any;
  const construction_type: 'brick' | 'wood' | 'stone' | 'concrete' | 'mixed' | undefined =
    constructionTypeRaw === 'panel' || constructionTypeRaw === 'other'
      ? undefined
      : constructionTypeRaw;

  // Map condition to allowed values
  const conditionRaw = conditionEn as any;
  const condition: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined =
    conditionRaw === 'very_good' ? 'excellent' :
    conditionRaw === 'before_renovation' ? 'requires_renovation' :
    conditionRaw === 'under_construction' ? 'new' :
    conditionRaw;

  const heating_type = heatingEn || undefined;
  const furnished = (furnishedEn as 'furnished' | 'partially_furnished' | 'not_furnished' | undefined) || undefined;

  return {
    // Category (house partition)
    property_category: 'house' as const,

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

    // House-specific flat fields (read directly by upsertHouses)
    bedrooms: listing.rooms || 1,
    bathrooms: listing.bathrooms ?? (listing.rooms ? Math.max(1, Math.floor(listing.rooms / 2)) : undefined),
    sqm_living: listing.area || 0,
    sqm_plot: parsedAreaPlot || 0,
    stories: parsedTotalFloors,
    rooms: listing.rooms,

    // Amenities (required boolean fields) - detail-enriched fields take precedence
    has_garden: listing.hasGarden ?? amenities.has_garden ?? (parsedAreaPlot ? true : false),
    has_garage: listing.hasGarage ?? amenities.has_garage ?? false,
    has_parking: listing.hasParking ?? amenities.has_parking ?? false,
    has_basement: listing.hasBasement ?? amenities.has_basement ?? false,
    has_pool: amenities.has_pool || false,
    has_fireplace: amenities.has_fireplace || false,
    has_terrace: listing.hasTerrace ?? amenities.has_terrace ?? false,
    has_balcony: listing.hasBalcony ?? amenities.has_balcony ?? false,

    // Building context
    year_built: parsedYearBuilt,
    renovation_year: parsedRenovationYear,
    construction_type,
    condition,
    heating_type,
    energy_class: parsedEnergyRating,

    // Financials
    deposit: parsedDeposit,
    parking_spaces: amenities.has_parking || amenities.has_garage ? 1 : undefined,

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
        area_plot: parsedAreaPlot,
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
