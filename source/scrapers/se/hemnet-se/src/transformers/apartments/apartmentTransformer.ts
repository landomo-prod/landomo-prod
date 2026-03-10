import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { HemnetListing } from '../../types/hemnetTypes';
import { parseMunicipality, buildSourceUrl, parsePublishedDate } from '../shared';

/**
 * Transform a Hemnet "Lägenhet" (apartment) listing to ApartmentPropertyTierI.
 *
 * Hemnet data notes:
 * - numberOfRooms includes the living room (Swedish: sovrum + vardagsrum)
 *   → bedrooms = numberOfRooms - 1 (standard Swedish convention)
 *   → For 1-room apartments, bedrooms = 0 (studio)
 * - fee = monthly HOA fee (avgift to bostadsrättsförening)
 * - livingArea = usable living space in sqm
 * - Hemnet does not expose elevator/balcony/parking/basement booleans via API
 *   → Set to false as default (data not available at list level)
 */
export function transformHemnetApartment(listing: HemnetListing): ApartmentPropertyTierI {
  const price = listing.askingPrice?.amount ?? 0;
  const sqm = listing.livingArea ?? 0;
  const numberOfRooms = listing.numberOfRooms ?? 1;

  // Swedish convention: numberOfRooms includes living room
  // 1 rum = studio (0 bedrooms), 2 rum = 1 bedroom, etc.
  const bedrooms = Math.max(0, numberOfRooms - 1);

  const { city, municipality } = parseMunicipality(listing.locationName);

  const location: PropertyLocation = {
    address: listing.streetAddress,
    city,
    region: municipality,
    country: 'Sweden',
    postal_code: listing.postCode,
  };

  const monthlyFee = listing.fee?.amount;
  const publishedDate = parsePublishedDate(listing);

  return {
    property_category: 'apartment' as const,

    // Core
    title: listing.title,
    price,
    currency: 'SEK',
    transaction_type: 'sale',

    // Location
    location,

    // Classification
    property_subtype: numberOfRooms === 1 ? 'studio' : 'standard',

    // Apartment details
    bedrooms,
    sqm,
    rooms: numberOfRooms,

    // Amenities (not available at list level from Hemnet)
    has_elevator: false,
    has_balcony: false,
    has_parking: false,
    has_basement: false,

    // Financials
    hoa_fees: monthlyFee,

    // Tier II - Sweden specific
    country_specific: {
      se_housing_form: listing.housingForm.name,
      se_sqm_price: listing.squareMeterPrice?.amount,
      se_monthly_fee: monthlyFee,
      se_area: listing.area,
      se_postal_area: listing.postalArea,
      se_days_on_hemnet: 'daysOnHemnet' in listing ? listing.daysOnHemnet : undefined,
    },

    // Tier III - Portal metadata
    portal_metadata: {
      hemnet_id: listing.id,
      housing_form_groups: listing.housingForm.groups,
    },

    // Published date
    published_date: publishedDate,

    // Portal & lifecycle
    source_url: buildSourceUrl(listing),
    source_platform: 'hemnet',
    portal_id: `hemnet-${listing.id}`,
    status: 'active',
  };
}
