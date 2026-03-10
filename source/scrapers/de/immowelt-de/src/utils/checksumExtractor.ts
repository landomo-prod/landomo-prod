import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from Immowelt DE listing data.
 * Only fields that should trigger a re-fetch when changed.
 */
export function extractImmoweltDEChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? listing.hardFacts?.price?.formatted ?? null,
    title: listing.title ?? listing.hardFacts?.title ?? null,
    description: listing.mainDescription?.description ?? null,
    bedrooms: null, // immowelt uses rooms, not bedrooms
    bathrooms: null,
    sqm: listing.area ?? null,
  };
}

export function createImmoweltDEChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString();

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('immowelt-de', portalId, listing, extractImmoweltDEChecksumFields);
}

export function batchCreateImmoweltDEChecksums(listings: any[]): ListingChecksum[] {
  return listings
    .filter(l => l.id)
    .map(createImmoweltDEChecksum);
}
