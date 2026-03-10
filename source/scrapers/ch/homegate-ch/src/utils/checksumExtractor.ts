import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';

/**
 * Extract checksum fields from Homegate listing data.
 */
export function extractChecksumFields(listing: any): ChecksumFields {
  const l = listing.listing || listing;
  const prices = l.prices || {};
  const price = prices.buy?.price || prices.rent?.gross || prices.rent?.net || null;
  const chars = l.characteristics || {};
  const title = l.localization?.de?.text?.title || l.localization?.en?.text?.title || null;

  return {
    price,
    title,
    description: null,
    bedrooms: chars.numberOfRooms ?? null,
    bathrooms: chars.numberOfBathrooms ?? null,
    sqm: chars.livingSpace ?? null,
  };
}

export function createHomegateChecksum(listing: any): ListingChecksum {
  const portalId = listing.id?.toString();
  if (!portalId) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('homegate-ch', portalId, listing, extractChecksumFields);
}

export function batchCreateChecksums(listings: any[]): ListingChecksum[] {
  return listings.map(createHomegateChecksum);
}
