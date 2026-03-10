import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from adresowo listing data.
 * Fields that trigger a re-fetch when changed: price, title, area, rooms.
 */
export function extractAdresowoChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null,
    bedrooms: listing.rooms ?? null,
    bathrooms: null,
    sqm: listing.area ?? null,
  };
}

export function createAdresowoChecksum(listing: any): ListingChecksum {
  const portalId = listing.portalId;

  if (!portalId) {
    throw new Error('Listing missing portalId');
  }

  return createListingChecksum('adresowo', portalId, listing, extractAdresowoChecksumFields);
}

export function batchCreateAdresowoChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createAdresowoChecksum);
}
