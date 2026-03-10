import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from Immowelt AT listing data.
 * Only fields that should trigger a re-fetch when changed.
 */
export function extractImmoweltATChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.area ?? null,
  };
}

export function createImmoweltATChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString();

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('immowelt-at', portalId, listing, extractImmoweltATChecksumFields);
}

export function batchCreateImmoweltATChecksums(listings: any[]): ListingChecksum[] {
  return listings
    .filter(l => l.id)
    .map(createImmoweltATChecksum);
}
