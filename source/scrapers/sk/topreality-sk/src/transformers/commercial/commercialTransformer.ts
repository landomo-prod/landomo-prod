import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { TopRealityListing } from '../../types/toprealityTypes';
import {
  normalizeCondition,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType
} from '../../shared/slovak-value-mappings';
import {
  extractCity,
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
  mapTransactionType
} from '../shared/helpers';

/**
 * Transform TopReality.sk commercial listing to CommercialPropertyTierI
 */
export function transformCommercialToStandard(listing: TopRealityListing): CommercialPropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  const parsedCondition = listing.condition || extractConditionFromText(allText);
  const parsedHeating = listing.heating || extractHeatingFromText(allText);
  const parsedConstructionType = listing.constructionType || extractConstructionTypeFromText(allText);
  const parsedYearBuilt = listing.yearBuilt ?? extractYearBuiltFromText(allText);
  const parsedRenovationYear = listing.renovation_year ?? extractRenovationYearFromText(allText);
  const parsedEnergyRating = normalizeEnergyRating(listing.energyRating || extractEnergyRatingFromText(allText));
  const parsedDeposit = extractDepositFromText(allText);
  const amenities = extractAmenitiesFromText(allText);

  const normalizedCondition = normalizeCondition(parsedCondition);
  const normalizedHeating = normalizeHeatingType(parsedHeating);
  const normalizedConstruction = normalizeConstructionType(parsedConstructionType);

  const conditionEn = mapConditionToEnglish(normalizedCondition);
  const heatingEn = mapHeatingToEnglish(normalizedHeating);
  const constructionEn = mapConstructionToEnglish(normalizedConstruction);

  const sqm_total = listing.sqm_built ?? listing.area ?? 0;
  const lower = allText.toLowerCase();

  return {
    property_category: 'commercial',
    portal_id: String(listing.id || ''),
    title: listing.title,
    price: listing.price,
    currency: listing.currency || 'EUR',
    transaction_type: mapTransactionType(listing.transactionType),
    source_url: listing.url,
    source_platform: 'topreality-sk',
    status: 'active',

    location: {
      address: listing.location,
      city: extractCity(listing.location),
      country: 'sk',
      coordinates: listing.lat && listing.lon ? { lat: listing.lat, lon: listing.lon } : undefined
    } as PropertyLocation,

    sqm_total,
    has_elevator: listing.hasElevator ?? amenities.has_elevator ?? false,
    has_parking: listing.hasParking ?? listing.hasGarage ?? amenities.has_parking ?? amenities.has_garage ?? false,
    has_bathrooms: /wc|kúpeľ|kupel|bathroom|toilet/i.test(lower),

    year_built: parsedYearBuilt,
    renovation_year: parsedRenovationYear,
    construction_type: constructionEn === 'panel' ? 'prefab' : constructionEn as any,
    condition: conditionEn as any,
    heating_type: heatingEn,
    energy_class: parsedEnergyRating,
    deposit: parsedDeposit,

    images: listing.images || [],
    description: listing.description,

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
