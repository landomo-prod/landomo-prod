import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { NehnutelnostiListing } from '../types/nehnutelnostiTypes';

/**
 * Extract checksum fields from Nehnutelnosti.sk listing
 *
 * Key fields for change detection:
 * - price (most frequent change)
 * - title
 * - description
 * - sqm (area)
 * - disposition
 * - floor
 */
export function extractNehnutelnostiChecksumFields(listing: NehnutelnostiListing): ChecksumFields {
  return {
    price: listing.price || listing.price_value || listing.price_eur || null,
    title: listing.name || listing.title || listing.headline || null,
    description: listing.description || listing.text || null,
    sqm: listing.area || listing.usable_area || listing.floor_area || null,
    disposition: listing.disposition || null,
    floor: listing.floor || listing.floor_number || null,
  };
}

/**
 * Create checksum from Nehnutelnosti.sk listing
 */
export function createNehnutelnostiChecksum(listing: NehnutelnostiListing): ListingChecksum {
  const portalId = String(listing.id || listing.hash_id || '');

  if (!portalId) {
    throw new Error('Listing missing id');
  }

  return createListingChecksum('nehnutelnosti', portalId, listing, extractNehnutelnostiChecksumFields);
}

/**
 * Batch create checksum objects for multiple listings
 */
export function batchCreateNehnutelnostiChecksums(listings: NehnutelnostiListing[]): ListingChecksum[] {
  return listings.map(createNehnutelnostiChecksum);
}
