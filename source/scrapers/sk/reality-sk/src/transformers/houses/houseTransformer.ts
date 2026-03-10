import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
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
  mapTransactionType,
  extractCity
} from '../shared/extractionHelpers';

/**
 * Transform Reality.sk House (domy) to HousePropertyTierI
 *
 * Reality.sk is HTML-only scraper - extracts data from title + description text
 * CRITICAL: Houses have both sqm_living (interior) AND sqm_plot (land area)
 */
export function transformRealityHouse(listing: RealityListing): HousePropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  // Extract from text as fallback, but prefer structured detail data when available
  const parsedCondition = listing.condition || extractConditionFromText(allText);
  const parsedHeating = listing.heating || extractHeatingFromText(allText);
  const parsedFurnished = listing.furnished || extractFurnishedFromText(allText);
  const parsedConstructionType = listing.constructionType || extractConstructionTypeFromText(allText);
  const parsedYearBuilt = listing.yearBuilt ?? extractYearBuiltFromText(allText);
  // Prefer structured renovation_year from detail page over text extraction
  const parsedRenovationYear = listing.renovation_year ?? extractRenovationYearFromText(allText);
  const parsedEnergyRating = listing.energyRating ? normalizeEnergyRating(listing.energyRating) : normalizeEnergyRating(extractEnergyRatingFromText(allText));
  const parsedDeposit = extractDepositFromText(allText);
  const parsedAreaPlot = extractAreaPlotFromText(allText);
  const amenities = extractAmenitiesFromText(allText);
  if (listing.hasGarden) amenities.has_garden = true;
  if (listing.hasGarage) amenities.has_garage = true;
  if (listing.hasParking) amenities.has_parking = true;
  if (listing.hasBasement) amenities.has_basement = true;
  if (listing.hasTerrace) amenities.has_terrace = true;
  if (listing.hasBalcony) amenities.has_balcony = true;

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
  const title = listing.title || 'Unknown House';
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

  // ============ House-Specific Details ============
  // CRITICAL: sqm_living is interior space, sqm_plot is land area
  const sqm_living = listing.sqm || 0;
  // Prefer structured sqm_plot from detail page; fallback to text extraction
  const sqm_plot = listing.sqm_plot ?? parsedAreaPlot ?? 0; // Required field
  const bedrooms = listing.rooms || 1; // Required field, default to 1
  const rooms = listing.rooms;
  const stories = undefined; // Not available from list page text

  // Detect house subtype from text
  const house_type = detectHouseSubtype(allText);

  // ============ Amenities (required boolean fields) ============
  const has_garden = amenities.has_garden || (parsedAreaPlot ? true : false);
  const has_garage = amenities.has_garage || false;
  const has_parking = amenities.has_parking || false;
  const has_pool = amenities.has_pool || false;
  const has_fireplace = amenities.has_fireplace || false;
  const has_basement = amenities.has_basement || false;
  const has_terrace = amenities.has_terrace || false;
  const has_balcony = amenities.has_balcony || false;
  const has_ac = amenities.has_ac || false;

  // ============ Building Context ============
  const year_built = parsedYearBuilt;
  const renovation_year = parsedRenovationYear;

  const constructionTypeRaw = constructionEn as any;
  const construction_type: 'brick' | 'stone' | 'wood' | 'concrete' | 'mixed' | undefined =
    constructionTypeRaw === 'panel' || constructionTypeRaw === 'other'
      ? undefined
      : constructionTypeRaw;

  const conditionRaw = conditionEn as any;
  const condition: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined =
    conditionRaw === 'very_good' ? 'excellent' :
    conditionRaw === 'before_renovation' ? 'requires_renovation' :
    conditionRaw === 'under_construction' ? 'new' :
    conditionRaw;

  const heating_type = heatingEn as 'central_heating' | 'gas_heating' | 'electric_heating' | 'individual_heating' | 'heat_pump' | undefined;
  const energy_class = parsedEnergyRating;

  // ============ Financials ============
  const price_per_sqm_living = price && sqm_living ? Math.round(price / sqm_living) : undefined;
  const price_per_sqm_plot = price && sqm_plot ? Math.round(price / sqm_plot) : undefined;

  // ============ Disposition (Tier II) ============
  const disposition = listing.rooms ? `${listing.rooms}-room` : undefined;

  // ============ Return HousePropertyTierI ============
  return {
    // Category (CRITICAL for partition routing)
    property_category: 'house' as const,

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

    // House specifics
    sqm_living,
    sqm_plot,
    bedrooms,
    rooms,
    stories,

    // Amenities
    has_garden,
    has_garage,
    has_parking,
    has_pool,
    has_fireplace,
    has_basement,
    has_terrace,
    has_balcony,

    // Building context
    year_built,
    construction_type,
    condition,
    heating_type,
    energy_class,
    renovation_year,
    published_date: listing.published_date,

    // Additional fields
    bathrooms: listing.bathrooms ?? (listing.rooms ? Math.max(1, Math.floor(listing.rooms / 2)) : undefined),
    terrace_area: listing.terrace_area,

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
        area_living: sqm_living,
        area_plot: sqm_plot,
        year_built: parsedYearBuilt,
        renovation_year: parsedRenovationYear,
        rooms: listing.rooms,
        terrace: amenities.has_terrace || undefined,
        garage: amenities.has_garage || undefined,
        garden: amenities.has_garden || undefined,
        pool: amenities.has_pool || undefined,
        deposit: parsedDeposit,
        terrain: listing.terrain,
        plot_width: listing.plot_width,
        plot_length: listing.plot_length,
      }
    }
  };
}

/**
 * Detect house subtype from text
 * Slovak house types: rodinný dom, vila, chalupa, záhradná chatka
 */
function detectHouseSubtype(text: string): 'detached' | 'semi_detached' | 'townhouse' | 'villa' | 'cottage' | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();

  if (lower.includes('vila') || lower.includes('luxus')) return 'villa';
  if (lower.includes('chalupa') || lower.includes('chatka') || lower.includes('chata')) return 'cottage';
  if (lower.includes('radový dom') || lower.includes('radovy dom')) return 'townhouse';
  if (lower.includes('dvojdom') || lower.includes('dvojdomček')) return 'semi_detached';
  if (lower.includes('rodinný dom') || lower.includes('rodinny dom')) return 'detached';

  return 'detached'; // Default for houses
}
