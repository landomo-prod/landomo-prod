import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { HemnetListing } from '../../types/hemnetTypes';
import { parseMunicipality, buildSourceUrl, parsePublishedDate } from '../shared';

/**
 * Transform a Hemnet house listing to HousePropertyTierI.
 *
 * Covers these Swedish housing forms:
 * - Villa (detached house)
 * - Radhus (row house / townhouse)
 * - Kedjehus (chain house - attached on one side, single entry)
 * - Parhus (semi-detached / duplex)
 * - Fritidshus (recreational cottage / summer house)
 * - Vinterbonat fritidshus (year-round recreational house)
 * - Gård/skog (farm / forest estate)
 * - Övrig (other residential)
 *
 * Hemnet data notes:
 * - livingArea = habitable living area (sqm)
 * - landArea = plot/lot area (sqm)
 * - numberOfRooms includes living room (Swedish convention)
 * - Hemnet does not expose elevator/garage/parking/basement booleans at list level
 */
export function transformHemnetHouse(listing: HemnetListing): HousePropertyTierI {
  const price = listing.askingPrice?.amount ?? 0;
  const sqmLiving = listing.livingArea ?? 0;
  const sqmPlot = listing.landArea ?? 0;
  const numberOfRooms = listing.numberOfRooms ?? 1;

  // Swedish: numberOfRooms includes living room
  const bedrooms = Math.max(0, numberOfRooms - 1);

  const { city, municipality } = parseMunicipality(listing.locationName);

  const location: PropertyLocation = {
    address: listing.streetAddress,
    city,
    region: municipality,
    country: 'Sweden',
    postal_code: listing.postCode,
  };

  const publishedDate = parsePublishedDate(listing);
  const housingFormName = listing.housingForm.name;

  // Determine subtype (must match HousePropertyTierI.property_subtype union type)
  let propertySubtype: 'detached' | 'semi_detached' | 'terraced' | 'villa' | 'cottage' | 'farmhouse' | 'townhouse' | 'bungalow' = 'villa';
  const nameLower = housingFormName.toLowerCase();
  if (nameLower.includes('radhus')) propertySubtype = 'townhouse';
  else if (nameLower.includes('parhus')) propertySubtype = 'semi_detached';
  else if (nameLower.includes('kedjehus')) propertySubtype = 'terraced';
  else if (nameLower.includes('fritidshus')) propertySubtype = 'cottage';
  else if (nameLower.includes('gård') || nameLower.includes('skog')) propertySubtype = 'farmhouse';

  return {
    property_category: 'house' as const,

    // Core
    title: listing.title,
    price,
    currency: 'SEK',
    transaction_type: 'sale',

    // Location
    location,

    // Classification
    property_subtype: propertySubtype,

    // House details
    bedrooms,
    sqm_living: sqmLiving,
    sqm_plot: sqmPlot,
    rooms: numberOfRooms,

    // Amenities (not available at list level from Hemnet)
    has_garden: sqmPlot > 0, // If there's a plot, assume garden
    has_garage: false,
    has_parking: false,
    has_basement: false,

    // Tier II - Sweden specific
    country_specific: {
      se_housing_form: housingFormName,
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
