import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from SReality listing page data
 *
 * This extracts ONLY the fields that should trigger a re-fetch when changed:
 * - price (main trigger for updates)
 * - title (property name changes)
 * - description (rare but possible)
 * - bedrooms/bathrooms (size changes)
 * - sqm (area changes)
 *
 * Other fields like images, agent info, etc. don't warrant re-fetching
 */
export function extractSRealityChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price_czk?.value_raw ?? null,
    title: listing.name ?? null,
    description: listing.text?.value ?? null,
    bedrooms: listing.items?.find((i: any) => i.name === 'number_of_rooms')?.value ?? null,
    bathrooms: listing.items?.find((i: any) => i.name === 'number_of_bathrooms')?.value ?? null,
    sqm: listing.usable_area ?? null,
  };
}

/**
 * Create checksum from SReality listing
 *
 * @param listing - Raw SReality listing from API
 * @returns ListingChecksum ready to send to ingest API
 *
 * @example
 * const checksum = createSRealityChecksum(listing);
 * // { portal: 'sreality', portalId: '12345', contentHash: 'abc...' }
 */
export function createSRealityChecksum(listing: any): ListingChecksum {
  const rawId = listing.hash_id?.toString() ?? listing._id?.toString();

  if (!rawId) {
    throw new Error('Listing missing hash_id and _id');
  }

  // Must match transformer portal_id format: `sreality-${hashId}`
  const portalId = `sreality-${rawId}`;

  return createListingChecksum('sreality', portalId, listing, extractSRealityChecksumFields);
}

/**
 * Batch create checksums from SReality listings
 *
 * @param listings - Array of raw SReality listings
 * @returns Array of checksums ready for comparison
 *
 * @example
 * const listings = await fetchAllListingPages(category);
 * const checksums = batchCreateSRealityChecksums(listings);
 * const comparison = await checksumClient.compareChecksums(checksums);
 */
export function batchCreateSRealityChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createSRealityChecksum);
}
