import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { RawRealoListing } from '../types/rawTypes';

export function extractChecksumFields(listing: RawRealoListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.surface ?? null,
  };
}

export function createRealoChecksum(listing: RawRealoListing): ListingChecksum {
  const portalId = listing.id?.toString();
  if (!portalId) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('realo-be', portalId, listing, extractChecksumFields);
}

export function batchCreateChecksums(listings: RawRealoListing[]): ListingChecksum[] {
  return listings.map(createRealoChecksum);
}
