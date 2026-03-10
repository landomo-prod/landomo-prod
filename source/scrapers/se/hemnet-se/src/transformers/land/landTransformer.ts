import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { HemnetListing } from '../../types/hemnetTypes';
import { parseMunicipality, buildSourceUrl, parsePublishedDate } from '../shared';

/**
 * Transform a Hemnet "Tomt" (land plot) listing to LandPropertyTierI.
 *
 * Hemnet data notes:
 * - landArea = plot area in sqm
 * - livingArea may be non-null if there's an existing structure on the plot
 * - askingPrice is the price for the land
 */
export function transformHemnetLand(listing: HemnetListing): LandPropertyTierI {
  const price = listing.askingPrice?.amount ?? 0;
  // For land, landArea is the primary area; fallback to livingArea if landArea missing
  const areaPlotSqm = listing.landArea ?? listing.livingArea ?? 0;

  const { city, municipality } = parseMunicipality(listing.locationName);

  const location: PropertyLocation = {
    address: listing.streetAddress,
    city,
    region: municipality,
    country: 'Sweden',
    postal_code: listing.postCode,
  };

  const publishedDate = parsePublishedDate(listing);

  return {
    property_category: 'land' as const,

    // Core
    title: listing.title,
    price,
    currency: 'SEK',
    transaction_type: 'sale',

    // Location
    location,

    // Land details
    area_plot_sqm: areaPlotSqm,

    // Tier II - Sweden specific
    country_specific: {
      se_housing_form: listing.housingForm.name,
      se_sqm_price: listing.squareMeterPrice?.amount,
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
