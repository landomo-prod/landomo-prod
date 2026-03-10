import { ChecksumFields, createListingChecksum, ListingChecksum } from '@landomo/core';
import { IdealistaListing } from '../types/idealistaTypes';

export function extractIdealistaChecksumFields(listing: IdealistaListing): ChecksumFields {
  return {
    price: listing.price ?? null,
    title: listing.title ?? null,
    description: null,
    sqm: listing.size ?? null,
    disposition: listing.propertyType ?? null,
    purpose: listing.operation ?? null,
  };
}

export function createIdealistaChecksum(listing: IdealistaListing): ListingChecksum {
  if (!listing.id) {
    throw new Error('Listing missing id');
  }
  return createListingChecksum('idealista.it', listing.id, listing, extractIdealistaChecksumFields);
}

export function batchCreateIdealistaChecksums(listings: IdealistaListing[]): ListingChecksum[] {
  return listings.map(createIdealistaChecksum);
}
