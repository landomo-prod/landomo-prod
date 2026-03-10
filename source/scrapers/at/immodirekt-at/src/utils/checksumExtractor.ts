import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract fields that trigger a re-fetch when changed.
 * Uses fields available from search page extraction (window.__INITIAL_STATE__).
 */
export function extractChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null, // not available from search results
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    sqm: listing.area ?? null,
  };
}

/**
 * Create checksum for a single listing
 */
export function createPortalChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString();
  if (!portalId) throw new Error('Listing missing ID');

  return createListingChecksum(
    'immodirekt-at',
    portalId,
    listing,
    extractChecksumFields
  );
}

/**
 * Batch create checksums from listings array
 */
export function batchCreateChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createPortalChecksum);
}
