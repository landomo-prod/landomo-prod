import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { WohnnetListing } from '../types/wohnnetTypes';

/**
 * Extract fields that trigger a re-fetch when changed.
 * Only fields available from the search/list page.
 */
export function extractChecksumFields(listing: WohnnetListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null, // not available from list page
    bedrooms: listing.details?.bedrooms ?? null,
    bathrooms: listing.details?.bathrooms ?? null,
    sqm: listing.details?.sqm ?? null,
  };
}

export function createPortalChecksum(listing: WohnnetListing): ListingChecksum {
  const portalId = listing.id;
  if (!portalId) throw new Error('Listing missing ID');

  return createListingChecksum(
    'wohnnet',
    portalId,
    listing,
    extractChecksumFields
  );
}

export function batchCreateChecksums(listings: WohnnetListing[]): ListingChecksum[] {
  return listings.map(createPortalChecksum);
}
