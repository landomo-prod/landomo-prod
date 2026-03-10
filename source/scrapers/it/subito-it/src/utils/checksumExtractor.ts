import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { SubitoMinimalListing } from '../types/subitoTypes';

/**
 * Extract the fields that represent the meaningful state of a Subito.it listing.
 * Changes to these fields trigger a re-fetch + re-ingest.
 */
export function extractSubitoChecksumFields(listing: SubitoMinimalListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.subject ?? null,
    sqm: listing.sqm ?? null,
    // Include date so newly refreshed listings are caught
    purpose: listing.date ?? null,
  };
}

export function createSubitoChecksum(listing: SubitoMinimalListing): ListingChecksum {
  if (!listing.portalId) {
    throw new Error('Listing missing portalId');
  }
  return createListingChecksum('subito-it', listing.portalId, listing, extractSubitoChecksumFields);
}

export function batchCreateSubitoChecksums(listings: SubitoMinimalListing[]): ListingChecksum[] {
  return listings.map(createSubitoChecksum);
}
