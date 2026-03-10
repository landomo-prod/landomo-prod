import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { FotocasaListing } from '../types/fotocasaTypes';
import { getFeatureValue } from './fotocasaHelpers';

/**
 * Extract checksum fields from Fotocasa listing
 * Checksum = MD5 of: price + sqm + title + url
 */
export function extractFotocasaChecksumFields(listing: FotocasaListing): ChecksumFields {
  const price = listing.transactions?.[0]?.value?.[0] ?? null;
  const sqm = getFeatureValue(listing.features, 'surface');
  const title = listing.description?.substring(0, 100) ?? null;
  const url = listing.detail?.es ?? null;

  return {
    price,
    title,
    description: null,
    bedrooms: null,
    bathrooms: null,
    sqm,
  };
}

export function createFotocasaChecksum(listing: FotocasaListing): ListingChecksum {
  const portalId = listing.id.toString();
  return createListingChecksum('fotocasa', portalId, listing, extractFotocasaChecksumFields);
}

export function batchCreateFotocasaChecksums(listings: FotocasaListing[]): ListingChecksum[] {
  return listings.map(createFotocasaChecksum);
}
