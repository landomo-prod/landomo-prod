import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { BytyListing } from '../types/bytyTypes';

/**
 * Extract checksum fields from Byty.sk listing
 *
 * Key fields for change detection:
 * - price (most frequent change)
 * - title
 * - description
 * - area (sqm)
 * - location
 */
export function extractBytyChecksumFields(listing: BytyListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    sqm: listing.area ?? null,
    disposition: null, // Byty.sk doesn't have explicit disposition
    floor: null, // Not available in listing card
  };
}

/**
 * Create checksum from Byty.sk listing
 */
export function createBytyChecksum(listing: BytyListing): ListingChecksum {
  const portalId = listing.id;

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('byty-sk', portalId, listing, extractBytyChecksumFields);
}

/**
 * Batch create checksum objects for multiple listings
 */
export function batchCreateBytyChecksums(listings: BytyListing[]): ListingChecksum[] {
  return listings.map(createBytyChecksum);
}
