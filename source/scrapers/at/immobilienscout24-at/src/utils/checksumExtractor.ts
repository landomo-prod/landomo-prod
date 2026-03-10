import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { SearchListing } from './fetchData';

/**
 * Extract checksum fields from SSR search listing data.
 * Uses expose_id + price + title to detect changes.
 */
export function extractImmoScout24ATChecksumFields(listing: SearchListing): ChecksumFields {
  return {
    price: listing.price ? parseFloat(listing.price.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || null : null,
    title: listing.title ?? null,
    description: null,
    bedrooms: listing.number_of_rooms ? parseInt(listing.number_of_rooms, 10) || null : null,
    bathrooms: null,
    sqm: listing.living_space ? parseFloat(listing.living_space.replace(/[^\d.,]/g, '').replace(',', '.')) || null : null,
  };
}

export function createImmoScout24ATChecksum(listing: SearchListing): ListingChecksum {
  const portalId = listing.expose_id;

  if (!portalId) {
    throw new Error('Listing missing expose_id');
  }

  return createListingChecksum('immobilienscout24-at', portalId, listing, extractImmoScout24ATChecksumFields as any);
}

export function batchCreateImmoScout24ATChecksums(listings: SearchListing[]): ListingChecksum[] {
  return listings.map(createImmoScout24ATChecksum);
}
