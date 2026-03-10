import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { ParariusSearchResult } from '../types/rawTypes';

export function extractParariusChecksumFields(listing: ParariusSearchResult): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.address ?? null,
    description: null,
    bedrooms: listing.rooms ? listing.rooms - 1 : null,
    bathrooms: null,
    sqm: listing.area ?? null,
  };
}

export function createParariusChecksum(listing: ParariusSearchResult): ListingChecksum {
  if (!listing.id) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('pararius', listing.id, listing, extractParariusChecksumFields);
}

export function batchCreateParariusChecksums(listings: ParariusSearchResult[]): ListingChecksum[] {
  return listings.map(createParariusChecksum);
}
