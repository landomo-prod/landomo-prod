import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

export function extractImmovlanChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.surface ?? null,
  };
}

export function createImmovlanChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString();
  if (!portalId) throw new Error('Listing missing id');
  return createListingChecksum('immovlan', portalId, listing, extractImmovlanChecksumFields);
}

export function batchCreateImmovlanChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createImmovlanChecksum);
}
