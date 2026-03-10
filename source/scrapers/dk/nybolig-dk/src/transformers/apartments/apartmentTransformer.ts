import { ApartmentPropertyTierI } from '@landomo/core';
import { NyboligCase } from '../../types/nyboligTypes';

export function transformApartment(listing: NyboligCase): ApartmentPropertyTierI {
  const postalCode = listing.addressSecondLine.split(' ')[0] ?? '';
  const city = listing.addressSecondLine.split(' ').slice(1).join(' ') || listing.addressCity;

  // Rooms: totalNumberOfRooms includes living rooms; bedrooms = rooms - 1 (minimum 0)
  const rooms = listing.totalNumberOfRooms || 0;
  const bedrooms = Math.max(0, rooms - 1);

  const images = listing.primaryImages.filter(Boolean);
  const transactionType = listing.isRental ? 'rent' : 'sale';
  const price = listing.isRental ? listing.rent : listing.cashPrice;

  return {
    property_category: 'apartment',
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
    bedrooms,
    sqm: listing.livingSpace || 0,
    floor: listing.floor !== undefined ? listing.floor : undefined,
    rooms: rooms || undefined,
    has_elevator: false,   // not available in search API response
    has_balcony: false,    // not available in search API response
    has_parking: false,    // not available in search API response
    has_basement: listing.basementSize > 0,
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
      floor_side: listing.floorSide || null,
      property_size_sqm: listing.propertySize || null,
      basement_size_sqm: listing.basementSize || null,
      energy_classification: listing.energyClassification || null,
      is_new: listing.isNew,
      is_rental: listing.isRental,
      open_house_text: listing.openHouseText || null,
    },
  };
}
