import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from ImmoScout24.ch listing data.
 * Only fields that should trigger a re-fetch when changed.
 */
export function extractChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null, // not in search results
    bedrooms: listing.numberOfRooms ?? null,
    bathrooms: null,
    sqm: listing.surfaceLiving ?? null,
  };
}

export function createImmoScout24ChChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString();
  if (!portalId) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('immoscout24-ch', portalId, listing, extractChecksumFields);
}

export function batchCreateChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createImmoScout24ChChecksum);
}
