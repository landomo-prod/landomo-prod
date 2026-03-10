import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
  normalizeCondition,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType
} from '../../shared/slovak-value-mappings';
import {
  extractConditionFromText,
  extractHeatingFromText,
  extractConstructionTypeFromText,
  extractYearBuiltFromText,
  extractRenovationYearFromText,
  extractEnergyRatingFromText,
  extractDepositFromText,
  extractAmenitiesFromText,
  mapConditionToEnglish,
  mapHeatingToEnglish,
  mapConstructionToEnglish,
  mapTransactionType,
  extractCity
} from '../shared/extractionHelpers';

/**
 * Transform Reality.sk commercial listing to CommercialPropertyTierI
 *
 * Reality.sk is HTML-only - extracts data from title + description text
 */
export function transformRealityCommercial(listing: RealityListing): CommercialPropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  const parsedCondition = listing.condition || extractConditionFromText(allText);
  const parsedHeating = listing.heating || extractHeatingFromText(allText);
  const parsedConstructionType = listing.constructionType || extractConstructionTypeFromText(allText);
  const parsedYearBuilt = listing.yearBuilt ?? extractYearBuiltFromText(allText);
  const parsedRenovationYear = extractRenovationYearFromText(allText);
  const parsedEnergyRating = listing.energyRating ? normalizeEnergyRating(listing.energyRating) : normalizeEnergyRating(extractEnergyRatingFromText(allText));
  const parsedDeposit = extractDepositFromText(allText);
  const amenities = extractAmenitiesFromText(allText);
  if (listing.hasElevator) amenities.has_elevator = true;
  if (listing.hasParking || listing.hasGarage) amenities.has_parking = true;

  const normalizedCondition = normalizeCondition(parsedCondition);
  const normalizedHeating = normalizeHeatingType(parsedHeating);
  const normalizedConstruction = normalizeConstructionType(parsedConstructionType);

  const conditionEn = mapConditionToEnglish(normalizedCondition);
  const heatingEn = mapHeatingToEnglish(normalizedHeating);
  const constructionEn = mapConstructionToEnglish(normalizedConstruction);

  const sqm_total = listing.sqm || 0;
  const lower = allText.toLowerCase();

  return {
    property_category: 'commercial',
    title: listing.title || 'Unknown Commercial',
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: mapTransactionType(listing.transactionType),
    source_url: listing.url,
    source_platform: 'reality-sk',
    portal_id: String(listing.id || ''),
    status: 'active',

    location: {
      address: listing.location,
      city: extractCity(listing.location),
      country: 'sk',
      coordinates: listing.lat && listing.lon ? { lat: listing.lat, lng: listing.lon } : undefined
    } as PropertyLocation,

    sqm_total,
    has_elevator: amenities.has_elevator || false,
    has_parking: amenities.has_parking || amenities.has_garage || false,
    has_bathrooms: /wc|kúpeľ|kupel|bathroom|toilet/i.test(lower),

    year_built: parsedYearBuilt,
    renovation_year: parsedRenovationYear,
    construction_type: constructionEn === 'panel' ? 'prefab' : constructionEn as any,
    condition: conditionEn as any,
    heating_type: heatingEn,
    energy_class: parsedEnergyRating,
    deposit: parsedDeposit,
    parking_spaces: listing.outdoor_parking_spaces,
    published_date: listing.published_date,

    description: listing.description,

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
      }
    },

    country_specific: {
      slovakia: {
        condition: conditionEn,
        energy_rating: parsedEnergyRating,
        heating_type: heatingEn,
        construction_type: constructionEn,
      }
    }
  };
}
