import { CommercialPropertyTierI } from '@landomo/core';
import { EdcListingRaw } from '../../types/edcTypes';

export function transformCommercial(listing: EdcListingRaw): CommercialPropertyTierI {
  const isRental = listing.caseClassification === 'Rent';
  const price = isRental
    ? (listing.rent?.value ?? listing.rentYear?.value ?? 0)
    : (listing.price?.value ?? 0);

  const sourceUrl = listing.urlPath
    ? `https://www.edc.dk${listing.urlPath}`
    : `https://www.edc.dk/erhverv/${listing.caseNumber}/`;

  const images = (listing.images ?? []).map(img => img.src);

  // Use livingArea as total sqm for commercial, fall back to areaFloor
  const sqmTotal = listing.livingArea?.value ?? listing.areaFloor?.value ?? 0;

  // businessReturnPercentage available for investment properties
  const returnPercentage = listing.businessReturnPercentage?.value ?? 0;

  return {
    property_category: 'commercial',
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
    sqm_total: sqmTotal,

    // Not available from search endpoint
    has_elevator: false,
    has_parking: false,
    has_bathrooms: false,

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
      is_advertised: listing.isAdvertised,
      is_new_case: listing.isNewCase,
      has_new_price: listing.hasNewPrice,
      return_percentage: returnPercentage > 0 ? returnPercentage : undefined,
      monthly_rent: isRental ? listing.rent?.value : undefined,
      annual_rent: isRental ? listing.rentYear?.value : undefined,
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
