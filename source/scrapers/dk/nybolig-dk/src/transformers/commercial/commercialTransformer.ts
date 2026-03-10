import { CommercialPropertyTierI } from '@landomo/core';
import { NyboligCase } from '../../types/nyboligTypes';

export function transformCommercial(listing: NyboligCase): CommercialPropertyTierI {
  const postalCode = listing.addressSecondLine.split(' ')[0] ?? '';
  const city = listing.addressSecondLine.split(' ').slice(1).join(' ') || listing.addressCity;

  const images = listing.primaryImages.filter(Boolean);
  const transactionType = listing.isRental ? 'rent' : 'sale';
  const price = listing.isRental ? listing.rent : listing.cashPrice;

  // For commercial, use livingSpace as primary sqm; fallback to propertySize
  const sqmTotal = listing.livingSpace || listing.propertySize || 0;

  return {
    property_category: 'commercial',
    title: `${listing.type}: ${listing.addressDisplayName}`,
    price: price || 0,
    currency: 'DKK',
    transaction_type: transactionType,
    location: {
      country: 'Denmark',
      city: city || listing.addressCity,
      postal_code: postalCode || undefined,
      ...(listing.addressLatitude && listing.addressLongitude
        ? { coordinates: { lat: listing.addressLatitude, lon: listing.addressLongitude } }
        : {}),
    },
    sqm_total: sqmTotal,
    has_elevator: false,  // not available in search API
    has_parking: false,   // not available in search API
    has_bathrooms: false, // not available in search API
    energy_class: listing.energyClassification || undefined,
    images: images.length > 0 ? images : undefined,
    media: images.length > 0
      ? { images: images.map((url, i) => ({ url, order: i })) }
      : undefined,
    source_url: `https://www.nybolig.dk${listing.url}`,
    source_platform: 'nybolig-dk',
    portal_id: listing.caseNumber || listing.id,
    status: 'active',
    country_specific: {
      case_number: listing.caseNumber,
      nybolig_id: listing.id,
      site_name: listing.siteName,
      type_name: listing.type,
      property_size_sqm: listing.propertySize || null,
      energy_classification: listing.energyClassification || null,
      is_new: listing.isNew,
      is_rental: listing.isRental,
    },
  };
}
