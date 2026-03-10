import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { BooliListingShort, TransactionType } from '../../types/booliTypes';
import { getHouseSubtype } from '../../utils/categoryDetector';

/**
 * Transform a Booli house listing to HousePropertyTierI.
 *
 * Covers these Booli objectType values:
 *   Villa         - detached house
 *   Radhus        - row house / townhouse
 *   Kedjehus      - chain house (attached on one side)
 *   Parhus        - semi-detached / duplex
 *   Fritidshus    - recreational cottage / summer house
 *   Vinterbonat fritidshus - year-round recreational house
 *   Gård / Gård/Skog - farm / forest estate
 *   Övrig         - other residential
 *
 * Booli data notes:
 * - livingArea = habitable living area in sqm (BOA)
 * - plotArea   = plot/land area in sqm
 * - rooms includes living room (Swedish convention): bedrooms = rooms - 1
 * - constructionYear frequently available for houses
 * - Booli does not expose garage/basement booleans at list level
 */
export function transformBooliHouse(
  listing: BooliListingShort,
  transactionType: TransactionType
): HousePropertyTierI {
  const price = listing.listPrice ?? 0;
  const sqmLiving = listing.livingArea ?? 0;
  const sqmPlot = listing.plotArea ?? 0;
  const rooms = listing.rooms ?? 1;

  // Swedish: rooms includes living room
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

  const propertySubtype = getHouseSubtype(listing.objectType);

  return {
    property_category: 'house' as const,

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
    property_subtype: propertySubtype,

    // House details
    bedrooms,
    sqm_living: sqmLiving,
    sqm_plot: sqmPlot,
    rooms,

    // Amenities
    has_garden: sqmPlot > 0,  // If plot area exists, assume garden
    has_garage: false,
    has_parking: false,
    has_basement: false,

    // Construction
    construction_type: undefined,
    renovation_year: undefined,

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
      se_has_fireplace: listing.hasFireplace,
      se_monthly_fee: listing.rent,
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
