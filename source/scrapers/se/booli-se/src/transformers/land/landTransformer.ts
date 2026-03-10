import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { BooliListingShort, TransactionType } from '../../types/booliTypes';

/**
 * Transform a Booli land/plot listing to LandPropertyTierI.
 *
 * Booli objectType values mapped here:
 *   Tomt      - building plot
 *   Mark      - land/ground
 *   Tomt/Mark - combined plot/land
 *
 * Booli data notes:
 * - plotArea = primary area measurement for land listings (sqm)
 * - livingArea may be set if there's a structure on the plot
 * - listSqmPrice = price per sqm of land
 * - plotArea is the authoritative area for land listings
 */
export function transformBooliLand(
  listing: BooliListingShort,
  transactionType: TransactionType
): LandPropertyTierI {
  const price = listing.listPrice ?? 0;
  // plotArea is the land area; fall back to livingArea if plotArea is missing
  const areaPlotSqm = listing.plotArea ?? listing.livingArea ?? 0;

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

  return {
    property_category: 'land' as const,

    // Core
    title: [listing.objectType, listing.location.address].filter(Boolean).join(', '),
    price,
    currency: 'SEK',
    transaction_type: transactionType === 'rent' ? 'rent' : 'sale',

    // Location
    location,

    // Land details
    area_plot_sqm: areaPlotSqm,

    // Tier II - Sweden specific
    country_specific: {
      se_object_type: listing.objectType,
      se_sqm_price: listing.listSqmPrice,
      se_area: listing.location.area,
      se_postal_area: listing.location.postalArea,
      se_municipality: listing.location.municipality,
      se_county: listing.location.county,
      se_construction_year: listing.constructionYear,
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
