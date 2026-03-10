import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from Comparis listing data
 */
export function extractComparisChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? listing.priceValue ?? null,
    title: listing.title ?? listing.name ?? null,
    description: listing.description ?? null,
    bedrooms: listing.numberOfRooms ?? listing.rooms ?? null,
    bathrooms: listing.numberOfBathrooms ?? null,
    sqm: listing.livingSpace ?? listing.surfaceLiving ?? null,
  };
}

export function createComparisChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString() ?? listing.adId?.toString() ?? listing.listingId?.toString();

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('comparis-ch', portalId, listing, extractComparisChecksumFields);
}

export function batchCreateComparisChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createComparisChecksum);
}
