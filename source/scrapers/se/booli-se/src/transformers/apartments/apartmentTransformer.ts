import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { BooliListingShort, TransactionType } from '../../types/booliTypes';

/**
 * Transform a Booli apartment listing to ApartmentPropertyTierI.
 *
 * Swedish apartment conventions:
 * - Booli objectType: "Lägenhet" (bostadsrätt), "Hyresrätt" (rental), "Bostadsrätt"
 * - rooms field includes the living room (sovrum + vardagsrum), like all Swedish portals
 *   → bedrooms = rooms - 1 (1 rum = studio with 0 bedrooms)
 * - rent field = monthly HOA fee (avgift) for bostadsrätt,
 *   or monthly rent for hyresrätt
 * - listPrice = asking price (SEK), 0/undefined if not disclosed
 * - livingArea = usable living space in sqm (BOA - boyta)
 * - additionalArea = secondary area (biarea) like garage, storage
 *
 * Booli-specific notes:
 * - hasElevator / hasBalcony / hasPatio are sometimes populated
 * - constructionYear often available
 * - floor number usually available for apartments
 * - latitude/longitude available for geo-enabled filtering
 */
export function transformBooliApartment(
  listing: BooliListingShort,
  transactionType: TransactionType
): ApartmentPropertyTierI {
  const price = listing.listPrice ?? 0;
  const sqm = listing.livingArea ?? 0;
  const rooms = listing.rooms ?? 1;

  // Swedish convention: rooms includes living room
  const bedrooms = Math.max(0, rooms - 1);

  const lat = listing.location.latitude;
  const lon = listing.location.longitude;

  const location: PropertyLocation = {
    address: listing.location.address,
    city: listing.location.city ?? listing.location.municipality ?? listing.location.postalArea ?? 'Sweden',
    region: listing.location.county ?? listing.location.municipality,
    country: 'Sweden',
    postal_code: listing.location.postalCode,
    ...(lat !== undefined && lon !== undefined ? { coordinates: { lat, lon } } : {}),
  };

  // For bostadsrätt: rent = HOA monthly fee
  // For hyresrätt: rent = monthly rent amount
  const monthlyFee =
    listing.objectType === 'Hyresrätt' ? undefined : listing.rent;
  const monthlyRent =
    listing.objectType === 'Hyresrätt' ? listing.rent : undefined;

  return {
    property_category: 'apartment' as const,

    // Core
    title: [listing.objectType, listing.rooms ? `${listing.rooms} rum` : undefined, listing.location.address]
      .filter(Boolean)
      .join(', '),
    price,
    currency: 'SEK',
    transaction_type: transactionType === 'rent' ? 'rent' : 'sale',

    // Location
    location,

    // Classification
    property_subtype: rooms === 1 ? 'studio' : 'standard',

    // Apartment details
    bedrooms,
    sqm,
    rooms,
    floor: listing.floor,

    // Amenities (available from Booli API when provided by the source)
    has_elevator: listing.hasElevator ?? false,
    has_balcony: (listing.hasBalcony ?? listing.hasPatio) ?? false,
    has_parking: false,
    has_basement: false,

    // Financials
    hoa_fees: monthlyFee,

    // Construction
    construction_type: undefined,
    renovation_year: undefined,

    // Tier II - Sweden specific data
    country_specific: {
      se_object_type: listing.objectType,
      se_sqm_price: listing.listSqmPrice,
      se_monthly_fee: monthlyFee,
      se_monthly_rent: monthlyRent,
      se_additional_area: listing.additionalArea,
      se_construction_year: listing.constructionYear,
      se_area: listing.location.area,
      se_postal_area: listing.location.postalArea,
      se_municipality: listing.location.municipality,
      se_county: listing.location.county,
      se_has_patio: listing.hasPatio,
      se_has_fireplace: listing.hasFireplace,
    },

    // Tier III - Portal metadata
    portal_metadata: {
      booli_id: listing.booliId,
      source_name: listing.source?.name,
      source_id: listing.source?.id,
      source_type: listing.source?.type,
      seller_name: listing.seller?.name,
      seller_url: listing.seller?.url,
      source_created: listing.sourceCreated,
    },

    // Published date
    published_date: listing.published ?? listing.sourceCreated,

    // Portal & lifecycle
    source_url: listing.url,
    source_platform: 'booli',
    portal_id: `booli-${listing.booliId}`,
    status: 'active',
  };
}
