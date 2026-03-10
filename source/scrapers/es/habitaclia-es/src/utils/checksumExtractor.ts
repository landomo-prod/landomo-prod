import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { HabitacliaListingRaw } from '../types/habitacliaTypes';

export function extractHabitacliaChecksumFields(listing: HabitacliaListingRaw): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null,
    bedrooms: listing.rooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.sqm ?? null,
  };
}

export function createHabitacliaChecksum(listing: HabitacliaListingRaw): ListingChecksum {
  if (!listing.id) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('habitaclia', listing.id, listing, extractHabitacliaChecksumFields);
}

export function batchCreateHabitacliaChecksums(listings: HabitacliaListingRaw[]): ListingChecksum[] {
  return listings.map(createHabitacliaChecksum);
}
