import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { RawLogicImmoListing } from '../types/rawTypes';

export function extractChecksumFields(listing: RawLogicImmoListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.surface ?? null,
  };
}

export function createLogicImmoChecksum(listing: RawLogicImmoListing): ListingChecksum {
  const portalId = listing.id?.toString();
  if (!portalId) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('logic-immo-be', portalId, listing, extractChecksumFields);
}

export function batchCreateChecksums(listings: RawLogicImmoListing[]): ListingChecksum[] {
  return listings.map(createLogicImmoChecksum);
}
