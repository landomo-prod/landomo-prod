import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { TopRealityListing } from '../../types/toprealityTypes';
import {
  normalizeOwnership,
  normalizeCondition,
  normalizeEnergyRating,
} from '../../shared/slovak-value-mappings';
import {
  extractCity,
  extractConditionFromText,
  extractAreaPlotFromText,
  extractAmenitiesFromText,
  mapConditionToEnglish,
  mapTransactionType
} from '../shared/helpers';

/**
 * Transform TopReality.sk land listing to LandPropertyTierI
 *
 * Land-specific:
 * - Plot area is THE primary field
 * - No floor, rooms, construction type, heating, furnished
 * - May have some amenities (utilities, access road)
 * - Condition less relevant (mostly for zoning/readiness)
 */
export function transformLandToStandard(listing: TopRealityListing): LandPropertyTierI {
  const allText = [listing.title, listing.description].filter(Boolean).join(' ');

  // Extract land-specific data
  const parsedCondition = extractConditionFromText(allText);
  const parsedAreaPlot = listing.sqm_plot ?? listing.area ?? extractAreaPlotFromText(allText);
  const amenities = extractAmenitiesFromText(allText);

  // Normalize Slovak values to canonical forms
  const normalizedCondition = normalizeCondition(parsedCondition);
  const conditionEn = mapConditionToEnglish(normalizedCondition);

  return {
    // Category (land partition)
    property_category: 'land' as const,

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

    // Land-specific flat fields (read directly by upsertLand)
    area_plot_sqm: parsedAreaPlot || 0,

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
        ownership: 'other',
        condition: conditionEn,
        area_plot: parsedAreaPlot,
        garden: listing.hasGarden ?? amenities.has_garden ?? undefined,
      }
    },
  };
}
