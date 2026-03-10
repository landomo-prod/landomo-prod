import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from nieruchomosci-online listing data
 *
 * Fields that trigger a re-fetch when changed:
 * - price (main trigger)
 * - title
 * - sqm (area changes)
 */
export function extractChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null, // Not available in list view
    bedrooms: listing.rooms ?? null,
    bathrooms: null,
    sqm: listing.area ?? null,
  };
}

export function createNieruchomosciChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString();

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('nieruchomosci-online', portalId, listing, extractChecksumFields);
}

export function batchCreateChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createNieruchomosciChecksum);
}
