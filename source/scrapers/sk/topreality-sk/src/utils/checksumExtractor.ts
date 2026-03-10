import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { TopRealityListing } from '../types/toprealityTypes';

/**
 * Extract checksum fields from TopReality.sk listing
 *
 * Key fields for change detection:
 * - price (most frequent change)
 * - title
 * - description
 * - area (sqm)
 * - rooms
 * - floor
 */
export function extractTopRealityChecksumFields(listing: TopRealityListing): ChecksumFields {
  return {
    price: listing.price || null,
    title: listing.title || null,
    description: listing.description || null,
    sqm: listing.area || null,
    disposition: listing.rooms ? `${listing.rooms}-izbový` : null, // Convert rooms to disposition-like format
    floor: listing.floor || null,
  };
}

/**
 * Create checksum from TopReality.sk listing
 */
export function createTopRealityChecksum(listing: TopRealityListing): ListingChecksum {
  const portalId = String(listing.id || '');

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('topreality', portalId, listing, extractTopRealityChecksumFields);
}

/**
 * Batch create checksum objects for multiple listings
 */
export function batchCreateTopRealityChecksums(listings: TopRealityListing[]): ListingChecksum[] {
  return listings.map(createTopRealityChecksum);
}
