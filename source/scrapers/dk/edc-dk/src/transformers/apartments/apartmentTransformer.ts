import { ApartmentPropertyTierI } from '@landomo/core';
import { EdcListingRaw } from '../../types/edcTypes';

export function transformApartment(listing: EdcListingRaw): ApartmentPropertyTierI {
  const isRental = listing.caseClassification === 'Rent';
  const price = isRental
    ? (listing.rent?.value ?? 0)
    : (listing.price?.value ?? 0);

  // rooms includes living room; bedrooms = rooms - 1, minimum 0
  const rooms = listing.rooms?.value ?? 0;
  const bedrooms = rooms > 1 ? Math.floor(rooms) - 1 : 0;

  const sourceUrl = listing.urlPath
    ? `https://www.edc.dk${listing.urlPath}`
    : `https://www.edc.dk/alle-boliger/${listing.caseNumber}/`;

  const images = (listing.images ?? []).map(img => img.src);

  return {
    property_category: 'apartment',
    title: `${listing.estateTypeName} - ${listing.address}, ${listing.zipCode} ${listing.city}`,
    price,
    currency: 'DKK',
    transaction_type: isRental ? 'rent' : 'sale',
    location: {
      address: listing.address,
      city: listing.city,
      postal_code: listing.zipCode,
      country: 'Denmark',
      ...(listing.geoCoordinates
        ? { coordinates: { lat: listing.geoCoordinates.latitude, lon: listing.geoCoordinates.longitude } }
        : {}),
    },
    bedrooms,
    sqm: listing.livingArea?.value ?? 0,
    rooms: rooms > 0 ? Math.floor(rooms) : undefined,

    // EDC search endpoint does not return amenity flags; set conservatively
    has_elevator: false,
    has_balcony: false,
    has_parking: false,
    has_basement: false,

    year_built: listing.yearBuild ?? undefined,
    published_date: listing.statusChangeDate ? listing.statusChangeDate.split('T')[0] : undefined,

    images: images.length > 0 ? images : undefined,
    media: images.length > 0
      ? { images: images.map((url, i) => ({ url, order: i })) }
      : undefined,

    source_url: sourceUrl,
    source_platform: 'edc-dk',
    portal_id: `edc-${listing.caseNumber}`,
    status: 'active',

    country_specific: {
      case_number: listing.caseNumber,
      case_guid: listing.caseGuid,
      estate_type_name: listing.estateTypeName,
      case_status: listing.caseStatus,
      agency_guid: listing.agencyGuid,
      is_project: listing.isProject ?? false,
      is_advertised: listing.isAdvertised,
      is_new_case: listing.isNewCase,
      has_new_price: listing.hasNewPrice,
      monthly_rent: isRental ? listing.rent?.value : undefined,
    },

    portal_metadata: {
      edc: {
        id: listing.id,
        case_guid: listing.caseGuid,
        case_number: listing.caseNumber,
        estate_type: listing.estateType,
        estate_type_name: listing.estateTypeName,
        agency_guid: listing.agencyGuid,
        case_classification: listing.caseClassification,
        source: listing.source,
        status_change_date: listing.statusChangeDate,
      },
    },
  };
}
