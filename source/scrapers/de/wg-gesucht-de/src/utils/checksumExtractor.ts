import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { WGGesuchtOffer } from '../types/wgGesuchtTypes';

/**
 * Extract fields that trigger a re-fetch when changed.
 * Only fields available from the search/list response.
 */
export function extractChecksumFields(listing: WGGesuchtOffer): ChecksumFields {
  return {
    price: listing.rent ?? listing.rent_cold ?? null,
    title: listing.title ?? null,
    description: listing.description ?? null,
    bedrooms: listing.rooms ?? null,
    bathrooms: null,
    sqm: listing.size ?? listing.apartment_size ?? null,
  };
}

export function createPortalChecksum(listing: WGGesuchtOffer): ListingChecksum {
  const portalId = String(listing.id || listing.offer_id);
  if (!portalId) throw new Error('Listing missing ID');

  return createListingChecksum(
    'wg-gesucht',
    portalId,
    listing,
    extractChecksumFields
  );
}

export function batchCreateChecksums(listings: WGGesuchtOffer[]): ListingChecksum[] {
  return listings.map(createPortalChecksum);
}
