import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { RealityListing } from '../types/realityTypes';

/**
 * Extract checksum fields from Reality.sk listing
 *
 * Key fields for change detection:
 * - price (most frequent change)
 * - title
 * - description
 * - sqm (area)
 * - rooms (bedrooms)
 */
export function extractRealityChecksumFields(listing: RealityListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    sqm: listing.sqm ?? null,
    bedrooms: listing.rooms ?? null,
  };
}

/**
 * Create checksum from Reality.sk listing
 */
export function createRealityChecksum(listing: RealityListing): ListingChecksum {
  const portalId = listing.id;

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('reality-sk', portalId, listing, extractRealityChecksumFields);
}

/**
 * Batch create checksum objects for multiple listings
 */
export function batchCreateRealityChecksums(listings: RealityListing[]): ListingChecksum[] {
  return listings.map(createRealityChecksum);
}
