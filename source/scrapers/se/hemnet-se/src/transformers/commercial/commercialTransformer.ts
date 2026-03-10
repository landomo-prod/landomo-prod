import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { HemnetListing } from '../../types/hemnetTypes';
import { parseMunicipality, buildSourceUrl, parsePublishedDate } from '../shared';

/**
 * Transform a Hemnet commercial/other listing to CommercialPropertyTierI.
 *
 * Note: Hemnet primarily lists residential properties. The OTHERS group
 * may include commercial-adjacent listings. This transformer handles edge
 * cases where no better category fits.
 */
export function transformHemnetCommercial(listing: HemnetListing): CommercialPropertyTierI {
  const price = listing.askingPrice?.amount ?? 0;
  const sqmTotal = listing.livingArea ?? listing.landArea ?? 0;

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
    property_category: 'commercial' as const,

    // Core
    title: listing.title,
    price,
    currency: 'SEK',
    transaction_type: 'sale',

    // Location
    location,

    // Commercial details
    sqm_total: sqmTotal,

    // Amenities (not available at list level)
    has_elevator: false,
    has_parking: false,
    has_bathrooms: false,

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
