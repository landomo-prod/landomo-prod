import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { IdnesListing } from '../types/idnesTypes';

/**
 * Extract checksum fields from Idnes Reality listing data
 *
 * This extracts ONLY the fields that should trigger a re-fetch when changed:
 * - price (main trigger for updates)
 * - title (property name changes)
 * - description (rare but possible)
 * - sqm (area changes)
 * - rooms (disposition like "2+kk", "3+1")
 * - floor (floor level changes)
 *
 * Other fields like images, agent info, metadata, etc. don't warrant re-fetching
 */
export function extractIdnesChecksumFields(listing: IdnesListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    sqm: listing.area ?? null,
    // Use custom fields for Czech-specific data (rooms is string like "2+kk")
    disposition: listing.rooms ?? null,
    floor: listing.floor ?? null,
  };
}

/**
 * Create checksum from Idnes Reality listing
 *
 * @param listing - Raw Idnes Reality listing from scraper
 * @returns ListingChecksum ready to send to ingest API
 *
 * @example
 * const checksum = createIdnesChecksum(listing);
 * // { portal: 'idnes-reality', portalId: '12345', contentHash: 'abc...' }
 */
export function createIdnesChecksum(listing: IdnesListing): ListingChecksum {
  const rawId = listing.id;

  if (!rawId) {
    throw new Error('Listing missing id');
  }

  // Must match transformer portal_id format: `idnes-${listing.id}`
  const portalId = `idnes-${rawId}`;

  return createListingChecksum('idnes-reality', portalId, listing, extractIdnesChecksumFields);
}

/**
 * Batch create checksums from Idnes Reality listings
 *
 * @param listings - Array of raw Idnes Reality listings
 * @returns Array of checksums ready for comparison
 *
 * @example
 * const listings = await scraper.scrapeAll();
 * const checksums = batchCreateIdnesChecksums(listings);
 * const comparison = await checksumClient.compareChecksums(checksums);
 */
export function batchCreateIdnesChecksums(listings: IdnesListing[]): ListingChecksum[] {
  return listings.map(createIdnesChecksum);
}
