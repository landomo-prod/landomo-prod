import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

export function extractNewhomeChecksumFields(listing: any): ChecksumFields {
  return {
    price: listing.price ?? listing.priceFrom ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.numberOfRooms ?? listing.rooms ?? null,
    bathrooms: null,
    sqm: listing.livingSpace ?? listing.usableSpace ?? null,
  };
}

export function createNewhomeChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString() ?? listing.objectId?.toString();

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('newhome-ch', portalId, listing, extractNewhomeChecksumFields);
}

export function batchCreateNewhomeChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createNewhomeChecksum);
}
