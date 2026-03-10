import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { BooliListingShort, TransactionType } from '../../types/booliTypes';

/**
 * Transform a Booli commercial/premises listing to CommercialPropertyTierI.
 *
 * Booli objectType values mapped here:
 *   Lokaler - commercial premises (retail, office, workshop, etc.)
 *
 * Booli data notes:
 * - Booli primarily lists residential; commercial listings are limited
 * - livingArea is used as sqm_total for commercial premises
 * - rent field = monthly rent for rental premises
 * - listPrice = asking price (SEK) for sale listings
 */
export function transformBooliCommercial(
  listing: BooliListingShort,
  transactionType: TransactionType
): CommercialPropertyTierI {
  const price = listing.listPrice ?? 0;
  const sqmTotal = listing.livingArea ?? listing.plotArea ?? 0;

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

  const monthlyRent = transactionType === 'rent' ? listing.rent : undefined;

  return {
    property_category: 'commercial' as const,

    // Core
    title: [listing.objectType, listing.location.address].filter(Boolean).join(', '),
    price,
    currency: 'SEK',
    transaction_type: transactionType === 'rent' ? 'rent' : 'sale',

    // Location
    location,

    // Commercial details
    sqm_total: sqmTotal,

    // Amenities (not reliably provided by Booli for commercial)
    has_elevator: listing.hasElevator ?? false,
    has_parking: false,
    has_bathrooms: false,

    // Financials
    monthly_rent: monthlyRent,

    // Tier II - Sweden specific
    country_specific: {
      se_object_type: listing.objectType,
      se_sqm_price: listing.listSqmPrice,
      se_additional_area: listing.additionalArea,
      se_construction_year: listing.constructionYear,
      se_area: listing.location.area,
      se_postal_area: listing.location.postalArea,
      se_municipality: listing.location.municipality,
      se_county: listing.location.county,
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
